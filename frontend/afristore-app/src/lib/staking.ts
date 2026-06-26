"use client";

import {
  Contract,
  SorobanRpc,
  TransactionBuilder,
  xdr,
  nativeToScVal,
  scValToNative,
  Address,
  BASE_FEE,
} from "@stellar/stellar-sdk";
import { config } from "./config";
import { getConnectedPublicKey, signWithFreighter } from "./freighter";
import { mapSorobanErrorMessage } from "./errors";

export interface StakedPosition {
  owner: string;
  token_address: string;
  token_id: number;
  staked_at: number;
  rewards_earned: string;
}

export interface StakedNFTIndexerRow {
  id: number;
  owner: string;
  tokenAddress: string;
  tokenId: string;
  collection: string;
  stakedAt: string;
  status: string;
  rewardsEarned: string;
  createdAtLedger: number;
  updatedAtLedger: number;
}

export const STAKING_CONTRACT_ID =
  process.env.NEXT_PUBLIC_STAKING_CONTRACT_ID || "";

function getRpc(): SorobanRpc.Server {
  return new SorobanRpc.Server(config.rpcUrl, { allowHttp: false });
}

export function getStakingContract(): Contract {
  return new Contract(STAKING_CONTRACT_ID);
}

function getNetworkPassphrase(): string {
  return config.networkPassphrase;
}

async function invokeStakingContract(
  callerPublicKey: string,
  method: string,
  args: xdr.ScVal[],
  readonly = false,
): Promise<xdr.ScVal> {
  if (!STAKING_CONTRACT_ID) {
    throw new Error("STAKING_CONTRACT_ID not configured");
  }

  const readableError = (raw: string, fallback: string): Error => {
    const mapped = mapSorobanErrorMessage(raw);
    return new Error(mapped ?? fallback);
  };

  const rpc = getRpc();
  const contract = getStakingContract();

  const account = await rpc.getAccount(callerPublicKey);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const simResult = await rpc.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(simResult)) {
    const raw = String(simResult.error ?? "");
    throw readableError(raw, "Unable to simulate this transaction.");
  }

  if (readonly) {
    const retVal = (
      simResult as SorobanRpc.Api.SimulateTransactionSuccessResponse
    ).result?.retval;
    if (!retVal) throw new Error("No return value from simulation.");
    return retVal;
  }

  const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();
  const txXdr = preparedTx.toXDR();
  const signedXdr = await signWithFreighter(txXdr, getNetworkPassphrase());

  const submitted = await rpc.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, getNetworkPassphrase()),
  );

  if (submitted.status === "ERROR") {
    const raw = String(submitted.errorResult ?? "");
    throw readableError(raw, "Transaction submission failed.");
  }

  let getResult = await rpc.getTransaction(submitted.hash);
  while (getResult.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND) {
    await new Promise((r) => setTimeout(r, 1000));
    getResult = await rpc.getTransaction(submitted.hash);
  }

  if (getResult.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
    const raw = JSON.stringify(getResult);
    throw readableError(raw, "Transaction failed on-chain.");
  }

  const successResult =
    getResult as SorobanRpc.Api.GetSuccessfulTransactionResponse;
  return successResult.returnValue ?? xdr.ScVal.scvVoid();
}

export async function stake(
  userPublicKey: string,
  tokenAddress: string,
  tokenId: number,
): Promise<void> {
  const args: xdr.ScVal[] = [
    new Address(userPublicKey).toScVal(),
    new Address(tokenAddress).toScVal(),
    nativeToScVal(BigInt(tokenId), { type: "u64" }),
  ];
  await invokeStakingContract(userPublicKey, "stake", args);
}

export async function unstake(
  userPublicKey: string,
  tokenAddress: string,
  tokenId: number,
): Promise<void> {
  const args: xdr.ScVal[] = [
    new Address(userPublicKey).toScVal(),
    new Address(tokenAddress).toScVal(),
    nativeToScVal(BigInt(tokenId), { type: "u64" }),
  ];
  await invokeStakingContract(userPublicKey, "unstake", args);
}

export async function claimRewards(
  userPublicKey: string,
): Promise<number> {
  const args: xdr.ScVal[] = [new Address(userPublicKey).toScVal()];
  const retVal = await invokeStakingContract(userPublicKey, "claim_rewards", args);
  return Number(scValToNative(retVal));
}

export async function getStakedPosition(
  userPublicKey: string,
  tokenAddress: string,
  tokenId: number,
): Promise<StakedPosition | null> {
  const caller = await getConnectedPublicKey();
  const pk = caller ?? userPublicKey;
  const retVal = await invokeStakingContract(
    pk,
    "get_staked_position",
    [
      new Address(userPublicKey).toScVal(),
      new Address(tokenAddress).toScVal(),
      nativeToScVal(BigInt(tokenId), { type: "u64" }),
    ],
    true,
  );
  const raw = scValToNative(retVal);
  if (!raw) return null;
  const obj = raw as Record<string, unknown>;
  return {
    owner: (obj["owner"] as any).toString(),
    token_address: (obj["token_address"] as any).toString(),
    token_id: Number(obj["token_id"]),
    staked_at: Number(obj["staked_at"]),
    rewards_earned: String(obj["rewards_earned"] ?? "0"),
  };
}

export async function getUserStakes(
  userPublicKey: string,
): Promise<StakedPosition[]> {
  const caller = await getConnectedPublicKey();
  const pk = caller ?? userPublicKey;
  const retVal = await invokeStakingContract(
    pk,
    "get_user_stakes",
    [new Address(userPublicKey).toScVal()],
    true,
  );
  const raw = scValToNative(retVal) as any[];
  return raw.map((obj: Record<string, unknown>) => ({
    owner: (obj["owner"] as any).toString(),
    token_address: (obj["token_address"] as any).toString(),
    token_id: Number(obj["token_id"]),
    staked_at: Number(obj["staked_at"]),
    rewards_earned: String(obj["rewards_earned"] ?? "0"),
  }));
}

export async function calculateRewards(
  userPublicKey: string,
): Promise<number> {
  const caller = await getConnectedPublicKey();
  const pk = caller ?? userPublicKey;
  const retVal = await invokeStakingContract(
    pk,
    "calculate_rewards",
    [new Address(userPublicKey).toScVal()],
    true,
  );
  return Number(scValToNative(retVal));
}

export async function isStakingPaused(): Promise<boolean> {
  const caller = await getConnectedPublicKey();
  if (!caller) return false;
  const retVal = await invokeStakingContract(
    caller,
    "is_paused",
    [],
    true,
  );
  return Boolean(scValToNative(retVal));
}

export async function totalStaked(): Promise<number> {
  const caller = await getConnectedPublicKey();
  if (!caller) return 0;
  const retVal = await invokeStakingContract(caller, "total_staked", [], true);
  return Number(scValToNative(retVal));
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useWalletContext } from "@/context/WalletContext";
import { useOwnedNFTs } from "@/hooks/useOwnedNFTs";
import { OwnedToken } from "@/lib/indexer";
import {
  AlertCircle,
  Lock,
  Unlock,
  Coins,
  RefreshCw,
  Wallet,
  Layers,
} from "lucide-react";

interface StakedItem {
  id: string;
  collectionAddress: string;
  tokenId: number;
  name?: string;
  image?: string;
  stakedAt: string;
  rewardsEarned: string;
}

export default function StakingPage() {
  const { publicKey, isConnected, isConnecting } = useWalletContext();
  const { tokens: ownedNfts, isLoading: nftsLoading, refresh: refreshNFTs } = useOwnedNFTs(publicKey);

  const [stakedNfts, setStakedNfts] = useState<StakedItem[]>([]);
  const [isLoadingStaked, setIsLoadingStaked] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isStaking, setIsStaking] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRewards, setPendingRewards] = useState(0);
  const [activeTab, setActiveTab] = useState<"unstaked" | "staked">("unstaked");
  const [totalStakedCount, setTotalStakedCount] = useState(0);

  const fetchStakedNfts = useCallback(async () => {
    if (!publicKey) return;
    setIsLoadingStaked(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_INDEXER_URL || "http://localhost:4000"}/wallets/${encodeURIComponent(publicKey)}/staked`,
      );
      if (res.ok) {
        const data = await res.json();
        const mapped = (data || []).map((item: any) => ({
          id: `${item.tokenAddress}-${item.tokenId}`,
          collectionAddress: item.tokenAddress,
          tokenId: Number(item.tokenId),
          name: `NFT #${item.tokenId}`,
          stakedAt: item.stakedAt,
          rewardsEarned: item.rewardsEarned || "0",
        }));
        setStakedNfts(mapped);
        setTotalStakedCount(mapped.length);
      }
    } catch {
      // Indexer might not have staking support yet
    } finally {
      setIsLoadingStaked(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (publicKey) {
      fetchStakedNfts();
    }
  }, [publicKey, fetchStakedNfts]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStakeSelected = async () => {
    if (!publicKey || selectedIds.size === 0) return;
    setIsStaking(true);
    setError(null);
    try {
      const { stake } = await import("@/lib/staking");
      const selected = ownedNfts.filter((nft) =>
        selectedIds.has(`${nft.collectionAddress}-${nft.tokenId}`),
      );
      for (const nft of selected) {
        await stake(publicKey, nft.collectionAddress, nft.tokenId);
      }
      setSelectedIds(new Set());
      await refreshNFTs();
      await fetchStakedNfts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Staking failed");
    } finally {
      setIsStaking(false);
    }
  };

  const handleUnstake = async (collectionAddress: string, tokenId: number) => {
    if (!publicKey) return;
    setIsUnstaking(true);
    setError(null);
    try {
      const { unstake } = await import("@/lib/staking");
      await unstake(publicKey, collectionAddress, tokenId);
      await fetchStakedNfts();
      await refreshNFTs();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unstaking failed");
    } finally {
      setIsUnstaking(false);
    }
  };

  const handleClaimRewards = async () => {
    if (!publicKey) return;
    setIsClaiming(true);
    setError(null);
    try {
      const { claimRewards } = await import("@/lib/staking");
      await claimRewards(publicKey);
      await fetchStakedNfts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Claim failed");
    } finally {
      setIsClaiming(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-midnight-900 pt-32 pb-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h1 className="text-5xl font-display font-bold text-white tracking-tight">
              NFT Staking
            </h1>
            <p className="mt-4 max-w-xl text-xl text-white/60 font-inter leading-relaxed">
              Stake your NFTs to earn platform rewards
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 mb-4">
            <Wallet size={32} />
          </div>
          <h3 className="font-display font-bold text-gray-900 text-lg">
            Connect your wallet
          </h3>
          <p className="mt-1 text-sm text-gray-500 max-w-sm text-center">
            Connect your Freighter or Magic wallet to stake NFTs and earn rewards.
          </p>
        </div>
      </div>
    );
  }

  const unstakedNfts = ownedNfts.filter(
    (nft) => !stakedNfts.some((s) => s.collectionAddress === nft.collectionAddress && s.tokenId === nft.tokenId),
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-midnight-900 pt-32 pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <div className="space-y-4">
              <h1 className="text-5xl font-display font-bold text-white tracking-tight">
                NFT Staking
              </h1>
              <p className="max-w-xl text-xl text-white/60 font-inter leading-relaxed">
                Stake your NFTs to earn platform rewards
              </p>
            </div>
            <div className="flex flex-wrap gap-8 md:gap-12">
              <div className="relative">
                <span className="text-3xl font-display font-bold text-white block">
                  {totalStakedCount}
                </span>
                <span className="text-sm font-bold uppercase tracking-widest text-brand-500">
                  Staked
                </span>
              </div>
              <div className="relative">
                <span className="text-3xl font-display font-bold text-white block">
                  {ownedNfts.length}
                </span>
                <span className="text-sm font-bold uppercase tracking-widest text-brand-500">
                  Owned
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-8">
        <div className="flex gap-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("unstaked")}
            className={`pb-3 px-1 text-sm font-bold uppercase tracking-wider transition-colors ${
              activeTab === "unstaked"
                ? "text-brand-600 border-b-2 border-brand-500"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Your Unstaked NFTs
          </button>
          <button
            onClick={() => setActiveTab("staked")}
            className={`pb-3 px-1 text-sm font-bold uppercase tracking-wider transition-colors ${
              activeTab === "staked"
                ? "text-brand-600 border-b-2 border-brand-500"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Your Staked Vault
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-6">
          <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-100 p-4">
            <AlertCircle size={20} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-600 text-sm font-medium"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Actions bar */}
      {activeTab === "unstaked" && selectedIds.size > 0 && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-6">
          <div className="flex items-center justify-between rounded-xl bg-brand-50 border border-brand-100 p-4">
            <span className="text-sm font-medium text-brand-900">
              {selectedIds.size} NFT{selectedIds.size > 1 ? "s" : ""} selected
            </span>
            <button
              onClick={handleStakeSelected}
              disabled={isStaking}
              className="flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50 transition-all"
            >
              <Lock size={14} />
              {isStaking ? "Staking..." : "Stake Selected"}
            </button>
          </div>
        </div>
      )}

      {activeTab === "staked" && stakedNfts.length > 0 && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-6">
          <div className="flex items-center justify-between rounded-xl bg-mint-50 border border-mint-100 p-4">
            <div className="flex items-center gap-2">
              <Coins size={20} className="text-mint-600" />
              <span className="text-sm font-medium text-mint-900">
                Pending Rewards
              </span>
            </div>
            <button
              onClick={handleClaimRewards}
              disabled={isClaiming}
              className="flex items-center gap-2 rounded-xl bg-mint-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-mint-600 disabled:opacity-50 transition-all"
            >
              <Coins size={14} />
              {isClaiming ? "Claiming..." : "Claim All Rewards"}
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        {activeTab === "unstaked" && (
          <>
            {/* Loading */}
            {nftsLoading && (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-2xl border border-gray-100 bg-white overflow-hidden"
                  >
                    <div className="aspect-square bg-gray-100" />
                    <div className="p-4 space-y-3">
                      <div className="h-4 w-3/4 rounded bg-gray-100" />
                      <div className="h-3 w-1/2 rounded bg-gray-100" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty */}
            {!nftsLoading && unstakedNfts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 mb-4">
                  <Layers size={32} />
                </div>
                <h3 className="font-display font-bold text-gray-900 text-lg">
                  No unstaked NFTs
                </h3>
                <p className="mt-1 text-sm text-gray-500 max-w-sm text-center">
                  {stakedNfts.length > 0
                    ? "All your NFTs are staked. Come back after unstaking to re-stake."
                    : "You don't own any NFTs yet. Explore the marketplace to find artworks to collect."}
                </p>
              </div>
            )}

            {/* Grid */}
            {!nftsLoading && unstakedNfts.length > 0 && (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {unstakedNfts.map((nft) => {
                  const nftId = `${nft.collectionAddress}-${nft.tokenId}`;
                  const isSelected = selectedIds.has(nftId);
                  return (
                    <button
                      key={nftId}
                      onClick={() => toggleSelect(nftId)}
                      className={`relative rounded-2xl border-2 overflow-hidden bg-white text-left transition-all ${
                        isSelected
                          ? "border-brand-500 shadow-lg shadow-brand-500/20"
                          : "border-gray-100 hover:border-brand-200 hover:shadow-md"
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-white text-xs font-bold">
                          ✓
                        </div>
                      )}
                      <div className="aspect-square bg-gray-50 flex items-center justify-center">
                        {nft.image ? (
                          <img
                            src={nft.image}
                            alt={nft.name || `NFT #${nft.tokenId}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Layers size={48} className="text-gray-300" />
                        )}
                      </div>
                      <div className="p-4">
                        <p className="font-display font-bold text-gray-900 truncate">
                          {nft.name || `NFT #${nft.tokenId}`}
                        </p>
                        <p className="text-xs font-mono text-gray-400 truncate mt-1">
                          {nft.collectionAddress.slice(0, 8)}...
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {activeTab === "staked" && (
          <>
            {/* Loading */}
            {isLoadingStaked && (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-2xl border border-gray-100 bg-white overflow-hidden"
                  >
                    <div className="aspect-square bg-gray-100" />
                    <div className="p-4 space-y-3">
                      <div className="h-4 w-3/4 rounded bg-gray-100" />
                      <div className="h-3 w-1/2 rounded bg-gray-100" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty */}
            {!isLoadingStaked && stakedNfts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-mint-50 text-mint-500 mb-4">
                  <Lock size={32} />
                </div>
                <h3 className="font-display font-bold text-gray-900 text-lg">
                  No staked NFTs
                </h3>
                <p className="mt-1 text-sm text-gray-500 max-w-sm text-center">
                  You haven&apos;t staked any NFTs yet. Browse your unstaked NFTs and
                  start staking to earn rewards.
                </p>
              </div>
            )}

            {/* Grid */}
            {!isLoadingStaked && stakedNfts.length > 0 && (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {stakedNfts.map((nft) => (
                  <div
                    key={nft.id}
                    className="relative rounded-2xl border border-gray-100 bg-white overflow-hidden"
                  >
                    <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-full bg-mint-500/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                      <Lock size={10} />
                      Staked
                    </div>
                    <div className="aspect-square bg-gray-50 flex items-center justify-center">
                      <Layers size={48} className="text-gray-300" />
                    </div>
                    <div className="p-4 space-y-3">
                      <p className="font-display font-bold text-gray-900 truncate">
                        {nft.name || `NFT #${nft.tokenId}`}
                      </p>
                      <p className="text-xs font-mono text-gray-400 truncate">
                        {nft.collectionAddress.slice(0, 8)}...
                      </p>
                      <div className="flex items-center gap-1.5 text-sm text-mint-600">
                        <Coins size={14} />
                        <span className="font-medium">{nft.rewardsEarned}</span>
                      </div>
                      <button
                        onClick={() =>
                          handleUnstake(nft.collectionAddress, nft.tokenId)
                        }
                        disabled={isUnstaking}
                        className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition-all"
                      >
                        <Unlock size={14} />
                        {isUnstaking ? "Unstaking..." : "Unstake"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

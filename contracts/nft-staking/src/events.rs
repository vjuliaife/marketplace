use soroban_sdk::{contracttype, Address, Env};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StakedEvent {
    pub user: Address,
    pub token_address: Address,
    pub token_id: u64,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UnstakedEvent {
    pub user: Address,
    pub token_address: Address,
    pub token_id: u64,
    pub rewards_paid: i128,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RewardsClaimedEvent {
    pub user: Address,
    pub amount: i128,
    pub timestamp: u64,
}

impl StakedEvent {
    #[allow(deprecated)]
    pub fn publish(self, env: &Env) {
        env.events()
            .publish((soroban_sdk::symbol_short!("staked"),), self);
    }
}

impl UnstakedEvent {
    #[allow(deprecated)]
    pub fn publish(self, env: &Env) {
        env.events()
            .publish((soroban_sdk::symbol_short!("unstkd"),), self);
    }
}

impl RewardsClaimedEvent {
    #[allow(deprecated)]
    pub fn publish(self, env: &Env) {
        env.events()
            .publish((soroban_sdk::symbol_short!("reward"),), self);
    }
}

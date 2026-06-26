#![no_std]

mod contract;
mod events;
mod storage;
mod types;

#[cfg(test)]
mod test;

pub use contract::NftStaking;
pub use types::StakingError;

#[cfg(any(test, feature = "testutils"))]
pub use contract::NftStakingClient;

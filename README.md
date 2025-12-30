# Equorum Protocol

**Governance & Staking Protocol for Arbitrum One**

Equorum is a governance and staking protocol built on Arbitrum One. It provides on-chain governance with timelock security, dynamic staking rewards (1.0%-3.5% APY), and transparent token distribution.

> **Status:**  
> Early testing phase - deployed on mainnet with temporary admin controls for security.  
> External audit pending. Use at your own risk.

---

## 🚰 Get Free EQM Tokens!

**New users can claim free EQM tokens from our faucet!**

👉 **[Click here for Faucet Instructions](./FAUCET.md)** 👈

- **0.001 EQM per claim** (every 24 hours)
- **No registration required** - just connect your wallet
- **Claim directly on Arbiscan** - simple and secure

[Start claiming now →](https://arbiscan.io/address/0xDdeE4050738eDDBb2fdDF02470203C5Ca30858b7#writeContract)

---

## 🗺️ Product Roadmap

**Equorum is focused on users, not features.** We have 8 working contracts deployed on Arbitrum One. Our goal is to make them useful to real people.

👉 **[View Product Roadmap](./ROADMAP.md)** - See our 90-day plan to achieve product-market fit

**Q1 2025 Goals:**
- 🎯 50+ active stakers
- 🗳️ Complete first governance cycle
- 💬 30+ user interviews
- 📊 Data-driven product decisions
- ✅ Build what users actually need

---

## Table of Contents

- [Get Free Tokens](#-get-free-eqm-tokens)
- [Roadmap](#-product-roadmap)
- [Features](#features)
- [Architecture](#architecture)
- [Contracts](#contracts)
- [Installation](#installation)
- [Deployment](#deployment)
- [Testing](#testing)
- [Security](#security)
- [License](#license)

---

## Features

### Core Functionality
- **ERC20 Token** - Fixed supply of 48M EQM tokens
- **Staking** - Dynamic APY (1.0%-3.5%) with 7-day cooldown
- **Governance** - On-chain voting with 48h TimeLock
- **Founder Vesting** - 72-month linear vesting (6.25% of supply)

### Arbitrum L2 Optimizations
- Compact storage layout
- Minimal cross-contract calls
- Efficient event emission
- Gas-optimized operations
- Non-upgradeable contracts (no proxy pattern)

### Security Features
- **Admin Controls (Temporary):** Pause and blacklist for emergencies
- **Planned:** Transfer ownership to governance or renounce
- ReentrancyGuard on all state-changing functions
- TimeLock for governance actions (48h delay)
- Withdrawal mechanisms with cooldowns

---

## Architecture

```
Equorum/
├── EquorumToken.sol              - Main ERC20 token
├── EquorumStaking.sol            - Staking with dynamic APY
├── EquorumGovernance.sol         - On-chain governance
├── TimeLock.sol                  - Timelock for security
├── EquorumGenesisVesting.sol     - Founder vesting
├── EquorumFaucetDistributor.sol  - Community distribution
├── EquorumLiquidityManager.sol   - Liquidity management
└── EquorumReserveManager.sol     - Reserve management
```

**Total: 8 contracts**

---

## Contracts

### 1. EquorumToken.sol
Main ERC20 token with fixed supply and distribution logic.

**Key Features:**
- Fixed supply: 48,000,000 EQM
- Automatic distribution on deployment
- Pausable for emergencies
- Blacklist functionality
- Immutable (no upgradability)

**Token Distribution:**
```
38.0M  (79.17%) → Staking rewards (distributed over time)
4.0M   (8.33%)  → ICO/Sale (not launched)
3.0M   (6.25%)  → Founder allocation (72-month vesting)
2.256M (4.70%)  → Faucet distribution
500K   (1.04%)  → Initial liquidity
122K   (0.25%)  → Foundation reserve
122K   (0.25%)  → Corporate reserve
```

### 2. EquorumStaking.sol
**DYNAMIC APY** staking system (like central bank regulating interest rates).

**Key Features:**
- **Dynamic APY: 1.0% - 3.5%** (auto-regulated every 30 days)
- **Low utilization (<25%)** → APY 3.5% (incentivize staking)
- **High utilization (>75%)** → APY 1.5% (control inflation)
- **Medium utilization (25-75%)** → APY 2.5% (balanced)
- Cooldown period: 7 days
- Withdrawal with cooldown
- Reward calculation per second
- Anyone can trigger APY adjustment (decentralized)

**Innovation:**
- Works like FED/ECB regulating interest rates
- Sustainable tokenomics (no 1000% APY scams)
- Predictable 30-day adjustment periods
- Transparent and automatic
- Withdrawal available when paused

### 3. EquorumGovernance.sol
On-chain governance with proposal and voting system.

**Key Features:**
- Proposal threshold: 10,000 EQM
- Voting period: 7 days
- Quorum: 4% of total supply
- 1 token = 1 vote
- Execution via TimeLock

### 4. TimeLock.sol
Security mechanism for delayed execution.

**Key Features:**
- Minimum delay: 48 hours
- Queue → Execute pattern
- Cancellation allowed
- Grace period: 7 days

### 5. EquorumGenesisVesting.sol
Vesting contract for founder allocation.

**Key Features:**
- Total allocation: 3M EQM (6.25% of supply)
- Duration: 72 months (6 years)
- Monthly release: ~41,666.67 EQM (linear vesting)
- Withdrawal with 48h delay
- Manual release for missed months

**Security:**
- Immutable vesting schedule (cannot be changed)
- No admin functions to stop vesting
- Genesis wallet excluded from governance voting
- Genesis wallet excluded from staking
- Standard founder allocation (similar to Bitcoin, Ethereum)

---

## Installation

### Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0
- Git

### Steps

1. **Clone the repository**
```bash
cd EquorumV2
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
# Edit .env file with your values
nano .env
```

4. **Compile contracts**
```bash
npm run compile
```

---

## Deployment

### Local Deployment (Testing)

1. **Start local node**
```bash
npm run node
```

2. **Deploy to local network**
```bash
npm run deploy:local
```

### Arbitrum Sepolia (Testnet)

1. **Get testnet ETH**
   - Bridge ETH to Arbitrum Sepolia: https://bridge.arbitrum.io/

2. **Deploy to testnet**
```bash
npm run deploy:arbitrum-sepolia
```

3. **Verify contracts**
```bash
npx hardhat verify --network arbitrumSepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

### Arbitrum One (Mainnet)

1. **Prepare deployment addresses**
   - Update `.env` with all required addresses
   - Double-check all parameters

2. **Deploy to mainnet**
```bash
npm run deploy:arbitrum
```

3. **Verify contracts**
```bash
npm run verify:arbitrum <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

---

## Deployment Order

**IMPORTANT:** Deploy contracts in this exact order:

```bash
1. EquorumToken
   constructor(icoAddress, liquidityAddress)

2. EquorumGenesisVesting
   constructor(equorumTokenAddress, genesisAddress)

3. EquorumStaking
   constructor(equorumTokenAddress, genesisVestingAddress)

4. TimeLock
   constructor(adminAddress) # Can be multisig

5. EquorumGovernance
   constructor(equorumTokenAddress, timeLockAddress, genesisVestingAddress)

6. Configure EquorumToken:
   token.setStakingContract(stakingAddress)
   token.setGenesisVesting(vestingAddress)
   token.setFaucetContract(faucetAddress)      # If applicable
   token.setFoundationAddress(foundationAddress)
   token.setCorporateAddress(corporateAddress)

7. Transfer ownership:
   token.transferOwnership(timeLockAddress)    # For governance control
```

---

## Testing

### Run all tests
```bash
npm test
```

### Run with gas reporting
```bash
npm run test:gas
```

### Test coverage
```bash
npx hardhat coverage
```

---

## Security

### Audits
- **External audit:** Not yet completed
- **Internal review:** Completed
- **OpenZeppelin:** Standard contracts used

**Warning:** Protocol has not been professionally audited. Use at your own risk.

### Security Features
1. **Non-Upgradeable** - No proxy pattern, no upgradability
2. **ReentrancyGuard** - Protection against reentrancy attacks
3. **Pausable** - Owner can pause in emergencies (temporary)
4. **TimeLock** - 48-hour delay for governance actions
5. **Blacklist** - Owner can block malicious actors (temporary)

**Admin Controls:**
- Current: Owner has pause and blacklist capabilities
- Planned: Transfer to governance or renounce ownership
- Transparent: All actions emit on-chain events

### Best Practices
- Follow CEI pattern (Checks-Effects-Interactions)
- Use SafeMath (built-in Solidity 0.8.20)
- Minimal external calls
- Comprehensive event logging
- Input validation on all functions

---

## Gas Optimization

### Arbitrum L2 Optimizations
- **Immutable variables** - Gas savings on reads
- **Compact storage** - Efficient slot packing
- **Minimal SLOAD/SSTORE** - Reduced storage operations
- **Efficient loops** - Optimized iterations
- **Event-driven** - Minimal on-chain data

### Estimated Gas Costs (Arbitrum L2)
```
Token Transfer:       ~50,000 gas
Stake:               ~100,000 gas
Unstake:             ~120,000 gas
Claim Rewards:        ~80,000 gas
Create Proposal:     ~150,000 gas
Vote:                 ~70,000 gas
```

---

## What's Next

**We're focused on product-market fit, not features.**

### Next 30 Days
- Get 50+ people staking
- Complete first governance proposal
- Interview 30+ DeFi users
- Learn what people actually need

### After That
- Build what users tell us they want
- Fix what users tell us is broken
- Improve based on real feedback
- Scale what works

**No new contracts until we have 50 active users.**

See [NEXT_STEPS.md](./NEXT_STEPS.md) for detailed plan.

---

## Contract Addresses

### Arbitrum One (Mainnet)
```
EquorumToken:            0xc735AbB9121A1eEdAAfB7D86AA4472c48e23cAB0
EquorumGenesisVesting:   0x736f48BB9844d7CFa52Bb1E7665112f9CB06A5Fe
EquorumStaking:          0xf7DB92f37308A19b0C985775d414789f2B9ecAf2
EquorumFaucetDistributor: 0xDdeE4050738eDDBb2fdDF02470203C5Ca30858b7
EquorumLiquidityManager: 0xBe26AD2F8E4726Ca95A3395E704D99f79833A018
EquorumReserveManager:   0xC44F174a1450b698F6718e61bfda41B171B2d101
TimeLock:                0x7fA6918BeC19F09BB14b017C11DF25FD7a953a84
EquorumGovernance:       0xF4cCaCd8d81488592b86e6A6BF54902508a05Ab3
```

---

## Contributing

We welcome contributions! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Write tests for new features
4. Ensure all tests pass
5. Submit a pull request

---

## License

MIT License - see [LICENSE](LICENSE) file for details

---

## Disclaimer

**IMPORTANT:** This protocol is in early testing phase with temporary admin controls. It has NOT been externally audited. The owner can pause transfers and blacklist addresses. Use at your own risk.

This software is provided "as is", without warranty of any kind. Always conduct your own research before using.

---

**Built for the Arbitrum ecosystem**

# Equorum Protocol

**Minimalist DeFi Protocol for Arbitrum L2**

Equorum is a streamlined, gas-optimized DeFi protocol built specifically for Arbitrum Layer 2. It provides essential functionality for token distribution, staking, governance, and vesting with a focus on security, efficiency, and immutability.

> **Note:**  
> This protocol is in early stage.  
> Contracts are live on Arbitrum One but governance and liquidity are still bootstrapping.

---

## Table of Contents

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
- **Staking** - Fixed 2.5% APY with 7-day cooldown
- **Governance** - On-chain voting with TimeLock security
- **Genesis Vesting** - 72-month vesting schedule for founders

### Arbitrum L2 Optimizations
- Compact storage layout
- Minimal cross-contract calls
- Efficient event emission
- Gas-optimized operations
- Immutable by design (no upgradability)

### Security Features
- Pausable transfers (emergency)
- Blacklist functionality
- ReentrancyGuard on all state-changing functions
- TimeLock for governance actions (48h delay)
- Emergency withdrawal mechanisms

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
38.0M  (79.17%) → Staking rewards
4.0M   (8.33%)  → ICO/Sale
3.0M   (6.25%)  → Genesis vesting (72 months)
2.256M (4.70%)  → Faucet
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
- Emergency withdrawal
- Reward calculation per second
- Anyone can trigger APY adjustment (decentralized)

**Innovation:**
- Works like FED/ECB regulating interest rates
- Sustainable tokenomics (no 1000% APY scams)
- Predictable 30-day adjustment periods
- Transparent and automatic
- Emergency withdrawal (when paused)

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
**IMMUTABLE** vesting contract for founder allocation (payment for development).

**Key Features:**
- Total allocation: 3M EQM (6.25% of supply)
- Duration: 72 months (6 years)
- Monthly release: ~41,666.67 EQM (automatic)
- Month 72: Releases remaining balance to complete exactly 3M
- Emergency withdrawal (48h delay)
- Manual release for missed months

**Security & Anti-Manipulation:**
- 100% IMMUTABLE - Cannot be changed after deployment
- NO admin functions - No one can stop vesting
- Genesis CANNOT vote in governance
- Genesis CANNOT stake tokens
- Genesis ONLY receives vested tokens as payment

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
- Pending professional audit
- Internal security review completed
- OpenZeppelin contracts used

### Security Features
1. **Immutable Contracts** - No upgradability, no admin backdoors
2. **ReentrancyGuard** - Protection against reentrancy attacks
3. **Pausable** - Emergency pause functionality
4. **TimeLock** - 48-hour delay for governance actions
5. **Blacklist** - Ability to block malicious actors

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

## Future Enhancements

The architecture allows for gradual feature additions:

### Phase 2 (Months 2-3)
- Staking boost multipliers
- Referral system
- Collective delegation pools

### Phase 3 (Months 4-6)
- EQCON price protection system
- Quantum-resistant security
- Advanced oracle integration

### Phase 4 (Months 7+)
- Token recycling mechanism
- Liquidity mining
- NFT tier system

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

This software is provided "as is", without warranty of any kind. Use at your own risk. Always conduct your own research and audit before deploying to mainnet.

---

**Built for the Arbitrum ecosystem**

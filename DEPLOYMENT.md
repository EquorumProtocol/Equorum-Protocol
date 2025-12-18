# 🚀 Equorum V2 Deployment Guide

## 📋 Pre-Deployment Checklist

### 1. Environment Setup
- [ ] Node.js v18+ installed
- [ ] Hardhat configured for Arbitrum
- [ ] Private key with sufficient ETH for gas
- [ ] Arbiscan API key for verification

### 2. Configuration
Create a `.env` file with:
```bash
PRIVATE_KEY=your_private_key_here
ARBISCAN_API_KEY=your_arbiscan_api_key
ICO_ADDRESS=0x... # Address to receive 4M tokens
LIQUIDITY_ADDRESS=0x... # Address to receive 3M tokens
GENESIS_ADDRESS=0x... # Address for genesis vesting (your MetaMask)
```

### 3. Network Configuration
Ensure `hardhat.config.js` has Arbitrum network:
```javascript
arbitrum: {
  url: "https://arb1.arbitrum.io/rpc",
  chainId: 42161,
  accounts: [process.env.PRIVATE_KEY]
}
```

---

## 🎯 Deployment Process

### Step 1: Run Tests
```bash
npx hardhat test
```
**Expected:** 278/280 tests passing (99.3%)

### Step 2: Deploy Contracts
```bash
npx hardhat run scripts/deploy.js --network arbitrum
```

**This will:**
1. Deploy EquorumToken (48M total supply)
2. Deploy EquorumGenesisVesting (3M tokens, 72-month vesting)
3. Deploy EquorumStaking (38M tokens for rewards)
4. Deploy TimeLock (48-hour delay)
5. Deploy EquorumGovernance (quadratic voting)
6. Configure all contract connections
7. Save deployment info to `deployment-arbitrum.json`

### Step 3: Verify Contracts
```bash
npx hardhat run scripts/verify.js --network arbitrum
```

**This will verify all 5 contracts on Arbiscan.**

---

## 📊 Token Distribution (48M EQM Total)

| Allocation | Amount | Percentage | Recipient |
|------------|--------|------------|-----------|
| Staking Rewards | 38,000,000 EQM | 79.17% | Staking Contract |
| ICO | 4,000,000 EQM | 8.33% | ICO_ADDRESS |
| Genesis Vesting | 3,000,000 EQM | 6.25% | GenesisVesting Contract |
| Faucet | 2,256,000 EQM | 4.70% | Faucet Contract |
| Liquidity | 500,000 EQM | 1.04% | LIQUIDITY_ADDRESS |
| Foundation | 122,000 EQM | 0.25% | Foundation Address |
| Corporate | 122,000 EQM | 0.25% | Corporate Address |

---

## 🔐 Security Features

### Genesis Vesting
- **3M tokens** locked in contract
- **72-month vesting** period
- **~41,666 EQM/month** release
- **48-hour emergency delay**
- **Immutable** - no owner, no pause

### Governance
- **Quadratic voting**: `voting_power = sqrt(token_balance)`
- **Quadratic quorum**: `quorum = sqrt(4% of supply)`
- **10,000 EQM** proposal threshold
- **7-day voting** period
- **48-hour timelock** for execution

### Staking
- **Dynamic APY**: 1.5% - 3.5% based on utilization
- **7-day cooldown** for unstaking
- **Genesis vesting excluded** from staking
- **Emergency pause** by owner

---

## ⚙️ Post-Deployment Steps

### 1. Transfer TimeLock Admin to Governance
The deployment script sets governance as pending admin. To complete:

1. Create a governance proposal:
```solidity
target: TIMELOCK_ADDRESS
value: 0
signature: "acceptAdmin()"
data: "0x"
```

2. Vote and execute the proposal
3. Governance now controls TimeLock

### 2. Verify Token Distribution
```bash
# Check balances
npx hardhat console --network arbitrum

> const token = await ethers.getContractAt("EquorumToken", "TOKEN_ADDRESS")
> await token.balanceOf("ICO_ADDRESS") // Should be 4M (8.33%)
> await token.balanceOf("LIQUIDITY_ADDRESS") // Should be 500K (1.04%)
> await token.balanceOf("VESTING_ADDRESS") // Should be 3M (6.25%)
> await token.balanceOf("STAKING_ADDRESS") // Should be 38M (79.17%)
> await token.balanceOf("TOKEN_ADDRESS") // Should be ~2.5M (Faucet + Foundation + Corporate)
```

### 3. Test Genesis Vesting
After 30 days, genesis address can claim first month:
```javascript
const vesting = await ethers.getContractAt("EquorumGenesisVesting", "VESTING_ADDRESS")
await vesting.connect(genesis).release()
// Should receive ~41,666 EQM
```

### 4. Test Governance
Create a test proposal:
```javascript
const gov = await ethers.getContractAt("EquorumGovernance", "GOV_ADDRESS")
await gov.propose(
  [target],
  [value],
  [signature],
  [calldata],
  "Test Proposal"
)
```

---

## 🔍 Contract Verification

All contracts will be verified on Arbiscan with:
- Source code
- Constructor arguments
- Compiler version
- Optimization settings

View at: `https://arbiscan.io/address/CONTRACT_ADDRESS`

---

## 🚨 Emergency Procedures

### If Genesis Vesting Needs Emergency Withdrawal
1. Call `requestEmergencyWithdraw()` from genesis address
2. Wait 48 hours
3. Call `emergencyWithdraw()` to receive all remaining tokens

### If Staking Needs Pause
1. Owner calls `pause()` on staking contract
2. Users can emergency withdraw their stakes
3. Owner calls `unpause()` when safe

### If Governance Proposal is Malicious
1. Community votes NO
2. If passed, wait for timelock delay
3. Admin can cancel via `cancelTransaction()` before execution

---

## 📈 Monitoring

### Key Metrics to Track
- Total staked tokens
- Current APY
- Active proposals
- Genesis vesting releases
- Token holder distribution

### Useful Commands
```bash
# Check staking stats
npx hardhat run scripts/check-staking.js --network arbitrum

# Check governance proposals
npx hardhat run scripts/check-governance.js --network arbitrum

# Check vesting status
npx hardhat run scripts/check-vesting.js --network arbitrum
```

---

## 🎯 Launch Checklist

- [ ] All tests passing (278/280)
- [ ] Contracts deployed to Arbitrum
- [ ] Contracts verified on Arbiscan
- [ ] Token distribution confirmed
- [ ] TimeLock admin transferred to Governance
- [ ] Test proposal created and executed
- [ ] Genesis vesting tested (after 30 days)
- [ ] Staking tested with real users
- [ ] Documentation published
- [ ] Community announcement
- [ ] Security audit scheduled

---

## 📞 Support

For issues or questions:
- GitHub: [Your Repo]
- Discord: [Your Discord]
- Email: [Your Email]

---

## 🔒 Security Audit

**IMPORTANT:** Schedule a professional security audit before mainnet launch:
- OpenZeppelin
- Trail of Bits
- Consensys Diligence
- Certik

Estimated cost: $20k - $50k
Timeline: 2-4 weeks

---

## 📝 Contract Addresses

After deployment, addresses will be saved to `deployment-arbitrum.json`:

```json
{
  "network": "arbitrum",
  "timestamp": "2024-12-12T...",
  "contracts": {
    "EquorumToken": "0x...",
    "EquorumGenesisVesting": "0x...",
    "EquorumStaking": "0x...",
    "TimeLock": "0x...",
    "EquorumGovernance": "0x..."
  }
}
```

---

## ⚠️ Important Notes

1. **Genesis Vesting**: Tokens are released to your MetaMask monthly. You must call `release()` each month.

2. **Quadratic Voting**: Large holders have less voting power per token. This prevents whale dominance.

3. **Staking Rewards**: 38M tokens allocated. APY adjusts automatically based on utilization.

4. **TimeLock**: All governance actions have a 48-hour delay for security.

5. **Immutability**: Genesis vesting has no owner and cannot be paused or upgraded.

---

## 🎉 Success Criteria

Deployment is successful when:
- ✅ All 5 contracts deployed
- ✅ All contracts verified on Arbiscan
- ✅ Token distribution matches specification
- ✅ Governance can create and execute proposals
- ✅ Staking accepts deposits and calculates rewards
- ✅ Genesis vesting releases monthly tokens
- ✅ TimeLock enforces 48-hour delay

**Good luck with your launch! 🚀**

# 🚰 Equorum Faucet - Free EQM Tokens

Get free EQM tokens to start using the Equorum Protocol on Arbitrum One!

---

## 📍 Quick Access

**Faucet Contract:** [`0xDdeE4050738eDDBb2fdDF02470203C5Ca30858b7`](https://arbiscan.io/address/0xDdeE4050738eDDBb2fdDF02470203C5Ca30858b7)

**Network:** Arbitrum One (Chain ID: 42161)

---

## 💧 How to Claim Free EQM

### Method 1: Via Arbiscan (Easiest)

1. **Go to the Faucet Contract on Arbiscan:**
   - Visit: https://arbiscan.io/address/0xDdeE4050738eDDBb2fdDF02470203C5Ca30858b7#writeContract

2. **Connect Your Wallet:**
   - Click "Connect to Web3"
   - Connect your MetaMask or other Web3 wallet

3. **Claim Tokens:**
   - Find function `1. claim`
   - Click "Write"
   - Confirm the transaction in your wallet
   - Wait for confirmation

4. **Done!**
   - You'll receive **0.001 EQM** in your wallet
   - Check your balance on Arbiscan or in your wallet

### Method 2: Via Smart Contract Interaction

If you're a developer, you can interact directly:

```javascript
// Using ethers.js
const faucetAddress = "0xDdeE4050738eDDBb2fdDF02470203C5Ca30858b7";
const faucet = await ethers.getContractAt("EquorumFaucetDistributor", faucetAddress);
await faucet.claim();
```

---

## 📋 Claim Requirements

To claim tokens, you must meet these requirements:

| Requirement | Value | Why? |
|-------------|-------|------|
| **Minimum ETH Balance** | 0.001 ETH | Proves you're a real user with gas |
| **Account Age** | ~1 hour | Prevents instant bot attacks |
| **Cooldown Period** | 24 hours | One claim per day |
| **Not a Contract** | EOA only | Prevents automated abuse |

---

## 🎯 Faucet Limits

| Limit | Value | Purpose |
|-------|-------|---------|
| **Per Claim** | 0.001 EQM | Micro amounts for sustainability |
| **Per User (Lifetime)** | 0.05 EQM | Maximum you can ever claim |
| **Daily Global** | 10 EQM | Total distributed per day |
| **Total Allocation** | 2,256,000 EQM | Faucet will last ~618 years |

---

## ❓ Frequently Asked Questions

### Why such small amounts?

The faucet is designed for **long-term sustainability**. With 0.001 EQM per claim and a 24-hour cooldown, the 2.256M EQM allocation can serve millions of users over many years.

### Can I claim multiple times?

Yes! You can claim once every **24 hours** until you reach the lifetime limit of **0.05 EQM**.

### Why do I need ETH?

The 0.001 ETH minimum balance requirement:
- Proves you're a real user (not a bot)
- Ensures you can pay gas fees on Arbitrum
- Prevents Sybil attacks

### I don't have ETH on Arbitrum, how do I get it?

You can bridge ETH to Arbitrum using:
- [Arbitrum Bridge](https://bridge.arbitrum.io/)
- [Hop Protocol](https://app.hop.exchange/)
- [Synapse Protocol](https://synapseprotocol.com/)

Or buy directly on centralized exchanges that support Arbitrum withdrawals.

### What can I do with 0.001 EQM?

Even small amounts let you:
- Test the protocol
- Participate in governance (if you accumulate enough)
- Learn about DeFi on Arbitrum
- Get familiar with EQM before buying more

### How do I check if I can claim?

Visit the faucet contract on Arbiscan and use the `canUserClaim` function in the "Read Contract" tab:
https://arbiscan.io/address/0xDdeE4050738eDDBb2fdDF02470203C5Ca30858b7#readContract

### Error: "CooldownActive"

You claimed recently. Wait 24 hours between claims.

### Error: "InsufficientETHBalance"

You need at least 0.001 ETH in your wallet on Arbitrum One.

### Error: "AccountTooNew"

Your address needs to exist for ~1 hour on Arbitrum before claiming.

### Error: "UserLimitExceeded"

You've reached the lifetime limit of 0.05 EQM per address.

### Error: "DailyLimitExceeded"

The faucet has distributed 10 EQM today. Try again tomorrow.

---

## 🔒 Security Features

The faucet includes multiple anti-abuse protections:

- ✅ **Contract Blocking:** Only EOAs can claim
- ✅ **Minimum Balance:** Requires 0.001 ETH
- ✅ **Account Age:** ~1 hour minimum
- ✅ **Cooldown System:** 24 hours between claims
- ✅ **User Limits:** 0.05 EQM lifetime cap
- ✅ **Daily Limits:** 10 EQM global daily cap
- ✅ **Blacklist System:** Malicious actors can be blocked
- ✅ **Pausable:** Emergency stop capability

---

## 📊 Check Your Stats

You can view your faucet statistics on Arbiscan:

1. Go to: https://arbiscan.io/address/0xDdeE4050738eDDBb2fdDF02470203C5Ca30858b7#readContract
2. Use function `getUserStats` with your address
3. You'll see:
   - Last claim time
   - Total claimed amount
   - Remaining allowance
   - Blacklist/whitelist status

---

## 🌐 Add EQM to Your Wallet

After claiming, add the EQM token to your wallet:

**Token Contract:** `0xc735AbB9121A1eEdAAfB7D86AA4472c48e23cAB0`

### MetaMask:
1. Open MetaMask
2. Click "Import tokens"
3. Paste: `0xc735AbB9121A1eEdAAfB7D86AA4472c48e23cAB0`
4. Symbol: `EQM`
5. Decimals: `18`

---

## 📈 What's Next?

After getting your free EQM:

1. **Stake Your Tokens**
   - Earn rewards by staking
   - Participate in governance
   - Contract: `0xf7DB92f37308A19b0C985775d414789f2B9ecAf2`

2. **Join the Community**
   - Discord: [Coming Soon]
   - Twitter: [Coming Soon]
   - GitHub: https://github.com/EquorumProtocol/Equorum-Protocol

3. **Read the Whitepaper**
   - Learn about tokenomics
   - Understand governance
   - View: [WHITEPAPER.md](./WHITEPAPER.md)

---

## 🛠️ For Developers

### Contract ABI

The full ABI is available on Arbiscan:
https://arbiscan.io/address/0xDdeE4050738eDDBb2fdDF02470203C5Ca30858b7#code

### Key Functions

```solidity
// Claim tokens
function claim() external;

// Check if you can claim
function canUserClaim(address user) external view returns (bool canClaim, uint256 timeUntilNext);

// Get your stats
function getUserStats(address user) external view returns (
    uint256 lastClaimTime,
    uint256 totalClaimedAmount,
    uint256 remainingAllowance,
    bool isBlacklisted,
    bool isWhitelisted
);

// Get faucet stats
function getFaucetStats() external view returns (
    uint256 totalDist,
    uint256 dailyDist,
    uint256 remaining,
    uint256 lastReset,
    bool isPaused,
    bool isWhitelistMode
);
```

---

## 📞 Support

Having issues? 

1. Check the [FAQ section](#-frequently-asked-questions) above
2. Verify you meet all [requirements](#-claim-requirements)
3. Check your [stats](#-check-your-stats) on Arbiscan
4. Open an issue on [GitHub](https://github.com/EquorumProtocol/Equorum-Protocol/issues)

---

## ⚠️ Important Notes

- **This is a testnet-style faucet on mainnet** - amounts are intentionally small
- **Not for profit** - use exchanges if you want to acquire significant amounts
- **Educational purpose** - designed to let users test the protocol
- **Fair distribution** - strict limits ensure everyone gets a chance
- **Long-term sustainability** - designed to last for years

---

**Happy claiming! 🎉**

*Equorum Protocol - Minimalist DeFi on Arbitrum One*

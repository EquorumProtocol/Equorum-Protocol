# Genesis Allocation - Founder Compensation

## What is "Genesis" in Equorum?

**Genesis refers to the FOUNDER ALLOCATION.**

The term "Genesis" in Equorum contracts refers to the **founder's wallet** that receives compensation for developing the Equorum Protocol. This is standard practice in cryptocurrency projects.

---

## Why "Genesis"?

The name "Genesis" comes from being the **first wallet to receive real EQM tokens** after deployment. It represents the beginning of the protocol.

**Similar to:**
- **Bitcoin:** Satoshi Nakamoto mined the genesis block and received the first BTC
- **Ethereum:** Founders received ETH allocation for development
- **Uniswap:** Team received UNI tokens for building the protocol

**Genesis = Founder Compensation. Nothing more, nothing less.**

---

## Genesis Allocation Details

### Contract Address
```
EquorumGenesisVesting: 0x736f48BB9844d7CFa52Bb1E7665112f9CB06A5Fe
```

### Beneficiary (Founder Wallet)
```
Genesis Wallet: 0xE47e15833eF9Ea4280C030c0663caA19fd94842C
```

### Allocation
- **Total:** 3,000,000 EQM (6.25% of total supply)
- **Vesting Period:** 72 months (6 years)
- **Monthly Release:** ~41,666.67 EQM
- **Type:** Linear vesting (no cliff)

### Vesting Schedule
```
Month 1:  ~41,666.67 EQM
Month 2:  ~41,666.67 EQM
...
Month 72: Remaining balance to complete exactly 3M EQM
```

---

## Why 6.25%? Why 72 Months?

### Industry Standard

**Founder allocations in major crypto projects:**

| Project | Founder Allocation | Vesting |
|---------|-------------------|---------|
| Bitcoin | ~5% (Satoshi) | No vesting |
| Ethereum | ~12% (Foundation) | No vesting |
| Uniswap | 21.5% (Team) | 4 years |
| Aave | 23% (Team) | 3 years |
| **Equorum** | **6.25% (Founder)** | **6 years** |

**Equorum has:**
- ✅ Lower allocation than most projects (6.25% vs 12-23%)
- ✅ Longer vesting than most projects (6 years vs 3-4 years)
- ✅ Linear vesting (no large unlocks)

### Why 72 Months?

**6 years of vesting ensures:**
1. Long-term alignment with protocol success
2. Founder cannot dump tokens immediately
3. Gradual release prevents market impact
4. Demonstrates commitment to the project

---

## Transparency & Security

### What Genesis Wallet CAN Do
- ✅ Receive vested tokens monthly
- ✅ Withdraw vested tokens (with 48h delay)
- ✅ Transfer tokens to other wallets

### What Genesis Wallet CANNOT Do
- ❌ Vote in governance (excluded by design)
- ❌ Stake tokens (excluded by design)
- ❌ Stop or modify vesting (immutable contract)
- ❌ Receive tokens faster (linear schedule is hardcoded)

### Contract Security
- **Immutable:** Vesting schedule cannot be changed
- **No admin functions:** No one can stop or modify vesting
- **Transparent:** All releases are on-chain and publicly visible
- **Auditable:** Contract code is verified on Arbiscan

---

## Why Exclude Genesis from Governance?

**To prevent centralization and ensure fair governance:**

1. **Governance Power:** 3M EQM would give founder significant voting power
2. **Conflict of Interest:** Founder should not control protocol decisions alone
3. **Community First:** Governance should be driven by token holders, not founders
4. **Industry Best Practice:** Many protocols exclude founder allocations from voting

**Genesis wallet is ONLY for compensation, not for governance control.**

---

## Common Questions

### Q: Is this a scam?
**A: No.** Founder allocations are standard in crypto. Bitcoin's Satoshi has ~5%, Ethereum founders had ~12%, Uniswap team has 21.5%. Equorum's 6.25% is below industry average.

### Q: Why not 0% for founders?
**A: Someone has to build the protocol.** Development takes time, money, and expertise. Founder allocation is compensation for this work, just like any job.

### Q: Can the founder dump all tokens?
**A: No.** Vesting is linear over 72 months. Maximum release per month is ~41,666 EQM. This prevents large dumps and ensures gradual distribution.

### Q: Why is it called "Genesis" and not "Founder"?
**A: Historical naming.** The wallet was named "Genesis" because it was the first to receive real EQM tokens. The name stuck. It simply means "founder allocation."

### Q: Can the vesting be stopped?
**A: No.** The contract is immutable. No one (not even the founder) can stop or modify the vesting schedule once deployed.

### Q: What if the founder leaves the project?
**A: Vesting continues.** The contract is immutable and will continue releasing tokens regardless of founder involvement. This is by design.

---

## Verification

### View Contract on Arbiscan
```
https://arbiscan.io/address/0x736f48BB9844d7CFa52Bb1E7665112f9CB06A5Fe
```

### View Beneficiary Wallet
```
https://arbiscan.io/address/0xE47e15833eF9Ea4280C030c0663caA19fd94842C
```

### Check Vesting Progress
1. Go to contract on Arbiscan
2. Click "Read Contract"
3. Call `releasableAmount()` to see available tokens
4. Call `released()` to see total released so far

---

## Conclusion

**Genesis = Founder Allocation. Period.**

- ✅ Standard practice in crypto (Bitcoin, Ethereum, Uniswap all have it)
- ✅ 6.25% is below industry average
- ✅ 72-month vesting is longer than most projects
- ✅ Excluded from governance to prevent centralization
- ✅ Immutable contract (cannot be changed)
- ✅ Fully transparent and auditable on-chain

**This is compensation for building the protocol, not a scam or hidden allocation.**

---

**Last Updated:** December 30, 2025  
**Status:** Deployed on Arbitrum One Mainnet  
**Contract:** Verified and Immutable

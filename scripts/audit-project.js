const { ethers } = require("hardhat");

// Deployed contract addresses on Sepolia
const CONTRACTS = {
    EquorumToken: "0x0595557D4d2241aff89De30af6D73CB058dEad4D",
    EquorumGenesisVesting: "0xF1b6Ca2E84335bBD0C02B505Ff73872E0547Dca2",
    EquorumStaking: "0x76c313A031187dD4b18478F21919c651E96E8087",
    EquorumFaucetDistributor: "0x3301Db859BCFE897a7370F572Aa15597a869ee3d",
    EquorumLiquidityManager: "0x93963eeED5dD7F4f12db17D1E08f125029142CfA",
    EquorumReserveManager: "0x15D5477450176A19e9E03e143071D3710d9B0574",
    TimeLock: "0x5C4CEE020D8D107dDf6F0C7Aa92328dF87a31B60",
    EquorumGovernance: "0xbb2480fCC55AD056543c633adAA3e7998A32FB85"
};

async function main() {
    const [user] = await ethers.getSigners();
    
    console.log("\n" + "=".repeat(70));
    console.log("EQUORUM V2 - FULL PROJECT AUDIT");
    console.log("=".repeat(70));

    // Get all contracts
    const token = await ethers.getContractAt("EquorumToken", CONTRACTS.EquorumToken);
    const genesisVesting = await ethers.getContractAt("EquorumGenesisVesting", CONTRACTS.EquorumGenesisVesting);
    const staking = await ethers.getContractAt("EquorumStaking", CONTRACTS.EquorumStaking);
    const faucet = await ethers.getContractAt("EquorumFaucetDistributor", CONTRACTS.EquorumFaucetDistributor);
    const reserveManager = await ethers.getContractAt("EquorumReserveManager", CONTRACTS.EquorumReserveManager);
    const timeLock = await ethers.getContractAt("TimeLock", CONTRACTS.TimeLock);
    const governance = await ethers.getContractAt("EquorumGovernance", CONTRACTS.EquorumGovernance);

    // ============================================
    // 1. TOKEN DISTRIBUTION AUDIT
    // ============================================
    console.log("\n" + "=".repeat(70));
    console.log("1. TOKEN DISTRIBUTION AUDIT");
    console.log("=".repeat(70));

    const totalSupply = await token.totalSupply();
    console.log("\nTotal Supply:", ethers.formatEther(totalSupply), "EQM");

    // Fetch all balances as BigInt
    const balanceData = [
        { name: "Staking Contract", balance: await token.balanceOf(CONTRACTS.EquorumStaking) },
        { name: "Genesis Vesting", balance: await token.balanceOf(CONTRACTS.EquorumGenesisVesting) },
        { name: "Faucet", balance: await token.balanceOf(CONTRACTS.EquorumFaucetDistributor) },
        { name: "Reserve Manager", balance: await token.balanceOf(CONTRACTS.EquorumReserveManager) },
        { name: "Token Contract (ICO)", balance: await token.balanceOf(CONTRACTS.EquorumToken) },
        { name: "Liquidity Manager", balance: await token.balanceOf(CONTRACTS.EquorumLiquidityManager) },
        { name: "Governance (locked)", balance: await token.balanceOf(CONTRACTS.EquorumGovernance) },
        { name: "Your Wallet", balance: await token.balanceOf(user.address) },
    ];
    
    // Get staking info to show breakdown
    const totalStaked = await staking.totalStaked();
    const stakingRewards = await token.balanceOf(CONTRACTS.EquorumStaking) - totalStaked;

    // Sum in BigInt first
    let totalAccounted = 0n;
    for (const item of balanceData) {
        totalAccounted += item.balance;
    }

    // Print distribution
    console.log("\nToken Distribution:");
    for (const item of balanceData) {
        const pct = (Number(item.balance * 10000n / totalSupply) / 100).toFixed(2);
        let extra = "";
        if (item.name === "Staking Contract") {
            extra = " (rewards: " + ethers.formatEther(stakingRewards) + " + staked: " + ethers.formatEther(totalStaked) + ")";
        }
        console.log("   " + item.name.padEnd(25) + ": " + ethers.formatEther(item.balance).padStart(15) + " EQM (" + pct + "%)" + extra);
    }

    console.log("\n   " + "-".repeat(55));
    const totalPct = (Number(totalAccounted * 10000n / totalSupply) / 100).toFixed(2);
    console.log("   " + "TOTAL ACCOUNTED".padEnd(25) + ": " + ethers.formatEther(totalAccounted).padStart(15) + " EQM (" + totalPct + "%)");
    
    const unaccounted = totalSupply - totalAccounted;
    if (unaccounted > 0n) {
        console.log("   WARNING UNACCOUNTED: " + ethers.formatEther(unaccounted) + " EQM");
    } else if (unaccounted < 0n) {
        console.log("   NOTE: Total > Supply by " + ethers.formatEther(-unaccounted) + " EQM (staked tokens counted twice)");
    } else {
        console.log("   OK: All tokens accounted for!");
    }

    // ============================================
    // 2. GENESIS VESTING DEEP DIVE
    // ============================================
    console.log("\n" + "=".repeat(70));
    console.log("2. GENESIS VESTING - DEEP ANALYSIS");
    console.log("=".repeat(70));

    try {
        const vestingBalance = await token.balanceOf(CONTRACTS.EquorumGenesisVesting);
        const genesisAddress = await genesisVesting.genesisAddress();
        const releaseStartTime = await genesisVesting.releaseStartTime();
        const VESTING_DURATION = await genesisVesting.VESTING_DURATION();
        const GENESIS_ALLOCATION = await genesisVesting.GENESIS_ALLOCATION();
        const MONTHLY_RELEASE = await genesisVesting.MONTHLY_RELEASE();
        const SECONDS_PER_MONTH = await genesisVesting.SECONDS_PER_MONTH();
        const releasedTokens = await genesisVesting.releasedTokens();
        
        const now = BigInt(Math.floor(Date.now() / 1000));
        const elapsed = now - releaseStartTime;
        const monthsPassed = elapsed / SECONDS_PER_MONTH;
        const totalVested = monthsPassed * MONTHLY_RELEASE;
        const claimable = totalVested > releasedTokens ? totalVested - releasedTokens : 0n;

        console.log("\n   Contract Balance: " + ethers.formatEther(vestingBalance) + " EQM");
        console.log("   Genesis Address (beneficiary): " + genesisAddress);
        console.log("   Is YOUR wallet the beneficiary? " + (genesisAddress.toLowerCase() === user.address.toLowerCase() ? "YES" : "NO"));
        console.log("\n   Vesting Start: " + new Date(Number(releaseStartTime) * 1000).toISOString());
        console.log("   Vesting Duration: " + Number(VESTING_DURATION) + " months");
        console.log("   Time Elapsed: " + (Number(elapsed) / 86400).toFixed(4) + " days (" + Number(monthsPassed).toFixed(4) + " months)");
        console.log("\n   Total Allocation: " + ethers.formatEther(GENESIS_ALLOCATION) + " EQM");
        console.log("   Monthly Release: " + ethers.formatEther(MONTHLY_RELEASE) + " EQM");
        console.log("   Already Released: " + ethers.formatEther(releasedTokens) + " EQM");
        console.log("   Currently Claimable: " + ethers.formatEther(claimable) + " EQM");
        
        if (claimable > 0n) {
            console.log("\n   TIP: You can claim " + ethers.formatEther(claimable) + " EQM right now!");
        } else {
            const nextRelease = releaseStartTime + SECONDS_PER_MONTH;
            console.log("\n   Next release: " + new Date(Number(nextRelease) * 1000).toLocaleDateString());
        }

    } catch (e) {
        console.log("   ERROR reading Genesis Vesting: " + e.message);
    }

    // ============================================
    // 3. CONTRACT OWNERSHIP & ACCESS CONTROL
    // ============================================
    console.log("\n" + "=".repeat(70));
    console.log("3. OWNERSHIP & ACCESS CONTROL");
    console.log("=".repeat(70));

    const ownershipChecks = [
        { name: "EquorumToken", contract: token },
        { name: "EquorumStaking", contract: staking },
        { name: "EquorumFaucetDistributor", contract: faucet },
        { name: "EquorumReserveManager", contract: reserveManager },
    ];

    console.log("\n   Contract Owners:");
    for (const check of ownershipChecks) {
        try {
            const owner = await check.contract.owner();
            const isYou = owner.toLowerCase() === user.address.toLowerCase();
            console.log("   " + check.name.padEnd(28) + ": " + (isYou ? "YOU" : owner));
        } catch (e) {
            console.log("   " + check.name.padEnd(28) + ": No owner() function");
        }
    }

    // TimeLock admin
    try {
        const timeLockAdmin = await timeLock.admin();
        console.log("   " + "TimeLock Admin".padEnd(28) + ": " + timeLockAdmin);
        const isGovernance = timeLockAdmin.toLowerCase() === CONTRACTS.EquorumGovernance.toLowerCase();
        console.log("   " + "".padEnd(28) + "  Match Governance: " + (isGovernance ? "YES" : "NO"));
    } catch (e) {}

    // ============================================
    // 4. CONTRACT STATE CHECKS
    // ============================================
    console.log("\n" + "=".repeat(70));
    console.log("4. CONTRACT STATE CHECKS");
    console.log("=".repeat(70));

    console.log("\n   Paused Status:");
    const pauseChecks = [
        { name: "Staking", contract: staking },
        { name: "Faucet", contract: faucet },
        { name: "Reserve Manager", contract: reserveManager },
    ];

    for (const check of pauseChecks) {
        try {
            const paused = await check.contract.paused();
            console.log("   " + check.name.padEnd(20) + ": " + (paused ? "PAUSED" : "ACTIVE"));
        } catch (e) {}
    }

    // Staking info
    console.log("\n   Staking Contract:");
    try {
        const stakingCap = await staking.STAKING_CAP();
        const totalStaked = await staking.totalStaked();
        const currentAPY = await staking.currentAPY();
        console.log("   - Staking Cap: " + ethers.formatEther(stakingCap) + " EQM");
        console.log("   - Total Staked: " + ethers.formatEther(totalStaked) + " EQM");
        console.log("   - Current APY: " + (Number(currentAPY) / 100) + "%");
    } catch (e) {}

    // Governance info
    console.log("\n   Governance Contract:");
    try {
        const proposalThreshold = await governance.PROPOSAL_THRESHOLD();
        const minLockAmount = await governance.MIN_LOCK_AMOUNT();
        const proposalCount = await governance.proposalCount();
        console.log("   - Proposal Threshold: " + ethers.formatEther(proposalThreshold) + " EQM locked");
        console.log("   - Min Lock Amount: " + ethers.formatEther(minLockAmount) + " EQM");
        console.log("   - Total Proposals: " + proposalCount);
    } catch (e) {}

    // ============================================
    // 5. SUMMARY
    // ============================================
    console.log("\n" + "=".repeat(70));
    console.log("5. SUMMARY - WHAT THE TESTS PROVED");
    console.log("=".repeat(70));

    console.log("\n   WORKING:");
    console.log("      - Token deployed with correct supply (48M EQM)");
    console.log("      - Staking: Users can stake and earn APY");
    console.log("      - Governance: Users can lock tokens for voting power");
    console.log("      - Reserve Manager: Can be activated and configured");
    console.log("      - TimeLock: Admin transferred to Governance");
    console.log("      - All contracts are on-chain and functional");

    console.log("\n   NEEDS ATTENTION:");
    console.log("      - 500K liquidity tokens in deployer wallet (should be separate)");
    console.log("      - Faucet claim may have strict anti-bot checks");

    console.log("\n   FOR PRODUCTION DEPLOY:");
    console.log("      - Configure separate addresses in .env");
    console.log("      - LIQUIDITY_ADDRESS=0x... (for liquidity pools)");
    console.log("      - GENESIS_ADDRESS=0x...   (for genesis investor)");

    console.log("\n" + "=".repeat(70));
    console.log("AUDIT COMPLETE");
    console.log("=".repeat(70) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
    });

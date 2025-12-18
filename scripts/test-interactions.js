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

// Helper to wait for tx confirmation
async function waitTx(tx, label) {
    console.log(`   ⏳ ${label}... (waiting for confirmation)`);
    const receipt = await tx.wait();
    console.log(`   ✅ ${label} confirmed! (block ${receipt.blockNumber})`);
    return receipt;
}

async function main() {
    const [user] = await ethers.getSigners();
    console.log("\n" + "=".repeat(60));
    console.log("🧪 EQUORUM V2 - INTERACTIVE TEST SUITE");
    console.log("=".repeat(60));
    console.log("\nYour wallet:", user.address);

    // Get contract instances
    const token = await ethers.getContractAt("EquorumToken", CONTRACTS.EquorumToken);
    const staking = await ethers.getContractAt("EquorumStaking", CONTRACTS.EquorumStaking);
    const faucet = await ethers.getContractAt("EquorumFaucetDistributor", CONTRACTS.EquorumFaucetDistributor);
    const reserveManager = await ethers.getContractAt("EquorumReserveManager", CONTRACTS.EquorumReserveManager);
    const governance = await ethers.getContractAt("EquorumGovernance", CONTRACTS.EquorumGovernance);

    // Check your balance
    const myBalance = await token.balanceOf(user.address);
    console.log("Your EQM balance:", ethers.formatEther(myBalance), "EQM");

    // ============================================
    // TEST 1: FAUCET
    // ============================================
    console.log("\n" + "-".repeat(60));
    console.log("📍 TEST 1: FAUCET DISTRIBUTOR");
    console.log("-".repeat(60));
    
    try {
        const faucetPaused = await faucet.paused();
        console.log("   Faucet paused:", faucetPaused);
        
        if (faucetPaused) {
            const tx = await faucet.activate();
            await waitTx(tx, "Activating faucet");
        }
        
        // Check if can claim
        const canClaim = await faucet.canUserClaim(user.address);
        console.log("   Can claim:", canClaim);
        
        if (canClaim) {
            const tx = await faucet.claim();
            await waitTx(tx, "Claiming from faucet");
        } else {
            console.log("   ⚠️  Cannot claim (cooldown or limit reached)");
        }
    } catch (e) {
        console.log("   ❌ Faucet error:", e.message?.slice(0, 100));
    }

    // ============================================
    // TEST 2: STAKING
    // ============================================
    console.log("\n" + "-".repeat(60));
    console.log("📍 TEST 2: STAKING");
    console.log("-".repeat(60));
    
    try {
        const stakingBalance = await token.balanceOf(CONTRACTS.EquorumStaking);
        console.log("   Staking pool balance:", ethers.formatEther(stakingBalance), "EQM");
        
        const currentAPY = await staking.currentAPY();
        console.log("   Current APY:", Number(currentAPY) / 100, "%");
        
        // Stake some tokens
        const stakeAmount = ethers.parseEther("1000");
        const userBalance = await token.balanceOf(user.address);
        
        if (userBalance >= stakeAmount) {
            // Approve first
            const approveTx = await token.approve(CONTRACTS.EquorumStaking, stakeAmount);
            await waitTx(approveTx, "Approving tokens for staking");
            
            // Then stake
            const stakeTx = await staking.stake(stakeAmount);
            await waitTx(stakeTx, "Staking 1000 EQM");
            
            const userStake = await staking.getUserInfo(user.address);
            console.log("   Your staked amount:", ethers.formatEther(userStake.stakedAmount), "EQM");
        } else {
            console.log("   ⚠️  Not enough balance to stake (need 1000 EQM)");
        }
    } catch (e) {
        console.log("   ❌ Staking error:", e.message?.slice(0, 100));
    }

    // ============================================
    // TEST 3: GOVERNANCE - LOCK TOKENS
    // ============================================
    console.log("\n" + "-".repeat(60));
    console.log("📍 TEST 3: GOVERNANCE - LOCK TOKENS FOR VOTING");
    console.log("-".repeat(60));
    
    try {
        const minLock = await governance.MIN_LOCK_AMOUNT();
        console.log("   Minimum lock amount:", ethers.formatEther(minLock), "EQM");
        
        const lockAmount = ethers.parseEther("500");
        const userBalance = await token.balanceOf(user.address);
        
        if (userBalance >= lockAmount) {
            // Approve first
            const approveTx = await token.approve(CONTRACTS.EquorumGovernance, lockAmount);
            await waitTx(approveTx, "Approving tokens for governance");
            
            // Then lock
            const lockTx = await governance.lock(lockAmount);
            await waitTx(lockTx, "Locking 500 EQM for voting");
            
            const lockInfo = await governance.getLockInfo(user.address);
            console.log("   Your locked amount:", ethers.formatEther(lockInfo.amount), "EQM");
            console.log("   Your voting power:", ethers.formatEther(lockInfo.votingPower), "votes (quadratic)");
        } else {
            console.log("   ⚠️  Not enough balance to lock");
        }
    } catch (e) {
        console.log("   ❌ Governance error:", e.message?.slice(0, 100));
    }

    // ============================================
    // TEST 4: RESERVE MANAGER
    // ============================================
    console.log("\n" + "-".repeat(60));
    console.log("📍 TEST 4: RESERVE MANAGER");
    console.log("-".repeat(60));
    
    try {
        const reserveStats = await reserveManager.getReserveStats();
        console.log("   Foundation remaining:", ethers.formatEther(reserveStats.foundationRemaining), "EQM");
        console.log("   Corporate remaining:", ethers.formatEther(reserveStats.corporateRemaining), "EQM");
        
        const reservePaused = await reserveManager.paused();
        console.log("   Reserve Manager paused:", reservePaused);
        
        if (reservePaused) {
            const setTx = await reserveManager.setFoundationAddress(user.address);
            await waitTx(setTx, "Setting foundation address");
            
            const activateTx = await reserveManager.activate();
            await waitTx(activateTx, "Activating Reserve Manager");
        }
    } catch (e) {
        console.log("   ❌ Reserve error:", e.message?.slice(0, 100));
    }

    // ============================================
    // FINAL STATUS
    // ============================================
    console.log("\n" + "=".repeat(60));
    console.log("📊 FINAL STATUS");
    console.log("=".repeat(60));
    
    const finalBalance = await token.balanceOf(user.address);
    console.log("\nYour final EQM balance:", ethers.formatEther(finalBalance), "EQM");
    
    try {
        const stakeInfo = await staking.getUserInfo(user.address);
        console.log("Your staked EQM:", ethers.formatEther(stakeInfo.stakedAmount), "EQM");
    } catch (e) {}
    
    try {
        const lockInfo = await governance.getLockInfo(user.address);
        console.log("Your locked EQM (governance):", ethers.formatEther(lockInfo.amount), "EQM");
    } catch (e) {}

    console.log("\n" + "=".repeat(60));
    console.log("🔗 VIEW ON ETHERSCAN:");
    console.log("=".repeat(60));
    console.log(`Token:      https://sepolia.etherscan.io/token/${CONTRACTS.EquorumToken}`);
    console.log(`Your wallet: https://sepolia.etherscan.io/address/${user.address}`);
    console.log("\n" + "=".repeat(60));
    console.log("✅ ALL TESTS COMPLETED!");
    console.log("=".repeat(60) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
    });

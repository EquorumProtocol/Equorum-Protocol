const { ethers } = require("hardhat");

async function main() {
    console.log("Starting Equorum V2 Deployment to Arbitrum...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

    // ============================================
    // CONFIGURATION - PHASE 1 (Bootstrap)
    // ============================================
    const LIQUIDITY_ADDRESS = process.env.LIQUIDITY_ADDRESS || deployer.address;
    const GENESIS_ADDRESS = process.env.GENESIS_ADDRESS || deployer.address;

    console.log("Configuration (Phase 1 - Bootstrap):");
    console.log("   Liquidity Address:", LIQUIDITY_ADDRESS);
    console.log("   Genesis Address:", GENESIS_ADDRESS);
    console.log("   TimeLock Delay: 48 hours (fixed in contract)");
    console.log("   NOTE: ICO (4M tokens) will remain in contract until Phase 2/3\n");

    // ============================================
    // 1. DEPLOY EQUORUM TOKEN
    // ============================================
    console.log("[1/8] Deploying EquorumToken...");
    const EquorumToken = await ethers.getContractFactory("EquorumToken");
    const equorumToken = await EquorumToken.deploy(LIQUIDITY_ADDRESS);
    await equorumToken.waitForDeployment();
    const tokenAddress = await equorumToken.getAddress();
    console.log("   SUCCESS: EquorumToken deployed to:", tokenAddress);
    console.log("   Total Supply:", ethers.formatEther(await equorumToken.totalSupply()), "EQM");
    console.log("   Contract Balance:", ethers.formatEther(await equorumToken.balanceOf(tokenAddress)), "EQM (includes 4M for future ICO)\n");

    // ============================================
    // 2. DEPLOY GENESIS VESTING
    // ============================================
    console.log("[2/8] Deploying EquorumGenesisVesting...");
    
    // Calculate future address for GenesisVesting
    const currentNonce = await ethers.provider.getTransactionCount(deployer.address);
    const vestingFutureAddress = ethers.getCreateAddress({
        from: deployer.address,
        nonce: currentNonce + 1 // +1 because setGenesisVesting will happen first
    });
    
    console.log("   Pre-calculated GenesisVesting address:", vestingFutureAddress);
    
    // Transfer 3M tokens to future vesting contract address
    console.log("   Transferring 3M EQM to future vesting contract...");
    await equorumToken.setGenesisVesting(vestingFutureAddress);
    
    // Now deploy GenesisVesting
    const GenesisVesting = await ethers.getContractFactory("EquorumGenesisVesting");
    const genesisVesting = await GenesisVesting.deploy(tokenAddress, GENESIS_ADDRESS);
    await genesisVesting.waitForDeployment();
    const vestingAddress = await genesisVesting.getAddress();
    console.log("   SUCCESS: EquorumGenesisVesting deployed to:", vestingAddress);
    console.log("   Vesting Balance:", ethers.formatEther(await equorumToken.balanceOf(vestingAddress)), "EQM\n");

    // ============================================
    // 3. DEPLOY STAKING
    // ============================================
    console.log("[3/8] Deploying EquorumStaking...");
    const Staking = await ethers.getContractFactory("EquorumStaking");
    const staking = await Staking.deploy(tokenAddress, vestingAddress);
    await staking.waitForDeployment();
    const stakingAddress = await staking.getAddress();
    console.log("   SUCCESS: EquorumStaking deployed to:", stakingAddress);
    
    // Set staking contract in token
    console.log("   Setting staking contract in token...");
    await equorumToken.setStakingContract(stakingAddress);
    console.log("   Staking Balance:", ethers.formatEther(await equorumToken.balanceOf(stakingAddress)), "EQM\n");

    // ============================================
    // 4. DEPLOY TIMELOCK
    // ============================================
    console.log("[4/8] Deploying EquorumFaucetDistributor...");
    const FaucetDistributor = await ethers.getContractFactory("EquorumFaucetDistributor");
    const faucetDistributor = await FaucetDistributor.deploy(tokenAddress);
    await faucetDistributor.waitForDeployment();
    const faucetAddress = await faucetDistributor.getAddress();
    console.log("   SUCCESS: EquorumFaucetDistributor deployed to:", faucetAddress);
    
    // Set faucet contract in token
    console.log("   Setting faucet contract in token...");
    await equorumToken.setFaucetContract(faucetAddress);
    console.log("   Faucet Balance:", ethers.formatEther(await equorumToken.balanceOf(faucetAddress)), "EQM\n");

    // ============================================
    // 5. DEPLOY LIQUIDITY MANAGER
    // ============================================
    console.log("[5/8] Deploying EquorumLiquidityManager...");
    const LiquidityManager = await ethers.getContractFactory("EquorumLiquidityManager");
    const liquidityManager = await LiquidityManager.deploy(tokenAddress);
    await liquidityManager.waitForDeployment();
    const liquidityManagerAddress = await liquidityManager.getAddress();
    console.log("   SUCCESS: EquorumLiquidityManager deployed to:", liquidityManagerAddress);
    
    // Note: Liquidity tokens (500K) are at LIQUIDITY_ADDRESS
    console.log("   Note: Liquidity tokens (500K) are at:", LIQUIDITY_ADDRESS);
    console.log("   Owner should transfer to LiquidityManager when ready to deploy pools\n");

    // ============================================
    // 6. DEPLOY RESERVE MANAGER
    // ============================================
    console.log("[6/8] Deploying EquorumReserveManager...");
    const ReserveManager = await ethers.getContractFactory("EquorumReserveManager");
    const reserveManager = await ReserveManager.deploy(tokenAddress);
    await reserveManager.waitForDeployment();
    const reserveManagerAddress = await reserveManager.getAddress();
    console.log("   SUCCESS: EquorumReserveManager deployed to:", reserveManagerAddress);
    
    // Set reserve manager in token
    console.log("   Setting reserve manager in token...");
    await equorumToken.setReserveManager(reserveManagerAddress);
    console.log("   Reserve Balance:", ethers.formatEther(await equorumToken.balanceOf(reserveManagerAddress)), "EQM (Foundation + Corporate)\n");

    // ============================================
    // 7. DEPLOY TIMELOCK
    // ============================================
    console.log("[7/8] Deploying TimeLock...");
    const TimeLock = await ethers.getContractFactory("TimeLock");
    const timeLock = await TimeLock.deploy(deployer.address);
    await timeLock.waitForDeployment();
    const timeLockAddress = await timeLock.getAddress();
    console.log("   SUCCESS: TimeLock deployed to:", timeLockAddress);
    console.log("   Delay: 48 hours (fixed)\n");

    // ============================================
    // 5. DEPLOY GOVERNANCE
    // ============================================
    console.log("[8/8] Deploying EquorumGovernance...");
    const Governance = await ethers.getContractFactory("EquorumGovernance");
    const governance = await Governance.deploy(
        tokenAddress,
        timeLockAddress,
        vestingAddress
    );
    await governance.waitForDeployment();
    const governanceAddress = await governance.getAddress();
    console.log("   SUCCESS: EquorumGovernance deployed to:", governanceAddress);
    console.log("   Proposal Threshold:", ethers.formatEther(await governance.PROPOSAL_THRESHOLD()), "EQM");
    console.log("   Quorum Percentage: 4%\n");

    // ============================================
    // 9. SET TIMELOCK ADMIN TO GOVERNANCE
    // ============================================
    console.log("Transferring TimeLock admin to Governance...");
    await timeLock.changeAdmin(governanceAddress);
    console.log("   SUCCESS: TimeLock admin is now Governance contract");
    console.log("   Governance can now queue/execute/cancel proposals\n");

    // ============================================
    // DEPLOYMENT SUMMARY
    // ============================================
    console.log("=" .repeat(60));
    console.log("DEPLOYMENT COMPLETED SUCCESSFULLY!");
    console.log("=" .repeat(60));
    console.log("\nContract Addresses:");
    console.log("   EquorumToken:              ", tokenAddress);
    console.log("   EquorumGenesisVesting:     ", vestingAddress);
    console.log("   EquorumStaking:            ", stakingAddress);
    console.log("   EquorumFaucetDistributor:  ", faucetAddress);
    console.log("   EquorumLiquidityManager:   ", liquidityManagerAddress);
    console.log("   EquorumReserveManager:     ", reserveManagerAddress);
    console.log("   TimeLock:                  ", timeLockAddress);
    console.log("   EquorumGovernance:         ", governanceAddress);
    
    console.log("\nToken Distribution:");
    console.log("   Staking Rewards:           ", ethers.formatEther(await equorumToken.balanceOf(stakingAddress)), "EQM (79.17%)");
    console.log("   Genesis Vesting:           ", ethers.formatEther(await equorumToken.balanceOf(vestingAddress)), "EQM (6.25%)");
    console.log("   Faucet Distributor:        ", ethers.formatEther(await equorumToken.balanceOf(faucetAddress)), "EQM (4.70%)");
    console.log("   Liquidity (at address):    ", ethers.formatEther(await equorumToken.balanceOf(LIQUIDITY_ADDRESS)), "EQM (1.04%)");
    console.log("   Reserve Manager:           ", ethers.formatEther(await equorumToken.balanceOf(reserveManagerAddress)), "EQM (0.51% - Foundation + Corporate)");
    console.log("   ICO (in contract):         ", ethers.formatEther(await equorumToken.balanceOf(tokenAddress)), "EQM (8.33% - RESERVED for Phase 2/3)");
    
    console.log("\nNEXT STEPS (Phase 1 - Bootstrap):");
    console.log("   1. Verify contracts on Arbiscan");
    console.log("   2. Create governance proposal to accept TimeLock admin");
    console.log("   3. Activate Faucet for community distribution");
    console.log("   4. Deploy initial liquidity pools (Uniswap/Camelot)");
    console.log("   5. Start staking program with high APY for early adopters");
    console.log("   6. Build community (Discord, Twitter, Telegram)");
    console.log("   7. Achieve Phase 1 goals: 1K+ holders, $50K+ TVL");
    console.log("\nFUTURE PHASES:");
    console.log("   Phase 2 (6-9 months): Deploy ICO contract for Private Sale");
    console.log("   Phase 3 (9-12 months): Public Sale when community is established");
    
    console.log("\nSaving deployment addresses...");
    const fs = require("fs");
    const network = await ethers.provider.getNetwork();
    const networkName = network.chainId === 421614n ? "arbitrum-sepolia" : 
                        network.chainId === 42161n ? "arbitrum-mainnet" : "local";
    
    const deploymentInfo = {
        network: networkName,
        chainId: Number(network.chainId),
        timestamp: new Date().toISOString(),
        deployer: deployer.address,
        contracts: {
            EquorumToken: tokenAddress,
            EquorumGenesisVesting: vestingAddress,
            EquorumStaking: stakingAddress,
            EquorumFaucetDistributor: faucetAddress,
            EquorumLiquidityManager: liquidityManagerAddress,
            EquorumReserveManager: reserveManagerAddress,
            TimeLock: timeLockAddress,
            EquorumGovernance: governanceAddress
        },
        config: {
            liquidityAddress: LIQUIDITY_ADDRESS,
            genesisAddress: GENESIS_ADDRESS,
            timeLockDelay: "48 hours (fixed)",
            phase: "Phase 1 - Bootstrap",
            icoReserved: "4000000 EQM (in contract, for Phase 2/3)"
        }
    };
    
    const filename = `deployment-${networkName}.json`;
    fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
    console.log(`   SUCCESS: Deployment info saved to ${filename}\n`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("ERROR: Deployment failed:", error);
        process.exit(1);
    });

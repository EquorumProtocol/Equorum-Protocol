const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("📊 Checking Equorum V2 Status...\n");

    // Load deployment info
    if (!fs.existsSync("deployment-arbitrum.json")) {
        console.error("❌ deployment-arbitrum.json not found!");
        process.exit(1);
    }

    const deployment = JSON.parse(fs.readFileSync("deployment-arbitrum.json", "utf8"));
    const contracts = deployment.contracts;

    // Connect to contracts
    const token = await ethers.getContractAt("EquorumToken", contracts.EquorumToken);
    const vesting = await ethers.getContractAt("EquorumGenesisVesting", contracts.EquorumGenesisVesting);
    const staking = await ethers.getContractAt("EquorumStaking", contracts.EquorumStaking);
    const governance = await ethers.getContractAt("EquorumGovernance", contracts.EquorumGovernance);
    const timeLock = await ethers.getContractAt("TimeLock", contracts.TimeLock);

    console.log("=" .repeat(60));
    console.log("💰 TOKEN STATUS");
    console.log("=" .repeat(60));
    const totalSupply = await token.totalSupply();
    console.log("Total Supply:        ", ethers.formatEther(totalSupply), "EQM");
    console.log("ICO Balance:         ", ethers.formatEther(await token.balanceOf(deployment.config.icoAddress)), "EQM");
    console.log("Liquidity Balance:   ", ethers.formatEther(await token.balanceOf(deployment.config.liquidityAddress)), "EQM");
    console.log("Vesting Balance:     ", ethers.formatEther(await token.balanceOf(contracts.EquorumGenesisVesting)), "EQM");
    console.log("Staking Balance:     ", ethers.formatEther(await token.balanceOf(contracts.EquorumStaking)), "EQM");
    console.log("Contract Reserve:    ", ethers.formatEther(await token.balanceOf(contracts.EquorumToken)), "EQM");

    console.log("\n" + "=" .repeat(60));
    console.log("🔒 GENESIS VESTING STATUS");
    console.log("=" .repeat(60));
    const vestingInfo = await vesting.getVestingInfo();
    console.log("Total Allocation:    ", ethers.formatEther(vestingInfo.total), "EQM");
    console.log("Released:            ", ethers.formatEther(vestingInfo.released), "EQM");
    console.log("Remaining:           ", ethers.formatEther(vestingInfo.remaining), "EQM");
    console.log("Monthly Amount:      ", ethers.formatEther(vestingInfo.monthlyAmount), "EQM");
    console.log("Next Release:        ", ethers.formatEther(vestingInfo.nextRelease), "EQM");
    console.log("Months Elapsed:      ", vestingInfo.monthsElapsed.toString(), "/ 72");
    console.log("Months Remaining:    ", vestingInfo.monthsRemaining.toString());

    console.log("\n" + "=" .repeat(60));
    console.log("💎 STAKING STATUS");
    console.log("=" .repeat(60));
    const stakingStats = await staking.getStats();
    const utilizationInfo = await staking.getUtilizationInfo();
    console.log("Total Staked:        ", ethers.formatEther(stakingStats._totalStaked), "EQM");
    console.log("Current APY:         ", (Number(stakingStats._apy) / 100).toFixed(2), "%");
    console.log("Utilization:         ", (Number(utilizationInfo.utilization) / 100).toFixed(2), "%");
    console.log("Can Adjust APY:      ", utilizationInfo.canAdjust ? "Yes" : "No");
    
    const nextAdjustment = new Date(Number(utilizationInfo.nextAdjustment) * 1000);
    console.log("Next APY Adjustment: ", nextAdjustment.toLocaleString());

    console.log("\n" + "=" .repeat(60));
    console.log("🗳️  GOVERNANCE STATUS");
    console.log("=" .repeat(60));
    const proposalCount = await governance.proposalCount();
    const quorum = await governance.getQuorum();
    const proposalThreshold = await governance.PROPOSAL_THRESHOLD();
    console.log("Total Proposals:     ", proposalCount.toString());
    console.log("Proposal Threshold:  ", ethers.formatEther(proposalThreshold), "EQM");
    console.log("Current Quorum:      ", ethers.formatEther(quorum), "EQM");
    console.log("Voting Period:       ", "7 days");

    console.log("\n" + "=" .repeat(60));
    console.log("⏰ TIMELOCK STATUS");
    console.log("=" .repeat(60));
    const admin = await timeLock.admin();
    const pendingAdmin = await timeLock.pendingAdmin();
    const delay = await timeLock.DELAY();
    console.log("Current Admin:       ", admin);
    console.log("Pending Admin:       ", pendingAdmin);
    console.log("Delay:               ", Number(delay) / 3600, "hours");
    console.log("Grace Period:        ", "7 days");

    if (pendingAdmin === contracts.EquorumGovernance) {
        console.log("\n⚠️  PENDING: Governance needs to accept admin role!");
        console.log("   Create a proposal to call acceptAdmin() on TimeLock");
    } else if (admin === contracts.EquorumGovernance) {
        console.log("\n✅ Governance is TimeLock admin - fully decentralized!");
    }

    console.log("\n" + "=" .repeat(60));
    console.log("🔗 CONTRACT LINKS");
    console.log("=" .repeat(60));
    console.log("Token:      https://arbiscan.io/address/" + contracts.EquorumToken);
    console.log("Vesting:    https://arbiscan.io/address/" + contracts.EquorumGenesisVesting);
    console.log("Staking:    https://arbiscan.io/address/" + contracts.EquorumStaking);
    console.log("TimeLock:   https://arbiscan.io/address/" + contracts.TimeLock);
    console.log("Governance: https://arbiscan.io/address/" + contracts.EquorumGovernance);
    console.log();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });

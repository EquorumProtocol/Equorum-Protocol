const { ethers } = require("hardhat");

// Addresses from the partial deploy on Sepolia
const DEPLOYED = {
    EquorumToken: "0x566052f370dB9dC1583555faEf57Faf9C61d65Be",
    EquorumGenesisVesting: "0x76c313A031187dD4b18478F21919c651E96E8087",
    EquorumStaking: "0xbf416b449864169B901d6386396f5bB0d1A88dc7",
    EquorumFaucetDistributor: "0xC8351c68079502eccd59962FB721b86235F25CfC",
    EquorumLiquidityManager: "0x15D5477450176A19e9E03e143071D3710d9B0574",
    EquorumReserveManager: "0xb473467F2Cb2e89aCb0CaD7905649435152561fA",
    TimeLock: "0xbb2480fCC55AD056543c633adAA3e7998A32FB85",
    EquorumGovernance: "0xB0C24dE10A038B545E54445be1b9df17Ff070c59"
};

async function main() {
    console.log("Completing Equorum V2 Deployment...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Using account:", deployer.address);

    // Get contract instances
    const timeLock = await ethers.getContractAt("TimeLock", DEPLOYED.TimeLock);
    
    // Transfer TimeLock admin to Governance
    console.log("Transferring TimeLock admin to Governance...");
    try {
        await timeLock.changeAdmin(DEPLOYED.EquorumGovernance);
        console.log("   SUCCESS: TimeLock admin is now Governance contract\n");
    } catch (e) {
        console.log("   Already done or error:", e.message, "\n");
    }

    // Print summary
    console.log("=".repeat(60));
    console.log("DEPLOYMENT COMPLETED!");
    console.log("=".repeat(60));
    console.log("\nContract Addresses:");
    for (const [name, address] of Object.entries(DEPLOYED)) {
        console.log(`   ${name.padEnd(25)}: ${address}`);
    }

    // Get token balances
    const token = await ethers.getContractAt("EquorumToken", DEPLOYED.EquorumToken);
    
    console.log("\nToken Distribution:");
    console.log("   Staking Rewards:       ", ethers.formatEther(await token.balanceOf(DEPLOYED.EquorumStaking)), "EQM");
    console.log("   Genesis Vesting:       ", ethers.formatEther(await token.balanceOf(DEPLOYED.EquorumGenesisVesting)), "EQM");
    console.log("   Faucet Distributor:    ", ethers.formatEther(await token.balanceOf(DEPLOYED.EquorumFaucetDistributor)), "EQM");
    console.log("   Reserve Manager:       ", ethers.formatEther(await token.balanceOf(DEPLOYED.EquorumReserveManager)), "EQM");
    console.log("   Contract (ICO reserve):", ethers.formatEther(await token.balanceOf(DEPLOYED.EquorumToken)), "EQM");
    console.log("   Deployer:              ", ethers.formatEther(await token.balanceOf(deployer.address)), "EQM");

    // Save deployment info
    const fs = require("fs");
    const network = await ethers.provider.getNetwork();
    const networkName = network.chainId === 11155111n ? "sepolia" : 
                        network.chainId === 421614n ? "arbitrum-sepolia" : "unknown";
    
    const deploymentInfo = {
        network: networkName,
        chainId: Number(network.chainId),
        timestamp: new Date().toISOString(),
        deployer: deployer.address,
        contracts: DEPLOYED
    };
    
    const filename = `deployment-${networkName}.json`;
    fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\nDeployment info saved to ${filename}`);
    
    console.log("\n" + "=".repeat(60));
    console.log("🎉 DEPLOY COMPLETE! View on Etherscan:");
    console.log(`   https://sepolia.etherscan.io/address/${DEPLOYED.EquorumToken}`);
    console.log("=".repeat(60) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
    });

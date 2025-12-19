const hre = require("hardhat");

async function main() {
    console.log("🚰 Activating Equorum Faucet...\n");

    const faucetAddress = "0xDdeE4050738eDDBb2fdDF02470203C5Ca30858b7";
    
    const [deployer] = await hre.ethers.getSigners();
    console.log("Activating with account:", deployer.address);

    const Faucet = await hre.ethers.getContractAt("EquorumFaucetDistributor", faucetAddress);

    console.log("\n📊 Current Faucet Status:");
    const stats = await Faucet.getFaucetStats();
    console.log("- Total Distributed:", hre.ethers.utils.formatEther(stats.totalDist), "EQM");
    console.log("- Daily Distributed:", hre.ethers.utils.formatEther(stats.dailyDist), "EQM");
    console.log("- Remaining Balance:", hre.ethers.utils.formatEther(stats.remaining), "EQM");
    console.log("- Paused:", stats.isPaused);
    console.log("- Whitelist Mode:", stats.isWhitelistMode);

    if (!stats.isPaused) {
        console.log("\n✅ Faucet is already active!");
        return;
    }

    console.log("\n🔓 Activating faucet in PUBLIC mode...");
    const tx = await Faucet.activate();
    console.log("Transaction hash:", tx.hash);
    
    await tx.wait();
    console.log("✅ Faucet activated successfully!");

    console.log("\n📋 Faucet Configuration:");
    console.log("- Claim Amount: 0.001 EQM per claim");
    console.log("- Cooldown: 24 hours");
    console.log("- Max per User: 0.05 EQM (lifetime)");
    console.log("- Daily Limit: 10 EQM");
    console.log("- Min ETH Balance: 0.001 ETH");
    console.log("- Account Age: ~1 hour");

    console.log("\n🌐 Faucet Address:");
    console.log("https://arbiscan.io/address/" + faucetAddress);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

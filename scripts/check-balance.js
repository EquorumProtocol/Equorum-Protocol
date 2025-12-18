const { ethers } = require("hardhat");
require("dotenv").config();

// Network configurations with faucets
const NETWORKS = {
    arbitrumSepolia: {
        name: "Arbitrum Sepolia",
        chainId: 421614,
        explorer: "https://sepolia.arbiscan.io",
        faucets: [
            "https://faucet.quicknode.com/arbitrum/sepolia",
            "https://www.alchemy.com/faucets/arbitrum-sepolia",
            "https://faucet.triangleplatform.com/arbitrum/sepolia",
            "https://bwarelabs.com/faucets/arbitrum-sepolia",
        ],
        bridge: "https://bridge.arbitrum.io/?destinationChain=arbitrum-sepolia",
        minBalance: "0.005"
    },
    sepolia: {
        name: "Ethereum Sepolia",
        chainId: 11155111,
        explorer: "https://sepolia.etherscan.io",
        faucets: [
            "https://sepoliafaucet.com",
            "https://www.alchemy.com/faucets/ethereum-sepolia",
            "https://faucet.quicknode.com/ethereum/sepolia",
            "https://www.infura.io/faucet/sepolia",
            "https://faucets.chain.link/sepolia",
        ],
        minBalance: "0.01"
    },
    arbitrum: {
        name: "Arbitrum One (MAINNET)",
        chainId: 42161,
        explorer: "https://arbiscan.io",
        faucets: [],
        minBalance: "0.001"
    }
};

async function checkAllNetworks(address) {
    console.log("\n📊 CHECKING ALL CONFIGURED NETWORKS...\n");
    
    const results = [];
    
    // Check Arbitrum Sepolia
    try {
        const arbSepoliaRpc = process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";
        const provider = new ethers.JsonRpcProvider(arbSepoliaRpc);
        const balance = await provider.getBalance(address);
        results.push({
            network: "Arbitrum Sepolia",
            balance: ethers.formatEther(balance),
            hasBalance: balance > 0n,
            config: NETWORKS.arbitrumSepolia
        });
    } catch (e) {
        results.push({ network: "Arbitrum Sepolia", error: e.message });
    }
    
    // Check Ethereum Sepolia
    try {
        const sepoliaRpc = process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org";
        const provider = new ethers.JsonRpcProvider(sepoliaRpc);
        const balance = await provider.getBalance(address);
        results.push({
            network: "Ethereum Sepolia",
            balance: ethers.formatEther(balance),
            hasBalance: balance > 0n,
            config: NETWORKS.sepolia
        });
    } catch (e) {
        results.push({ network: "Ethereum Sepolia", error: e.message });
    }
    
    return results;
}

async function main() {
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    const balance = await ethers.provider.getBalance(deployer.address);
    
    // Detect current network
    const networkKey = Object.keys(NETWORKS).find(k => NETWORKS[k].chainId === Number(network.chainId));
    const networkConfig = networkKey ? NETWORKS[networkKey] : null;
    
    console.log("\n" + "=".repeat(60));
    console.log("🔍 EQUORUM V2 - WALLET & NETWORK STATUS");
    console.log("=".repeat(60));
    
    // Wallet Info
    console.log("\n📛 WALLET INFO:");
    console.log("   Address:", deployer.address);
    console.log("   Copy:   ", deployer.address, "(use this for faucets)");
    
    // Current Network
    console.log("\n🌐 CURRENT NETWORK:");
    console.log("   Name:    ", networkConfig?.name || `Unknown (${network.chainId})`);
    console.log("   Chain ID:", network.chainId.toString());
    console.log("   Balance: ", ethers.formatEther(balance), "ETH");
    
    if (networkConfig?.explorer) {
        console.log("   Explorer:", `${networkConfig.explorer}/address/${deployer.address}`);
    }
    
    // Balance Status
    const minRequired = ethers.parseEther(networkConfig?.minBalance || "0.01");
    console.log("\n💰 BALANCE STATUS:");
    if (balance >= minRequired) {
        console.log("   ✅ READY FOR DEPLOYMENT!");
        console.log(`   You have ${ethers.formatEther(balance)} ETH (min: ${networkConfig?.minBalance || "0.01"} ETH)`);
    } else if (balance > 0n) {
        console.log("   ⚠️  LOW BALANCE - May not be enough for full deployment");
        console.log(`   You have ${ethers.formatEther(balance)} ETH (recommended: ${networkConfig?.minBalance || "0.01"} ETH)`);
    } else {
        console.log("   ❌ NO BALANCE - Cannot deploy");
        console.log(`   You need at least ${networkConfig?.minBalance || "0.01"} ETH`);
    }
    
    // Check all networks
    console.log("\n" + "-".repeat(60));
    const allBalances = await checkAllNetworks(deployer.address);
    
    console.log("   Network               | Balance");
    console.log("   " + "-".repeat(45));
    for (const result of allBalances) {
        if (result.error) {
            console.log(`   ${result.network.padEnd(20)} | ❌ Error: ${result.error}`);
        } else {
            const status = result.hasBalance ? "✅" : "❌";
            console.log(`   ${result.network.padEnd(20)} | ${status} ${result.balance} ETH`);
        }
    }
    
    // Faucets section
    if (balance < minRequired && networkConfig?.faucets?.length > 0) {
        console.log("\n" + "=".repeat(60));
        console.log("🚰 FAUCETS FOR " + networkConfig.name.toUpperCase());
        console.log("=".repeat(60));
        console.log("\nCopy your address and paste in these faucets:\n");
        console.log(`   📋 ${deployer.address}\n`);
        
        networkConfig.faucets.forEach((faucet, i) => {
            console.log(`   ${i + 1}. ${faucet}`);
        });
        
        if (networkConfig.bridge) {
            console.log("\n🌉 ALTERNATIVE - Bridge from Ethereum Sepolia:");
            console.log(`   ${networkConfig.bridge}`);
            console.log("   (Get Sepolia ETH first, then bridge to Arbitrum Sepolia)");
        }
        
        // Check if has Sepolia ETH to bridge
        const sepoliaResult = allBalances.find(r => r.network === "Ethereum Sepolia");
        if (sepoliaResult?.hasBalance && networkKey === "arbitrumSepolia") {
            console.log("\n💡 TIP: You have ETH on Ethereum Sepolia!");
            console.log("   You can bridge it to Arbitrum Sepolia using:");
            console.log(`   ${networkConfig.bridge}`);
        }
    }
    
    // Quick commands
    console.log("\n" + "=".repeat(60));
    console.log("📝 QUICK COMMANDS");
    console.log("=".repeat(60));
    console.log("\n# Check balance again:");
    console.log("npx hardhat run scripts/check-balance.js --network arbitrumSepolia");
    console.log("\n# Deploy when ready:");
    console.log("npx hardhat run scripts/deploy.js --network arbitrumSepolia");
    console.log("\n# Test locally first:");
    console.log("npx hardhat run scripts/deploy.js --network localhost");
    
    // Environment check
    console.log("\n" + "=".repeat(60));
    console.log("⚙️  ENVIRONMENT CHECK");
    console.log("=".repeat(60));
    console.log("   PRIVATE_KEY:            ", process.env.PRIVATE_KEY ? "✅ Set" : "❌ Missing");
    console.log("   ARBITRUM_SEPOLIA_RPC:   ", process.env.ARBITRUM_SEPOLIA_RPC_URL ? "✅ Set" : "⚠️  Using default");
    console.log("   ARBISCAN_API_KEY:       ", process.env.ARBISCAN_API_KEY ? "✅ Set" : "⚠️  Missing (optional, for verification)");
    
    console.log("\n" + "=".repeat(60));
    
    // Final verdict
    if (balance >= minRequired) {
        console.log("🚀 ALL SYSTEMS GO! Ready to deploy.");
        console.log("   Run: npx hardhat run scripts/deploy.js --network arbitrumSepolia");
    } else {
        console.log("⏳ WAITING FOR TESTNET ETH...");
        console.log("   Get ETH from faucets above, then run this script again.");
    }
    console.log("=".repeat(60) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error.message);
        process.exit(1);
    });

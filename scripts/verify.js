const { run } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 Starting contract verification on Arbiscan...\n");

    // Load deployment info
    if (!fs.existsSync("deployment-arbitrum.json")) {
        console.error("❌ deployment-arbitrum.json not found!");
        console.error("   Please run deployment script first.");
        process.exit(1);
    }

    const deployment = JSON.parse(fs.readFileSync("deployment-arbitrum.json", "utf8"));
    const contracts = deployment.contracts;
    const config = deployment.config;

    console.log("📋 Loaded deployment from:", deployment.timestamp);
    console.log("🌐 Network:", deployment.network);
    console.log("👤 Deployer:", deployment.deployer, "\n");

    // ============================================
    // VERIFY EQUORUM TOKEN
    // ============================================
    console.log("1/5 Verifying EquorumToken...");
    try {
        await run("verify:verify", {
            address: contracts.EquorumToken,
            constructorArguments: [
                config.icoAddress,
                config.liquidityAddress
            ],
        });
        console.log("   ✅ EquorumToken verified\n");
    } catch (error) {
        if (error.message.includes("Already Verified")) {
            console.log("   ℹ️  EquorumToken already verified\n");
        } else {
            console.error("   ❌ Error:", error.message, "\n");
        }
    }

    // ============================================
    // VERIFY GENESIS VESTING
    // ============================================
    console.log("2/5 Verifying EquorumGenesisVesting...");
    try {
        await run("verify:verify", {
            address: contracts.EquorumGenesisVesting,
            constructorArguments: [
                contracts.EquorumToken,
                config.genesisAddress
            ],
        });
        console.log("   ✅ EquorumGenesisVesting verified\n");
    } catch (error) {
        if (error.message.includes("Already Verified")) {
            console.log("   ℹ️  EquorumGenesisVesting already verified\n");
        } else {
            console.error("   ❌ Error:", error.message, "\n");
        }
    }

    // ============================================
    // VERIFY STAKING
    // ============================================
    console.log("3/5 Verifying EquorumStaking...");
    try {
        await run("verify:verify", {
            address: contracts.EquorumStaking,
            constructorArguments: [
                contracts.EquorumToken,
                contracts.EquorumGenesisVesting
            ],
        });
        console.log("   ✅ EquorumStaking verified\n");
    } catch (error) {
        if (error.message.includes("Already Verified")) {
            console.log("   ℹ️  EquorumStaking already verified\n");
        } else {
            console.error("   ❌ Error:", error.message, "\n");
        }
    }

    // ============================================
    // VERIFY TIMELOCK
    // ============================================
    console.log("4/5 Verifying TimeLock...");
    try {
        await run("verify:verify", {
            address: contracts.TimeLock,
            constructorArguments: [
                deployment.deployer,
                config.timeLockDelay
            ],
        });
        console.log("   ✅ TimeLock verified\n");
    } catch (error) {
        if (error.message.includes("Already Verified")) {
            console.log("   ℹ️  TimeLock already verified\n");
        } else {
            console.error("   ❌ Error:", error.message, "\n");
        }
    }

    // ============================================
    // VERIFY GOVERNANCE
    // ============================================
    console.log("5/5 Verifying EquorumGovernance...");
    try {
        await run("verify:verify", {
            address: contracts.EquorumGovernance,
            constructorArguments: [
                contracts.EquorumToken,
                contracts.TimeLock,
                contracts.EquorumGenesisVesting
            ],
        });
        console.log("   ✅ EquorumGovernance verified\n");
    } catch (error) {
        if (error.message.includes("Already Verified")) {
            console.log("   ℹ️  EquorumGovernance already verified\n");
        } else {
            console.error("   ❌ Error:", error.message, "\n");
        }
    }

    console.log("=" .repeat(60));
    console.log("🎉 VERIFICATION COMPLETED!");
    console.log("=" .repeat(60));
    console.log("\n🔗 View contracts on Arbiscan:");
    console.log("   EquorumToken:          https://arbiscan.io/address/" + contracts.EquorumToken);
    console.log("   EquorumGenesisVesting: https://arbiscan.io/address/" + contracts.EquorumGenesisVesting);
    console.log("   EquorumStaking:        https://arbiscan.io/address/" + contracts.EquorumStaking);
    console.log("   TimeLock:              https://arbiscan.io/address/" + contracts.TimeLock);
    console.log("   EquorumGovernance:     https://arbiscan.io/address/" + contracts.EquorumGovernance);
    console.log();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Verification failed:", error);
        process.exit(1);
    });

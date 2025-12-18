const { ethers } = require("hardhat");

const CONTRACTS = {
    EquorumToken: "0x566052f370dB9dC1583555faEf57Faf9C61d65Be",
    EquorumGenesisVesting: "0x76c313A031187dD4b18478F21919c651E96E8087",
};

async function main() {
    const [user] = await ethers.getSigners();
    
    console.log("\n" + "=".repeat(70));
    console.log("GENESIS VESTING - COMPLETE ANALYSIS");
    console.log("=".repeat(70));

    const token = await ethers.getContractAt("EquorumToken", CONTRACTS.EquorumToken);
    const vesting = await ethers.getContractAt("EquorumGenesisVesting", CONTRACTS.EquorumGenesisVesting);

    // Basic info
    const vestingBalance = await token.balanceOf(CONTRACTS.EquorumGenesisVesting);
    const genesisAddress = await vesting.genesisAddress();
    const releaseStartTime = await vesting.releaseStartTime();
    const releasedTokens = await vesting.releasedTokens();
    
    // Constants
    const GENESIS_ALLOCATION = await vesting.GENESIS_ALLOCATION();
    const VESTING_DURATION = await vesting.VESTING_DURATION();
    const MONTHLY_RELEASE = await vesting.MONTHLY_RELEASE();
    const SECONDS_PER_MONTH = await vesting.SECONDS_PER_MONTH();

    // Calculate current state
    const now = BigInt(Math.floor(Date.now() / 1000));
    const elapsed = now - releaseStartTime;
    const monthsPassed = elapsed / SECONDS_PER_MONTH;
    const totalVested = monthsPassed * MONTHLY_RELEASE;
    const claimable = totalVested > releasedTokens ? totalVested - releasedTokens : 0n;

    console.log("\n--- CONTRACT INFO ---");
    console.log("Contract Address:", CONTRACTS.EquorumGenesisVesting);
    console.log("Contract Balance:", ethers.formatEther(vestingBalance), "EQM");
    console.log("Is Funded:", vestingBalance >= GENESIS_ALLOCATION ? "YES" : "NO");

    console.log("\n--- BENEFICIARY ---");
    console.log("Genesis Address:", genesisAddress);
    console.log("Your Address:   ", user.address);
    console.log("YOU ARE THE BENEFICIARY:", genesisAddress.toLowerCase() === user.address.toLowerCase() ? "YES!" : "NO");

    console.log("\n--- VESTING SCHEDULE ---");
    console.log("Total Allocation:", ethers.formatEther(GENESIS_ALLOCATION), "EQM");
    console.log("Vesting Duration:", Number(VESTING_DURATION), "months (6 years)");
    console.log("Monthly Release: ", ethers.formatEther(MONTHLY_RELEASE), "EQM");
    console.log("Start Time:      ", new Date(Number(releaseStartTime) * 1000).toISOString());

    console.log("\n--- CURRENT STATUS ---");
    console.log("Time Elapsed:    ", (Number(elapsed) / 86400).toFixed(4), "days");
    console.log("Months Passed:   ", Number(monthsPassed).toFixed(4), "months");
    console.log("Total Vested:    ", ethers.formatEther(totalVested > GENESIS_ALLOCATION ? GENESIS_ALLOCATION : totalVested), "EQM");
    console.log("Already Released:", ethers.formatEther(releasedTokens), "EQM");
    console.log("CLAIMABLE NOW:   ", ethers.formatEther(claimable), "EQM");

    // Try to get releasable from contract
    try {
        const releasable = await vesting.releasable();
        console.log("Contract says:   ", ethers.formatEther(releasable), "EQM releasable");
    } catch (e) {
        console.log("(releasable() not available)");
    }

    console.log("\n--- VESTING TIMELINE ---");
    const startDate = new Date(Number(releaseStartTime) * 1000);
    console.log("Month  1:", new Date(startDate.getTime() + 30*24*60*60*1000).toLocaleDateString(), "- 41,666 EQM");
    console.log("Month  6:", new Date(startDate.getTime() + 6*30*24*60*60*1000).toLocaleDateString(), "- 250,000 EQM total");
    console.log("Month 12:", new Date(startDate.getTime() + 12*30*24*60*60*1000).toLocaleDateString(), "- 500,000 EQM total");
    console.log("Month 36:", new Date(startDate.getTime() + 36*30*24*60*60*1000).toLocaleDateString(), "- 1,500,000 EQM total");
    console.log("Month 72:", new Date(startDate.getTime() + 72*30*24*60*60*1000).toLocaleDateString(), "- 3,000,000 EQM total (COMPLETE)");

    // Test claim if there's something to claim
    if (claimable > 0n && genesisAddress.toLowerCase() === user.address.toLowerCase()) {
        console.log("\n--- ATTEMPTING CLAIM ---");
        try {
            const tx = await vesting.release();
            console.log("Transaction sent:", tx.hash);
            const receipt = await tx.wait();
            console.log("SUCCESS! Claimed tokens in block", receipt.blockNumber);
            
            const newBalance = await token.balanceOf(user.address);
            console.log("Your new balance:", ethers.formatEther(newBalance), "EQM");
        } catch (e) {
            console.log("Claim failed:", e.message?.slice(0, 100));
        }
    } else if (claimable === 0n) {
        console.log("\n--- NO TOKENS TO CLAIM YET ---");
        console.log("Wait until 1 month has passed since vesting start.");
        const nextRelease = releaseStartTime + SECONDS_PER_MONTH;
        console.log("First release available:", new Date(Number(nextRelease) * 1000).toISOString());
    }

    console.log("\n" + "=".repeat(70));
    console.log("GENESIS VESTING CHECK COMPLETE");
    console.log("=".repeat(70) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
    });

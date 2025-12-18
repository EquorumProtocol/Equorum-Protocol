const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("📝 Creating Governance Proposal...\n");

    // Load deployment info
    if (!fs.existsSync("deployment-arbitrum.json")) {
        console.error("❌ deployment-arbitrum.json not found!");
        process.exit(1);
    }

    const deployment = JSON.parse(fs.readFileSync("deployment-arbitrum.json", "utf8"));
    const contracts = deployment.contracts;

    const [proposer] = await ethers.getSigners();
    console.log("👤 Proposer:", proposer.address);

    // Connect to contracts
    const token = await ethers.getContractAt("EquorumToken", contracts.EquorumToken);
    const governance = await ethers.getContractAt("EquorumGovernance", contracts.EquorumGovernance);
    const timeLock = await ethers.getContractAt("TimeLock", contracts.TimeLock);

    // Check proposer balance
    const balance = await token.balanceOf(proposer.address);
    const threshold = await governance.PROPOSAL_THRESHOLD();
    console.log("💰 Your balance:", ethers.formatEther(balance), "EQM");
    console.log("📊 Required:", ethers.formatEther(threshold), "EQM\n");

    if (balance < threshold) {
        console.error("❌ Insufficient tokens to create proposal!");
        console.error("   You need at least", ethers.formatEther(threshold), "EQM");
        process.exit(1);
    }

    // ============================================
    // EXAMPLE PROPOSAL: Transfer TimeLock Admin
    // ============================================
    console.log("📋 Proposal Type: Transfer TimeLock Admin to Governance\n");

    const targets = [contracts.TimeLock];
    const values = [0];
    const signatures = ["acceptAdmin()"];
    const calldatas = ["0x"];
    const description = "Transfer TimeLock admin rights to Governance contract for full decentralization";

    console.log("⚙️  Proposal Details:");
    console.log("   Target:      ", targets[0]);
    console.log("   Value:       ", values[0], "ETH");
    console.log("   Signature:   ", signatures[0]);
    console.log("   Calldata:    ", calldatas[0]);
    console.log("   Description: ", description);
    console.log();

    // Create proposal
    console.log("🚀 Creating proposal...");
    const tx = await governance.propose(
        targets,
        values,
        signatures,
        calldatas,
        description
    );
    console.log("   Transaction hash:", tx.hash);

    const receipt = await tx.wait();
    console.log("   ✅ Proposal created!\n");

    // Get proposal ID from event
    const proposalEvent = receipt.logs.find(log => {
        try {
            const parsed = governance.interface.parseLog(log);
            return parsed.name === "ProposalCreated";
        } catch {
            return false;
        }
    });

    if (proposalEvent) {
        const parsed = governance.interface.parseLog(proposalEvent);
        const proposalId = parsed.args.id;
        
        console.log("=" .repeat(60));
        console.log("🎉 PROPOSAL CREATED SUCCESSFULLY!");
        console.log("=" .repeat(60));
        console.log("\n📋 Proposal ID:", proposalId.toString());
        
        // Get proposal details
        const proposal = await governance.proposals(proposalId);
        const votingStarts = new Date(Number(proposal.startTime) * 1000);
        const votingEnds = new Date(Number(proposal.endTime) * 1000);
        
        console.log("\n⏰ Timeline:");
        console.log("   Voting Starts: ", votingStarts.toLocaleString());
        console.log("   Voting Ends:   ", votingEnds.toLocaleString());
        console.log("   Duration:      ", "7 days");
        
        console.log("\n📊 Voting Power:");
        const votingPower = await governance.getVotingPower(proposer.address);
        console.log("   Your voting power:", ethers.formatEther(votingPower), "votes");
        console.log("   (Quadratic: sqrt of token balance)");
        
        const quorum = await governance.getQuorum();
        console.log("   Required quorum:  ", ethers.formatEther(quorum), "votes");
        
        console.log("\n🗳️  Next Steps:");
        console.log("   1. Wait for voting period to start");
        console.log("   2. Vote on proposal:");
        console.log("      npx hardhat run scripts/vote.js --network arbitrum");
        console.log("   3. After voting ends, queue proposal:");
        console.log("      npx hardhat run scripts/queue-proposal.js --network arbitrum");
        console.log("   4. Wait 48 hours (TimeLock delay)");
        console.log("   5. Execute proposal:");
        console.log("      npx hardhat run scripts/execute-proposal.js --network arbitrum");
        
        console.log("\n🔗 View on Arbiscan:");
        console.log("   https://arbiscan.io/address/" + contracts.EquorumGovernance);
        console.log();
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });

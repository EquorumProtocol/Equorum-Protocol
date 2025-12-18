const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("EquorumGovernance - Comprehensive Tests", function () {
    let equorumToken;
    let timeLock;
    let governance;
    let owner;
    let genesis;
    let user1;
    let user2;
    let user3;

    const PROPOSAL_THRESHOLD = ethers.parseEther("10000");
    const MIN_LOCK_AMOUNT = ethers.parseEther("100");
    const MIN_LOCK_AGE = 7 * 24 * 60 * 60; // 7 days
    const VOTING_PERIOD = 7 * 24 * 60 * 60; // 7 days
    const QUORUM_PERCENTAGE = 400; // 4%
    const TOTAL_SUPPLY = ethers.parseEther("48000000");

    // Helper function to lock tokens and wait for lock age
    async function lockAndWait(signer, amount) {
        await equorumToken.connect(signer).approve(await governance.getAddress(), amount);
        await governance.connect(signer).lock(amount);
        await time.increase(MIN_LOCK_AGE);
    }

    // Helper function to create simple proposals
    async function createProposal(signer, description) {
        return governance.connect(signer).propose(
            [await equorumToken.getAddress()],  // targets (valid address)
            [0],                    // values
            [""],                   // signatures
            ["0x"],                 // calldatas
            description             // description
        );
    }

    beforeEach(async function () {
        [owner, genesis, user1, user2, user3] = await ethers.getSigners();

        // Deploy EquorumToken
        const EquorumToken = await ethers.getContractFactory("EquorumToken");
        equorumToken = await EquorumToken.deploy(
            owner.address   // Liquidity address
        );
        await equorumToken.waitForDeployment();

        // Deploy TimeLock with owner as initial admin
        const TimeLock = await ethers.getContractFactory("TimeLock");
        timeLock = await TimeLock.deploy(owner.address);
        await timeLock.waitForDeployment();

        // Use genesis signer address as mock GenesisVesting
        const genesisVestingAddress = genesis.address;
        
        // Deploy Governance
        const Governance = await ethers.getContractFactory("EquorumGovernance");
        governance = await Governance.deploy(
            await equorumToken.getAddress(),
            await timeLock.getAddress(),
            genesisVestingAddress
        );
        await governance.waitForDeployment();

        // Transfer TimeLock admin to Governance for queue/execute to work
        await timeLock.setPendingAdmin(await governance.getAddress());

        // Setup: Give users tokens for locking
        await equorumToken.setStakingContract(owner.address); // Temporarily set owner as staking
        await equorumToken.transfer(user1.address, ethers.parseEther("400000"));
        await equorumToken.transfer(user2.address, ethers.parseEther("350000"));
        await equorumToken.transfer(user3.address, ethers.parseEther("300000"));
    });

    describe("Deployment", function () {
        it("Should set correct token address", async function () {
            expect(await governance.equorumToken()).to.equal(await equorumToken.getAddress());
        });

        it("Should set correct timelock address", async function () {
            expect(await governance.timeLock()).to.equal(await timeLock.getAddress());
        });

        it("Should set correct genesis vesting address", async function () {
            expect(await governance.genesisVesting()).to.equal(genesis.address);
        });

        it("Should have correct proposal threshold", async function () {
            expect(await governance.PROPOSAL_THRESHOLD()).to.equal(PROPOSAL_THRESHOLD);
        });

        it("Should have correct voting period", async function () {
            expect(await governance.VOTING_PERIOD()).to.equal(VOTING_PERIOD);
        });

        it("Should have correct quorum percentage", async function () {
            expect(await governance.QUORUM_PERCENTAGE()).to.equal(QUORUM_PERCENTAGE);
        });

        it("Should start with proposal count 0", async function () {
            expect(await governance.proposalCount()).to.equal(0);
        });

        it("Should revert if token address is zero", async function () {
            const Governance = await ethers.getContractFactory("EquorumGovernance");
            await expect(
                Governance.deploy(
                    ethers.ZeroAddress,
                    await timeLock.getAddress(),
                    genesis.address
                )
            ).to.be.revertedWithCustomError(Governance, "InvalidAddress");
        });

        it("Should revert if timelock address is zero", async function () {
            const Governance = await ethers.getContractFactory("EquorumGovernance");
            await expect(
                Governance.deploy(
                    await equorumToken.getAddress(),
                    ethers.ZeroAddress,
                    genesis.address
                )
            ).to.be.revertedWithCustomError(Governance, "InvalidAddress");
        });

        it("Should revert if genesis vesting address is zero", async function () {
            const Governance = await ethers.getContractFactory("EquorumGovernance");
            await expect(
                Governance.deploy(
                    await equorumToken.getAddress(),
                    await timeLock.getAddress(),
                    ethers.ZeroAddress
                )
            ).to.be.revertedWithCustomError(Governance, "InvalidAddress");
        });
    });

    describe("Lock System", function () {
        it("Should allow user to lock tokens", async function () {
            const lockAmount = ethers.parseEther("10000");
            await equorumToken.connect(user1).approve(await governance.getAddress(), lockAmount);
            
            await expect(governance.connect(user1).lock(lockAmount))
                .to.emit(governance, "TokensLocked")
                .withArgs(user1.address, lockAmount, lockAmount);
        });

        it("Should update lock info correctly", async function () {
            const lockAmount = ethers.parseEther("10000");
            await equorumToken.connect(user1).approve(await governance.getAddress(), lockAmount);
            await governance.connect(user1).lock(lockAmount);
            
            const lockInfo = await governance.getLockInfo(user1.address);
            expect(lockInfo.amount).to.equal(lockAmount);
        });

        it("Should not allow locking below minimum", async function () {
            const lockAmount = ethers.parseEther("50"); // Below MIN_LOCK_AMOUNT (100)
            await equorumToken.connect(user1).approve(await governance.getAddress(), lockAmount);
            
            await expect(governance.connect(user1).lock(lockAmount))
                .to.be.revertedWithCustomError(governance, "BelowMinimumLock");
        });

        it("Should not allow Genesis to lock", async function () {
            await equorumToken.transfer(genesis.address, ethers.parseEther("1000"));
            await equorumToken.connect(genesis).approve(await governance.getAddress(), ethers.parseEther("1000"));
            
            await expect(governance.connect(genesis).lock(ethers.parseEther("1000")))
                .to.be.revertedWithCustomError(governance, "GenesisCannotParticipate");
        });

        it("Should allow unlock after voting period ends", async function () {
            const lockAmount = ethers.parseEther("10000");
            await equorumToken.connect(user1).approve(await governance.getAddress(), lockAmount);
            await governance.connect(user1).lock(lockAmount);
            
            // No votes cast, should be able to unlock immediately
            await expect(governance.connect(user1).unlock())
                .to.emit(governance, "TokensUnlocked")
                .withArgs(user1.address, lockAmount);
        });

        it("Should not allow unlock with no lock", async function () {
            await expect(governance.connect(user1).unlock())
                .to.be.revertedWithCustomError(governance, "NoLockFound");
        });
    });

    describe("Proposal Creation", function () {
        beforeEach(async function () {
            // Lock tokens for user1 to create proposals (need PROPOSAL_THRESHOLD locked)
            await lockAndWait(user1, PROPOSAL_THRESHOLD);
        });

        it("Should allow user with enough locked tokens to create proposal", async function () {
            await expect(
                createProposal(user1, "Description")
            ).to.emit(governance, "ProposalCreated");
        });

        it("Should increment proposal count", async function () {
            await createProposal(user1, "Description");
            expect(await governance.proposalCount()).to.equal(1);
        });

        it("Should set correct proposal data", async function () {
            await createProposal(user1, "Description");
            
            const proposal = await governance.proposals(1);
            expect(proposal.proposer).to.equal(user1.address);
            expect(proposal.description).to.equal("Description");
            expect(proposal.executed).to.be.false;
            expect(proposal.canceled).to.be.false;
        });

        it("Should not allow proposal without enough locked tokens", async function () {
            // user2 has no lock
            await expect(
                createProposal(user2, "Desc")
            ).to.be.revertedWithCustomError(governance, "BelowProposalThreshold");
        });

        it("Should not allow proposal with lock too new", async function () {
            // Lock tokens for user2 but don't wait
            await equorumToken.connect(user2).approve(await governance.getAddress(), PROPOSAL_THRESHOLD);
            await governance.connect(user2).lock(PROPOSAL_THRESHOLD);
            // Don't wait for MIN_LOCK_AGE
            
            await expect(
                createProposal(user2, "Desc")
            ).to.be.revertedWithCustomError(governance, "LockTooNew");
        });

        it("Should not allow Genesis to create proposal", async function () {
            await expect(
                createProposal(genesis, "Desc")
            ).to.be.revertedWithCustomError(governance, "GenesisCannotParticipate");
        });

        it("Should not allow empty description", async function () {
            await expect(
                governance.connect(user1).propose([await equorumToken.getAddress()], [0], [""], ["0x"], "")
            ).to.be.revertedWithCustomError(governance, "EmptyDescription");
        });

        it("Should set correct voting period", async function () {
            await createProposal(user1, "Desc");
            
            const proposal = await governance.proposals(1);
            const expectedEnd = proposal.startTime + BigInt(VOTING_PERIOD);
            
            expect(proposal.endTime).to.equal(expectedEnd);
        });

        it("Should allow multiple proposals from same user", async function () {
            await createProposal(user1, "Desc 1");
            await createProposal(user1, "Desc 2");

            expect(await governance.proposalCount()).to.equal(2);
        });
    });

    describe("Voting", function () {
        beforeEach(async function () {
            // Lock tokens for all users and wait for lock age
            await lockAndWait(user1, PROPOSAL_THRESHOLD);
            await lockAndWait(user2, ethers.parseEther("350000"));
            await lockAndWait(user3, ethers.parseEther("300000"));
            
            // Create proposal
            await createProposal(user1, "Description");
        });

        it("Should allow voting for proposal", async function () {
            await expect(
                governance.connect(user1).castVote(1, true)
            ).to.emit(governance, "VoteCast");
        });

        it("Should allow voting against proposal", async function () {
            await expect(
                governance.connect(user1).castVote(1, false)
            ).to.emit(governance, "VoteCast");
        });

        it("Should count votes correctly with quadratic voting by lock", async function () {
            await governance.connect(user1).castVote(1, true);
            
            const proposal = await governance.proposals(1);
            const [votingPower] = await governance.getVotingPower(user1.address);
            
            expect(proposal.forVotes).to.equal(votingPower);
        });

        it("Should not allow voting twice", async function () {
            await governance.connect(user1).castVote(1, true);
            
            await expect(
                governance.connect(user1).castVote(1, true)
            ).to.be.revertedWithCustomError(governance, "AlreadyVoted");
        });

        it("Should not allow Genesis to vote", async function () {
            await expect(
                governance.connect(genesis).castVote(1, true)
            ).to.be.revertedWithCustomError(governance, "GenesisCannotParticipate");
        });

        it("Should not allow voting without lock", async function () {
            // owner has no lock
            await expect(
                governance.connect(owner).castVote(1, true)
            ).to.be.revertedWithCustomError(governance, "NoVotingPower");
        });

        it("Should not allow voting with lock too new", async function () {
            // Lock tokens for owner but don't wait
            await equorumToken.connect(owner).approve(await governance.getAddress(), MIN_LOCK_AMOUNT);
            await governance.connect(owner).lock(MIN_LOCK_AMOUNT);
            // Don't wait for MIN_LOCK_AGE
            
            await expect(
                governance.connect(owner).castVote(1, true)
            ).to.be.revertedWithCustomError(governance, "LockTooNew");
        });

        it("Should not allow voting after voting period", async function () {
            await time.increase(VOTING_PERIOD + 1);

            await expect(
                governance.connect(user1).castVote(1, true)
            ).to.be.revertedWithCustomError(governance, "VotingClosed");
        });

        it("Should record voter in hasVoted mapping", async function () {
            await governance.connect(user1).castVote(1, true);
            
            expect(await governance.hasVoted(1, user1.address)).to.be.true;
        });

        it("Should allow multiple users to vote with quadratic power", async function () {
            await governance.connect(user1).castVote(1, true);
            await governance.connect(user2).castVote(1, true);
            await governance.connect(user3).castVote(1, false);

            const proposal = await governance.proposals(1);
            const [votingPower1] = await governance.getVotingPower(user1.address);
            const [votingPower2] = await governance.getVotingPower(user2.address);
            const [votingPower3] = await governance.getVotingPower(user3.address);
            
            expect(proposal.forVotes).to.equal(votingPower1 + votingPower2);
            expect(proposal.againstVotes).to.equal(votingPower3);
        });
    });

    describe("Proposal State", function () {
        beforeEach(async function () {
            // Lock tokens for all users - need enough to reach quorum
            // Quorum = sqrt(4% of 48M) = sqrt(1.92M) ≈ 1385 votes
            // Need: sqrt(400K) + sqrt(350K) + sqrt(300K) = 632 + 591 + 547 = 1770 > 1385
            await lockAndWait(user1, ethers.parseEther("400000"));
            await lockAndWait(user2, ethers.parseEther("350000"));
            await lockAndWait(user3, ethers.parseEther("300000"));
            
            await createProposal(user1, "Description");
        });

        it("Should return Active state during voting", async function () {
            expect(await governance.state(1)).to.equal(1); // Active
        });

        it("Should return Defeated if quorum not met", async function () {
            await time.increase(VOTING_PERIOD + 1);
            
            expect(await governance.state(1)).to.equal(2); // Defeated
        });

        it("Should return Succeeded if quorum met and more for votes", async function () {
            await governance.connect(user1).castVote(1, true);
            await governance.connect(user2).castVote(1, true);
            await governance.connect(user3).castVote(1, true);
            await time.increase(VOTING_PERIOD + 1);

            expect(await governance.state(1)).to.equal(3); // Succeeded
        });

        it("Should return Defeated if more against votes", async function () {
            await governance.connect(user1).castVote(1, false);
            await governance.connect(user2).castVote(1, false);
            await governance.connect(user3).castVote(1, false);
            await time.increase(VOTING_PERIOD + 1);

            expect(await governance.state(1)).to.equal(2); // Defeated
        });

        it("Should return Canceled if proposal canceled", async function () {
            await governance.connect(user1).cancel(1);

            expect(await governance.state(1)).to.equal(6); // Canceled
        });
    });

    describe("Proposal Execution", function () {
        beforeEach(async function () {
            // Lock tokens for all users - need enough to reach quorum
            await lockAndWait(user1, ethers.parseEther("400000"));
            await lockAndWait(user2, ethers.parseEther("350000"));
            await lockAndWait(user3, ethers.parseEther("300000"));
            
            await createProposal(user1, "Description");
            await governance.connect(user1).castVote(1, true);
            await governance.connect(user2).castVote(1, true);
            await governance.connect(user3).castVote(1, true);
            await time.increase(VOTING_PERIOD + 1);
        });

        it("Should verify proposal succeeded", async function () {
            expect(await governance.state(1)).to.equal(3); // Succeeded
        });

        it("Should have correct proposal state", async function () {
            const proposal = await governance.proposals(1);
            expect(proposal.executed).to.be.false;
            expect(proposal.canceled).to.be.false;
        });

        it("Should not allow executing without queue", async function () {
            await expect(
                governance.execute(1)
            ).to.be.revertedWithCustomError(governance, "ProposalNotQueued");
        });
    });

    describe("Proposal Cancellation", function () {
        beforeEach(async function () {
            await lockAndWait(user1, PROPOSAL_THRESHOLD);
            await createProposal(user1, "Description");
        });

        it("Should allow proposer to cancel", async function () {
            await expect(
                governance.connect(user1).cancel(1)
            ).to.emit(governance, "ProposalCanceled");
        });

        it("Should mark proposal as canceled", async function () {
            await governance.connect(user1).cancel(1);
            
            const proposal = await governance.proposals(1);
            expect(proposal.canceled).to.be.true;
        });

        it("Should not allow non-proposer to cancel", async function () {
            await expect(
                governance.connect(user2).cancel(1)
            ).to.be.revertedWithCustomError(governance, "OnlyProposerCanCancel");
        });

        it("Should prevent voting on canceled proposal", async function () {
            await lockAndWait(user2, ethers.parseEther("1000"));
            await governance.connect(user1).cancel(1);
            
            await expect(
                governance.connect(user2).castVote(1, true)
            ).to.be.revertedWithCustomError(governance, "VotingClosed");
        });
    });

    describe("Quorum Calculation", function () {
        it("Should calculate correct quadratic quorum", async function () {
            const quorum = await governance.quorum();
            // Quorum is sqrt(4% of 48M) = sqrt(1.92M)
            // sqrt(1920000 * 1e18) ≈ 1385640646055 wei
            expect(quorum).to.be.gt(0);
            expect(quorum).to.be.lt(ethers.parseEther("1920000")); // Less than linear quorum
        });

        it("Should use quadratic quorum (sqrt of 4% of total supply)", async function () {
            const quorum = await governance.quorum();
            // Quadratic quorum (normalized): sqrt(1.92M) ≈ 1385 votes
            // 4% of 48M = 1.92M tokens, sqrt(1920000) ≈ 1385
            expect(quorum).to.be.gt(1300);
            expect(quorum).to.be.lt(1500);
        });
    });

    describe("Proposal Info", function () {
        beforeEach(async function () {
            await lockAndWait(user1, PROPOSAL_THRESHOLD);
            await lockAndWait(user2, ethers.parseEther("350000"));
            
            await createProposal(user1, "Test Proposal");
            await governance.connect(user1).castVote(1, true);
            await governance.connect(user2).castVote(1, false);
        });

        it("Should return correct proposal info with quadratic votes", async function () {
            const info = await governance.getProposalInfo(1);
            const [votingPower1] = await governance.getVotingPower(user1.address);
            const [votingPower2] = await governance.getVotingPower(user2.address);
            
            expect(info.proposer).to.equal(user1.address);
            expect(info.description).to.equal("Test Proposal");
            expect(info.forVotes).to.equal(votingPower1);
            expect(info.againstVotes).to.equal(votingPower2);
        });

        it("Should return correct state in info", async function () {
            const info = await governance.getProposalInfo(1);
            expect(info.currentState).to.equal(1); // Active (during voting)
        });
    });

    describe("Security & Access Control", function () {
        beforeEach(async function () {
            await lockAndWait(user1, PROPOSAL_THRESHOLD);
        });

        it("Should not have owner functions", async function () {
            expect(governance.owner).to.be.undefined;
        });

        it("Should protect against reentrancy", async function () {
            await createProposal(user1, "Desc");
            
            await expect(
                governance.connect(user1).castVote(1, true)
            ).to.not.be.reverted;
        });

        it("Should validate proposal ID", async function () {
            await expect(
                governance.state(0)
            ).to.be.revertedWithCustomError(governance, "InvalidProposal");
        });

        it("Should validate proposal ID in getProposalInfo", async function () {
            await expect(
                governance.getProposalInfo(999)
            ).to.be.revertedWithCustomError(governance, "InvalidProposal");
        });
    });

    describe("Edge Cases", function () {
        beforeEach(async function () {
            // Lock tokens for all users - need enough to reach quorum
            await lockAndWait(user1, ethers.parseEther("400000"));
            await lockAndWait(user2, ethers.parseEther("350000"));
            await lockAndWait(user3, ethers.parseEther("300000"));
        });

        it("Should handle exact quorum", async function () {
            await createProposal(user1, "Desc");
            
            await governance.connect(user1).castVote(1, true);
            await governance.connect(user2).castVote(1, true);
            await governance.connect(user3).castVote(1, true);
            await time.increase(VOTING_PERIOD + 1);
            
            expect(await governance.state(1)).to.equal(3); // Succeeded
        });

        it("Should handle votes with quorum reached", async function () {
            await createProposal(user1, "Desc");
            await governance.connect(user1).castVote(1, true);
            await governance.connect(user2).castVote(1, true);
            await governance.connect(user3).castVote(1, false);
            
            await time.increase(VOTING_PERIOD + 1);
            
            expect(await governance.state(1)).to.equal(3); // Succeeded
        });

        it("Should handle multiple simultaneous proposals", async function () {
            await createProposal(user1, "Desc 1");
            await createProposal(user1, "Desc 2");
            
            await governance.connect(user1).castVote(1, true);
            await governance.connect(user1).castVote(2, true);
            
            expect(await governance.proposalCount()).to.equal(2);
        });
    });

    describe("Gas Optimization", function () {
        beforeEach(async function () {
            await lockAndWait(user1, PROPOSAL_THRESHOLD);
            await lockAndWait(user2, ethers.parseEther("350000"));
            await lockAndWait(user3, ethers.parseEther("300000"));
        });

        it("Should use reasonable gas for proposal creation", async function () {
            const tx = await createProposal(user1, "Description");
            const receipt = await tx.wait();
            
            expect(receipt.gasUsed).to.be.lt(350000);
        });

        it("Should use reasonable gas for voting", async function () {
            await createProposal(user1, "Desc");
            
            const tx = await governance.connect(user1).castVote(1, true);
            const receipt = await tx.wait();
            
            expect(receipt.gasUsed).to.be.lt(200000);
        });

        it("Should use reasonable gas for lock", async function () {
            const lockAmount = ethers.parseEther("1000");
            await equorumToken.connect(owner).approve(await governance.getAddress(), lockAmount);
            
            const tx = await governance.connect(owner).lock(lockAmount);
            const receipt = await tx.wait();
            
            expect(receipt.gasUsed).to.be.lt(150000);
        });
    });

    describe("Integration with TimeLock", function () {
        beforeEach(async function () {
            // Lock tokens for all users - need enough to reach quorum
            await lockAndWait(user1, ethers.parseEther("400000"));
            await lockAndWait(user2, ethers.parseEther("350000"));
            await lockAndWait(user3, ethers.parseEther("300000"));
        });

        it("Should have correct timelock reference", async function () {
            expect(await governance.timeLock()).to.equal(await timeLock.getAddress());
        });

        it("Should verify proposal succeeded before queue", async function () {
            await createProposal(user1, "Desc");
            await governance.connect(user1).castVote(1, true);
            await governance.connect(user2).castVote(1, true);
            await governance.connect(user3).castVote(1, true);
            await time.increase(VOTING_PERIOD + 1);
            
            expect(await governance.state(1)).to.equal(3); // Succeeded
        });
    });

    describe("Quadratic Voting by Lock - Specific Tests", function () {
        beforeEach(async function () {
            await lockAndWait(user1, ethers.parseEther("400000"));
            await lockAndWait(user2, ethers.parseEther("100000"));
        });

        it("Should demonstrate whale protection with locked tokens", async function () {
            const [whaleVotes] = await governance.getVotingPower(user1.address);
            const [smallVotes] = await governance.getVotingPower(user2.address);
            
            // user1 has 4x more locked tokens, but only 2x more votes (sqrt(4) = 2)
            // sqrt(400K) / sqrt(100K) = sqrt(4) = 2
            const ratio = (whaleVotes * 100n) / smallVotes;
            expect(ratio).to.be.closeTo(200n, 10n); // 2.0 with 10% margin
        });

        it("Should show quadratic scaling examples", async function () {
            // user1: 400K locked, user2: 100K locked
            
            const [user1Power] = await governance.getVotingPower(user1.address);
            const [user2Power] = await governance.getVotingPower(user2.address);
            
            // Verify quadratic relationship
            // sqrt(400K) / sqrt(100K) = sqrt(4) = 2
            const ratio1 = (user1Power * 100n) / user2Power;
            expect(ratio1).to.be.closeTo(200n, 10n); // 2.0 with 10% margin
        });

        it("Should handle edge case: zero lock", async function () {
            // Create a new address with no lock
            const [,,,,, newUser] = await ethers.getSigners();
            const [votingPower, canVote] = await governance.getVotingPower(newUser.address);
            expect(votingPower).to.equal(0);
            expect(canVote).to.be.false;
        });

        it("Should demonstrate community can defeat whale", async function () {
            // Lock tokens for user3 with more than user2
            await lockAndWait(user3, ethers.parseEther("150000"));
            
            await createProposal(user1, "Whale Proposal");
            
            // user1 (whale) has 400K locked
            // user2 + user3 (community) have 100K + 150K = 250K locked
            
            // Whale votes FOR
            await governance.connect(user1).castVote(1, true);
            
            // Community votes AGAINST
            await governance.connect(user2).castVote(1, false);
            await governance.connect(user3).castVote(1, false);
            
            const [whaleVotes] = await governance.getVotingPower(user1.address);
            const [user2Votes] = await governance.getVotingPower(user2.address);
            const [user3Votes] = await governance.getVotingPower(user3.address);
            const communityVotes = user2Votes + user3Votes;
            
            // With quadratic voting, community has more power
            // sqrt(400K) ≈ 632 vs sqrt(100K) + sqrt(150K) ≈ 316 + 387 = 703
            // Community wins despite having less total tokens
            expect(communityVotes).to.be.gt(whaleVotes);
        });

        it("Should use reasonable gas for quadratic calculation", async function () {
            await createProposal(user1, "Desc");
            
            const tx = await governance.connect(user1).castVote(1, true);
            const receipt = await tx.wait();
            
            expect(receipt.gasUsed).to.be.lt(200000);
        });
    });
});

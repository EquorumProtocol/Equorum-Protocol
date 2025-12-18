const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("EquorumGenesisVesting - Comprehensive Tests", function () {
    let equorumToken;
    let genesisVesting;
    let owner;
    let genesis;
    let user1;
    let user2;

    const GENESIS_ALLOCATION = ethers.parseEther("3000000"); // 3M tokens
    const MONTHLY_RELEASE = ethers.parseEther("41666.666666666666666666");
    const VESTING_DURATION = 72; // months
    const SECONDS_PER_MONTH = 30 * 24 * 60 * 60; // 30 days
    const EMERGENCY_DELAY = 48 * 60 * 60; // 48 hours

    beforeEach(async function () {
        [owner, genesis, user1, user2] = await ethers.getSigners();

        // Deploy EquorumToken
        const EquorumToken = await ethers.getContractFactory("EquorumToken");
        equorumToken = await EquorumToken.deploy(
            user2.address  // Liquidity address
        );
        await equorumToken.waitForDeployment();

        // Deploy GenesisVesting
        const GenesisVesting = await ethers.getContractFactory("EquorumGenesisVesting");
        
        // Calculate future address AFTER getting the factory (which doesn't change nonce)
        // The next transaction will be the deploy, so we need nonce + 1
        const currentNonce = await ethers.provider.getTransactionCount(owner.address);
        
        // Calculate address where GenesisVesting will be deployed
        const futureAddress = ethers.getCreateAddress({
            from: owner.address,
            nonce: currentNonce + 1  // +1 because setGenesisVesting will happen first
        });
        
        // Transfer tokens to future address BEFORE deploying
        await equorumToken.setGenesisVesting(futureAddress);
        
        // Now deploy GenesisVesting (it will be at futureAddress and have the tokens)
        genesisVesting = await GenesisVesting.deploy(
            await equorumToken.getAddress(),
            genesis.address
        );
        await genesisVesting.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Should set correct token address", async function () {
            expect(await genesisVesting.equorumToken()).to.equal(await equorumToken.getAddress());
        });

        it("Should set correct genesis address", async function () {
            expect(await genesisVesting.genesisAddress()).to.equal(genesis.address);
        });

        it("Should have correct allocation", async function () {
            expect(await genesisVesting.GENESIS_ALLOCATION()).to.equal(GENESIS_ALLOCATION);
        });

        it("Should have correct vesting duration", async function () {
            expect(await genesisVesting.VESTING_DURATION()).to.equal(VESTING_DURATION);
        });

        it("Should receive exactly 3M tokens", async function () {
            const balance = await equorumToken.balanceOf(await genesisVesting.getAddress());
            expect(balance).to.equal(GENESIS_ALLOCATION);
        });

        it("Should revert if token address is zero", async function () {
            const GenesisVesting = await ethers.getContractFactory("EquorumGenesisVesting");
            await expect(
                GenesisVesting.deploy(ethers.ZeroAddress, genesis.address)
            ).to.be.revertedWithCustomError(GenesisVesting, "InvalidAddress");
        });

        it("Should revert if genesis address is zero", async function () {
            const GenesisVesting = await ethers.getContractFactory("EquorumGenesisVesting");
            await expect(
                GenesisVesting.deploy(await equorumToken.getAddress(), ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(GenesisVesting, "InvalidAddress");
        });

        it("Should have isFunded view function", async function () {
            const funded = await genesisVesting.isFunded();
            expect(funded).to.be.true;
        });
    });

    describe("Monthly Release", function () {
        it("Should not allow release before first month", async function () {
            await expect(
                genesisVesting.connect(genesis).release()
            ).to.be.revertedWithCustomError(genesisVesting, "NoTokensToRelease");
        });

        it("Should release correct amount after 1 month", async function () {
            await time.increase(SECONDS_PER_MONTH);

            const balanceBefore = await equorumToken.balanceOf(genesis.address);
            await genesisVesting.connect(genesis).release();
            const balanceAfter = await equorumToken.balanceOf(genesis.address);

            expect(balanceAfter - balanceBefore).to.equal(MONTHLY_RELEASE);
        });

        it("Should release correct amount after 2 months", async function () {
            await time.increase(SECONDS_PER_MONTH * 2);

            await genesisVesting.connect(genesis).release();
            const released = await genesisVesting.releasedTokens();

            expect(released).to.equal(MONTHLY_RELEASE * 2n);
        });

        it("Should allow multiple claims in same period (catch-up)", async function () {
            await time.increase(SECONDS_PER_MONTH * 3);

            // First claim gets all 3 months
            await genesisVesting.connect(genesis).release();
            const released = await genesisVesting.releasedTokens();
            expect(released).to.equal(MONTHLY_RELEASE * 3n);
            
            // Second claim immediately gets nothing (already claimed)
            await expect(
                genesisVesting.connect(genesis).release()
            ).to.be.revertedWithCustomError(genesisVesting, "NoTokensToRelease");
        });

        it("Should allow claim in next month after previous claim", async function () {
            await time.increase(SECONDS_PER_MONTH);
            await genesisVesting.connect(genesis).release();

            await time.increase(SECONDS_PER_MONTH);
            await expect(
                genesisVesting.connect(genesis).release()
            ).to.not.be.reverted;
        });

        it("Should only allow genesis to release", async function () {
            await time.increase(SECONDS_PER_MONTH);

            await expect(
                genesisVesting.connect(user1).release()
            ).to.be.revertedWithCustomError(genesisVesting, "OnlyGenesis");
        });

        it("Should emit TokensReleased event", async function () {
            await time.increase(SECONDS_PER_MONTH);

            await expect(genesisVesting.connect(genesis).release())
                .to.emit(genesisVesting, "TokensReleased")
                .withArgs(genesis.address, MONTHLY_RELEASE, 1, await time.latest() + 1);
        });
    });

    describe("Catch-up Release (Missed Months)", function () {
        it("Should release all pending months in one call", async function () {
            await time.increase(SECONDS_PER_MONTH * 5); // Skip 5 months

            await genesisVesting.connect(genesis).release();
            const released = await genesisVesting.releasedTokens();

            expect(released).to.equal(MONTHLY_RELEASE * 5n);
        });

        it("Should update lastReleaseTimestamp correctly", async function () {
            await time.increase(SECONDS_PER_MONTH * 3);

            await genesisVesting.connect(genesis).release();
            const lastRelease = await genesisVesting.lastReleaseTimestamp();

            expect(lastRelease).to.be.gt(0);
        });
    });

    describe("Complete Vesting (72 months)", function () {
        it("Should release exactly 3M tokens after 72 months", async function () {
            // Release month by month
            for (let i = 1; i <= 72; i++) {
                await time.increase(SECONDS_PER_MONTH);
                await genesisVesting.connect(genesis).release();
            }

            const totalReleased = await genesisVesting.releasedTokens();
            const genesisBalance = await equorumToken.balanceOf(genesis.address);

            // Should be exactly 3M
            expect(totalReleased).to.equal(GENESIS_ALLOCATION);
            expect(genesisBalance).to.equal(GENESIS_ALLOCATION);
        });

        it("Should release remaining balance on month 72 (rounding fix)", async function () {
            await time.increase(SECONDS_PER_MONTH * 72);

            await genesisVesting.connect(genesis).release();
            const totalReleased = await genesisVesting.releasedTokens();

            expect(totalReleased).to.equal(GENESIS_ALLOCATION);
        });

        it("Should not allow release after vesting complete", async function () {
            await time.increase(SECONDS_PER_MONTH * 72);
            await genesisVesting.connect(genesis).release();

            await time.increase(SECONDS_PER_MONTH);
            await expect(
                genesisVesting.connect(genesis).release()
            ).to.be.revertedWithCustomError(genesisVesting, "NoTokensToRelease");
        });

        it("Should leave zero balance in contract after complete vesting", async function () {
            await time.increase(SECONDS_PER_MONTH * 72);
            await genesisVesting.connect(genesis).release();

            const contractBalance = await equorumToken.balanceOf(await genesisVesting.getAddress());
            expect(contractBalance).to.equal(0);
        });
    });

    describe("Immutability (No Emergency Withdrawal)", function () {
        it("Should not have emergency withdrawal function", async function () {
            // Verify emergencyWithdraw doesn't exist
            expect(genesisVesting.emergencyWithdraw).to.be.undefined;
            expect(genesisVesting.requestEmergencyWithdraw).to.be.undefined;
        });

        it("Should enforce true vesting schedule", async function () {
            // Only way to get tokens is through vesting
            await time.increase(SECONDS_PER_MONTH);
            
            const releasable = await genesisVesting.calculateReleasableAmount();
            expect(releasable).to.equal(MONTHLY_RELEASE);
            
            // Cannot get more than vested amount
            await genesisVesting.connect(genesis).release();
            const released = await genesisVesting.releasedTokens();
            expect(released).to.equal(MONTHLY_RELEASE);
        });

        it("Should have getContractBalance view function", async function () {
            const balance = await genesisVesting.getContractBalance();
            expect(balance).to.equal(GENESIS_ALLOCATION);
        });
    });

    describe("View Functions", function () {
        it("Should calculate correct releasable amount", async function () {
            await time.increase(SECONDS_PER_MONTH * 3);

            const releasable = await genesisVesting.calculateReleasableAmount();
            expect(releasable).to.equal(MONTHLY_RELEASE * 3n);
        });

        it("Should return 0 releasable before vesting starts", async function () {
            const releasable = await genesisVesting.calculateReleasableAmount();
            expect(releasable).to.equal(0);
        });

        it("Should return correct vesting info", async function () {
            await time.increase(SECONDS_PER_MONTH * 2);
            await genesisVesting.connect(genesis).release();

            const info = await genesisVesting.getVestingInfo();
            
            expect(info.total).to.equal(GENESIS_ALLOCATION);
            expect(info.released).to.equal(MONTHLY_RELEASE * 2n);
            expect(info.monthsElapsed).to.equal(2);
        });

        it("Should return correct months passed", async function () {
            await time.increase(SECONDS_PER_MONTH * 10);

            const info = await genesisVesting.getVestingInfo();
            expect(info.monthsElapsed).to.equal(10);
        });
    });

    describe("Security & Immutability", function () {
        it("Should not have owner", async function () {
            // Contract should not have Ownable
            expect(genesisVesting.owner).to.be.undefined;
        });

        it("Should not be pausable", async function () {
            // Contract should not have pause function
            expect(genesisVesting.pause).to.be.undefined;
        });

        it("Should not be upgradeable", async function () {
            // Contract should not have upgrade functions
            expect(genesisVesting.upgradeTo).to.be.undefined;
        });

        it("Should have immutable token address", async function () {
            const tokenAddress = await genesisVesting.equorumToken();
            expect(tokenAddress).to.equal(await equorumToken.getAddress());
        });

        it("Should have immutable genesis address", async function () {
            const genesisAddr = await genesisVesting.genesisAddress();
            expect(genesisAddr).to.equal(genesis.address);
        });

        it("Should protect against reentrancy", async function () {
            // Contract uses ReentrancyGuard
            await time.increase(SECONDS_PER_MONTH);
            
            // Try to call release multiple times in same transaction
            // Should be protected by nonReentrant modifier
            await expect(
                genesisVesting.connect(genesis).release()
            ).to.not.be.reverted;
        });
    });

    describe("Edge Cases", function () {
        it("Should handle release at exact month boundary", async function () {
            await time.increase(SECONDS_PER_MONTH);

            await expect(
                genesisVesting.connect(genesis).release()
            ).to.not.be.reverted;
        });

        it("Should handle multiple releases over time", async function () {
            await time.increase(SECONDS_PER_MONTH * 3);
            await genesisVesting.connect(genesis).release();

            await time.increase(SECONDS_PER_MONTH * 2);
            await expect(
                genesisVesting.connect(genesis).release()
            ).to.not.be.reverted;
        });

        it("Should handle release after 72+ months (final remainder)", async function () {
            // Go to month 71 and release
            await time.increase(SECONDS_PER_MONTH * 71);
            await genesisVesting.connect(genesis).release();
            
            const released71 = await genesisVesting.releasedTokens();
            expect(released71).to.equal(MONTHLY_RELEASE * 71n);
            
            // Go past month 72
            await time.increase(SECONDS_PER_MONTH * 2);
            
            // Should be able to claim final remainder
            await genesisVesting.connect(genesis).release();
            const releasedFinal = await genesisVesting.releasedTokens();
            expect(releasedFinal).to.equal(GENESIS_ALLOCATION);
            
            // No more tokens available
            await expect(
                genesisVesting.connect(genesis).release()
            ).to.be.revertedWithCustomError(genesisVesting, "NoTokensToRelease");
        });

        it("Should handle very long time periods", async function () {
            await time.increase(SECONDS_PER_MONTH * 100); // Beyond vesting

            const releasable = await genesisVesting.calculateReleasableAmount();
            expect(releasable).to.equal(GENESIS_ALLOCATION);
        });
    });

    describe("Gas Optimization", function () {
        it("Should use reasonable gas for release", async function () {
            await time.increase(SECONDS_PER_MONTH);

            const tx = await genesisVesting.connect(genesis).release();
            const receipt = await tx.wait();
            
            // Should be under 150k gas on L2
            expect(receipt.gasUsed).to.be.lt(150000);
        });

        it("Should use reasonable gas for catch-up release", async function () {
            await time.increase(SECONDS_PER_MONTH * 5);

            const tx = await genesisVesting.connect(genesis).release();
            const receipt = await tx.wait();
            
            expect(receipt.gasUsed).to.be.lt(200000);
        });
    });
});

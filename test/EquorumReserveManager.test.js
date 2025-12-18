const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EquorumReserveManager", function () {
    let equorumToken, reserveManager, owner, foundation, corporate, recipient1, recipient2, user1;
    const FOUNDATION_ALLOCATION = ethers.parseEther("122000");
    const CORPORATE_ALLOCATION = ethers.parseEther("122000");
    const TOTAL_ALLOCATION = ethers.parseEther("244000");

    beforeEach(async function () {
        [owner, foundation, corporate, recipient1, recipient2, user1] = await ethers.getSigners();
        
        const EquorumToken = await ethers.getContractFactory("EquorumToken");
        equorumToken = await EquorumToken.deploy(owner.address); // liquidityAddress
        await equorumToken.waitForDeployment();
        
        const ReserveManager = await ethers.getContractFactory("EquorumReserveManager");
        reserveManager = await ReserveManager.deploy(await equorumToken.getAddress());
        await reserveManager.waitForDeployment();
        
        await equorumToken.setReserveManager(await reserveManager.getAddress());
    });

    describe("Deployment", function () {
        it("Should set correct token address", async function () {
            expect(await reserveManager.equorumToken()).to.equal(await equorumToken.getAddress());
        });

        it("Should start paused", async function () {
            expect(await reserveManager.paused()).to.be.true;
        });

        it("Should receive correct allocation", async function () {
            const balance = await equorumToken.balanceOf(await reserveManager.getAddress());
            expect(balance).to.equal(TOTAL_ALLOCATION);
        });

        it("Should have zero released initially", async function () {
            expect(await reserveManager.foundationReleased()).to.equal(0);
            expect(await reserveManager.corporateReleased()).to.equal(0);
        });
    });

    describe("Address Configuration", function () {
        it("Should allow owner to set foundation address", async function () {
            await reserveManager.setFoundationAddress(foundation.address);
            expect(await reserveManager.foundationAddress()).to.equal(foundation.address);
        });

        it("Should allow owner to set corporate address", async function () {
            await reserveManager.setCorporateAddress(corporate.address);
            expect(await reserveManager.corporateAddress()).to.equal(corporate.address);
        });

        it("Should not allow zero address", async function () {
            await expect(
                reserveManager.setFoundationAddress(ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(reserveManager, "InvalidAddress");
        });

        it("Should not allow activate without addresses configured", async function () {
            await expect(
                reserveManager.activate()
            ).to.be.revertedWithCustomError(reserveManager, "AddressesNotConfigured");
        });

        it("Should allow activate with only foundation address", async function () {
            await reserveManager.setFoundationAddress(foundation.address);
            await reserveManager.activate();
            expect(await reserveManager.paused()).to.be.false;
        });

        it("Should allow activate with only corporate address", async function () {
            await reserveManager.setCorporateAddress(corporate.address);
            await reserveManager.activate();
            expect(await reserveManager.paused()).to.be.false;
        });
    });

    describe("Recipient Approval", function () {
        it("Should allow owner to approve recipient", async function () {
            await reserveManager.approveRecipient(recipient1.address, true);
            expect(await reserveManager.approvedRecipients(recipient1.address)).to.be.true;
        });

        it("Should allow batch approval", async function () {
            await reserveManager.batchApproveRecipients(
                [recipient1.address, recipient2.address],
                [true, true]
            );
            expect(await reserveManager.approvedRecipients(recipient1.address)).to.be.true;
            expect(await reserveManager.approvedRecipients(recipient2.address)).to.be.true;
        });
    });

    describe("Foundation Release", function () {
        beforeEach(async function () {
            await reserveManager.setFoundationAddress(foundation.address);
            await reserveManager.approveRecipient(recipient1.address, true);
            await reserveManager.activate();
        });

        it("Should allow release to approved recipient", async function () {
            const amount = ethers.parseEther("10000");
            await reserveManager.releaseFoundation(recipient1.address, amount, "Security audit");
            expect(await equorumToken.balanceOf(recipient1.address)).to.equal(amount);
        });

        it("Should allow release to foundation address", async function () {
            const amount = ethers.parseEther("10000");
            await reserveManager.releaseFoundation(foundation.address, amount, "Operations");
            expect(await equorumToken.balanceOf(foundation.address)).to.equal(amount);
        });

        it("Should update foundationReleased", async function () {
            const amount = ethers.parseEther("10000");
            await reserveManager.releaseFoundation(recipient1.address, amount, "Test");
            expect(await reserveManager.foundationReleased()).to.equal(amount);
        });

        it("Should not exceed allocation", async function () {
            await expect(
                reserveManager.releaseFoundation(recipient1.address, ethers.parseEther("150000"), "Test")
            ).to.be.revertedWithCustomError(reserveManager, "ExceedsFoundationAllocation");
        });

        it("Should require purpose", async function () {
            await expect(
                reserveManager.releaseFoundation(recipient1.address, ethers.parseEther("1000"), "")
            ).to.be.revertedWithCustomError(reserveManager, "PurposeRequired");
        });

        it("Should not allow unapproved recipient", async function () {
            await expect(
                reserveManager.releaseFoundation(recipient2.address, ethers.parseEther("1000"), "Test")
            ).to.be.revertedWithCustomError(reserveManager, "RecipientNotApproved");
        });
    });

    describe("Corporate Release", function () {
        beforeEach(async function () {
            await reserveManager.setCorporateAddress(corporate.address);
            await reserveManager.approveRecipient(recipient1.address, true);
            await reserveManager.activate();
        });

        it("Should allow release to approved recipient", async function () {
            const amount = ethers.parseEther("20000");
            await reserveManager.releaseCorporate(recipient1.address, amount, "Listing fee");
            expect(await equorumToken.balanceOf(recipient1.address)).to.equal(amount);
        });

        it("Should update corporateReleased", async function () {
            const amount = ethers.parseEther("20000");
            await reserveManager.releaseCorporate(recipient1.address, amount, "Test");
            expect(await reserveManager.corporateReleased()).to.equal(amount);
        });

        it("Should not exceed allocation", async function () {
            await expect(
                reserveManager.releaseCorporate(recipient1.address, ethers.parseEther("150000"), "Test")
            ).to.be.revertedWithCustomError(reserveManager, "ExceedsCorporateAllocation");
        });
    });

    describe("View Functions", function () {
        it("Should return correct reserve stats", async function () {
            const stats = await reserveManager.getReserveStats();
            expect(stats.foundationRemaining).to.equal(FOUNDATION_ALLOCATION);
            expect(stats.corporateRemaining).to.equal(CORPORATE_ALLOCATION);
            expect(stats.totalRemaining).to.equal(TOTAL_ALLOCATION);
        });

        it("Should return recipient info", async function () {
            await reserveManager.approveRecipient(recipient1.address, true);
            const info = await reserveManager.getRecipientInfo(recipient1.address);
            expect(info.approved).to.be.true;
            expect(info.releases).to.equal(0);
        });
    });

    describe("Emergency Functions", function () {
        it("Should allow emergency withdraw", async function () {
            const amount = ethers.parseEther("1000");
            await reserveManager.emergencyWithdraw(owner.address, amount);
            expect(await equorumToken.balanceOf(owner.address)).to.be.gte(amount);
        });
    });

    describe("IEquorumCore Implementation", function () {
        it("Should emergency stop", async function () {
            await reserveManager.setFoundationAddress(foundation.address);
            await reserveManager.activate();
            await reserveManager.emergencyStop("Test");
            expect(await reserveManager.paused()).to.be.true;
        });

        it("Should validate state", async function () {
            const checksum = await reserveManager.validateState();
            expect(checksum).to.not.equal(ethers.ZeroHash);
        });
    });
});

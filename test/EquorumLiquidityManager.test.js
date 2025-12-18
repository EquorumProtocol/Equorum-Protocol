const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EquorumLiquidityManager", function () {
    let equorumToken;
    let liquidityManager;
    let owner;
    let pool1;
    let pool2;
    let user1;

    const LIQUIDITY_ALLOCATION = ethers.parseEther("500000");

    beforeEach(async function () {
        [owner, pool1, pool2, user1] = await ethers.getSigners();

        // Deploy EquorumToken first (liquidity goes to owner temporarily)
        const EquorumToken = await ethers.getContractFactory("EquorumToken");
        equorumToken = await EquorumToken.deploy(owner.address); // liquidityAddress
        await equorumToken.waitForDeployment();

        // Deploy LiquidityManager
        const LiquidityManager = await ethers.getContractFactory("EquorumLiquidityManager");
        liquidityManager = await LiquidityManager.deploy(await equorumToken.getAddress());
        await liquidityManager.waitForDeployment();

        // Transfer LIQUIDITY_ALLOCATION from owner to liquidity manager
        // (owner received it in the constructor as _liquidityAddress)
        await equorumToken.transfer(await liquidityManager.getAddress(), LIQUIDITY_ALLOCATION);
    });

    describe("Deployment", function () {
        it("Should set correct token address", async function () {
            expect(await liquidityManager.equorumToken()).to.equal(await equorumToken.getAddress());
        });

        it("Should start paused", async function () {
            expect(await liquidityManager.paused()).to.be.true;
        });

        it("Should receive correct allocation", async function () {
            const balance = await equorumToken.balanceOf(await liquidityManager.getAddress());
            expect(balance).to.equal(LIQUIDITY_ALLOCATION);
        });

        it("Should have zero deployed initially", async function () {
            expect(await liquidityManager.totalDeployed()).to.equal(0);
        });
    });

    describe("Pool Approval", function () {
        it("Should allow owner to approve pool", async function () {
            await liquidityManager.approvePool(pool1.address, true);
            expect(await liquidityManager.approvedPools(pool1.address)).to.be.true;
        });

        it("Should not allow non-owner to approve pool", async function () {
            await expect(
                liquidityManager.connect(user1).approvePool(pool1.address, true)
            ).to.be.reverted;
        });

        it("Should allow owner to revoke pool approval", async function () {
            await liquidityManager.approvePool(pool1.address, true);
            await liquidityManager.approvePool(pool1.address, false);
            expect(await liquidityManager.approvedPools(pool1.address)).to.be.false;
        });

        it("Should not allow zero address", async function () {
            await expect(
                liquidityManager.approvePool(ethers.ZeroAddress, true)
            ).to.be.revertedWith("Invalid pool address");
        });

        it("Should allow batch approval", async function () {
            await liquidityManager.batchApprovePool(
                [pool1.address, pool2.address],
                [true, true]
            );
            
            expect(await liquidityManager.approvedPools(pool1.address)).to.be.true;
            expect(await liquidityManager.approvedPools(pool2.address)).to.be.true;
        });

        it("Should revert batch approval with length mismatch", async function () {
            await expect(
                liquidityManager.batchApprovePool(
                    [pool1.address, pool2.address],
                    [true]
                )
            ).to.be.revertedWith("Length mismatch");
        });
    });

    describe("Liquidity Deployment", function () {
        beforeEach(async function () {
            await liquidityManager.approvePool(pool1.address, true);
            await liquidityManager.activate();
        });

        it("Should allow owner to deploy liquidity", async function () {
            const amount = ethers.parseEther("100000");
            await liquidityManager.deployLiquidity(pool1.address, amount);
            
            const balance = await equorumToken.balanceOf(pool1.address);
            expect(balance).to.equal(amount);
        });

        it("Should update totalDeployed", async function () {
            const amount = ethers.parseEther("100000");
            await liquidityManager.deployLiquidity(pool1.address, amount);
            
            expect(await liquidityManager.totalDeployed()).to.equal(amount);
        });

        it("Should update deployedToPools mapping", async function () {
            const amount = ethers.parseEther("100000");
            await liquidityManager.deployLiquidity(pool1.address, amount);
            
            expect(await liquidityManager.deployedToPools(pool1.address)).to.equal(amount);
        });

        it("Should increment deployment count", async function () {
            const amount = ethers.parseEther("50000");
            await liquidityManager.deployLiquidity(pool1.address, amount);
            await liquidityManager.deployLiquidity(pool1.address, amount);
            
            expect(await liquidityManager.deploymentCount(pool1.address)).to.equal(2);
        });

        it("Should not allow deployment to unapproved pool", async function () {
            const amount = ethers.parseEther("100000");
            
            await expect(
                liquidityManager.deployLiquidity(pool2.address, amount)
            ).to.be.revertedWith("Pool not approved");
        });

        it("Should not allow deployment exceeding allocation", async function () {
            const amount = ethers.parseEther("600000"); // More than 500K
            
            await expect(
                liquidityManager.deployLiquidity(pool1.address, amount)
            ).to.be.revertedWith("Exceeds allocation");
        });

        it("Should not allow zero amount", async function () {
            await expect(
                liquidityManager.deployLiquidity(pool1.address, 0)
            ).to.be.revertedWith("Amount must be greater than zero");
        });

        it("Should not allow deployment when paused", async function () {
            await liquidityManager.deactivate();
            
            await expect(
                liquidityManager.deployLiquidity(pool1.address, ethers.parseEther("100000"))
            ).to.be.reverted;
        });

        it("Should allow multiple deployments to different pools", async function () {
            await liquidityManager.approvePool(pool2.address, true);
            
            const amount1 = ethers.parseEther("200000");
            const amount2 = ethers.parseEther("150000");
            
            await liquidityManager.deployLiquidity(pool1.address, amount1);
            await liquidityManager.deployLiquidity(pool2.address, amount2);
            
            expect(await liquidityManager.totalDeployed()).to.equal(amount1 + amount2);
        });
    });

    describe("Liquidity Withdrawal Tracking", function () {
        beforeEach(async function () {
            await liquidityManager.approvePool(pool1.address, true);
            await liquidityManager.activate();
            
            const amount = ethers.parseEther("200000");
            await liquidityManager.deployLiquidity(pool1.address, amount);
        });

        it("Should allow owner to update withdrawal tracking", async function () {
            const amount = ethers.parseEther("50000");
            await liquidityManager.withdrawLiquidity(pool1.address, amount);
            
            expect(await liquidityManager.deployedToPools(pool1.address)).to.equal(
                ethers.parseEther("150000")
            );
        });

        it("Should update totalDeployed on withdrawal", async function () {
            const amount = ethers.parseEther("50000");
            await liquidityManager.withdrawLiquidity(pool1.address, amount);
            
            expect(await liquidityManager.totalDeployed()).to.equal(
                ethers.parseEther("150000")
            );
        });

        it("Should not allow withdrawal exceeding deployed amount", async function () {
            const amount = ethers.parseEther("300000");
            
            await expect(
                liquidityManager.withdrawLiquidity(pool1.address, amount)
            ).to.be.revertedWith("Insufficient deployed amount");
        });
    });

    describe("View Functions", function () {
        beforeEach(async function () {
            await liquidityManager.approvePool(pool1.address, true);
            await liquidityManager.activate();
        });

        it("Should return available liquidity", async function () {
            const available = await liquidityManager.getAvailableLiquidity();
            expect(available).to.equal(LIQUIDITY_ALLOCATION);
        });

        it("Should return correct pool stats", async function () {
            const amount = ethers.parseEther("100000");
            await liquidityManager.deployLiquidity(pool1.address, amount);
            
            const stats = await liquidityManager.getPoolStats(pool1.address);
            expect(stats.deployed).to.equal(amount);
            expect(stats.count).to.equal(1);
            expect(stats.approved).to.be.true;
        });

        it("Should return correct liquidity stats", async function () {
            const amount = ethers.parseEther("100000");
            await liquidityManager.deployLiquidity(pool1.address, amount);
            
            const stats = await liquidityManager.getLiquidityStats();
            expect(stats.total).to.equal(LIQUIDITY_ALLOCATION);
            expect(stats.deployed).to.equal(amount);
            expect(stats.available).to.equal(LIQUIDITY_ALLOCATION - amount);
            expect(stats.isPaused).to.be.false;
        });
    });

    describe("Activation", function () {
        it("Should allow owner to activate", async function () {
            await liquidityManager.activate();
            expect(await liquidityManager.paused()).to.be.false;
        });

        it("Should allow owner to deactivate", async function () {
            await liquidityManager.activate();
            await liquidityManager.deactivate();
            expect(await liquidityManager.paused()).to.be.true;
        });

        it("Should not allow non-owner to activate", async function () {
            await expect(
                liquidityManager.connect(user1).activate()
            ).to.be.reverted;
        });
    });

    describe("Emergency Functions", function () {
        it("Should allow owner to emergency withdraw", async function () {
            const amount = ethers.parseEther("10000");
            await liquidityManager.emergencyWithdraw(owner.address, amount);
            
            const balance = await equorumToken.balanceOf(owner.address);
            expect(balance).to.be.gte(amount);
        });

        it("Should not allow non-owner to emergency withdraw", async function () {
            await expect(
                liquidityManager.connect(user1).emergencyWithdraw(user1.address, 1000)
            ).to.be.reverted;
        });

        it("Should not allow emergency withdraw to zero address", async function () {
            await expect(
                liquidityManager.emergencyWithdraw(ethers.ZeroAddress, 1000)
            ).to.be.revertedWith("Invalid address");
        });
    });

    describe("IEquorumCore Implementation", function () {
        it("Should process system action", async function () {
            await expect(
                liquidityManager.processSystemAction(2, "0x")
            ).to.not.be.reverted;
        });

        it("Should emergency stop", async function () {
            await liquidityManager.activate();
            await liquidityManager.emergencyStop("Test emergency");
            
            expect(await liquidityManager.paused()).to.be.true;
        });

        it("Should validate state", async function () {
            const checksum = await liquidityManager.validateState();
            expect(checksum).to.not.equal(ethers.ZeroHash);
        });

        it("Should verify integrations", async function () {
            const valid = await liquidityManager.verifyIntegrations([await equorumToken.getAddress()]);
            expect(valid).to.be.true;
        });
    });
});

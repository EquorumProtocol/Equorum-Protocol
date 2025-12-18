const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EquorumToken - Comprehensive Tests", function () {
    let equorumToken;
    let owner;
    let icoAddress;
    let liquidityAddress;
    let stakingAddress;
    let genesisVesting;
    let faucetAddress;
    let foundationAddress;
    let corporateAddress;
    let user1;
    let user2;

    const TOTAL_SUPPLY = ethers.parseEther("48000000");
    const STAKING_ALLOCATION = ethers.parseEther("38000000");
    const ICO_ALLOCATION = ethers.parseEther("4000000");
    const GENESIS_ALLOCATION = ethers.parseEther("3000000");
    const FAUCET_ALLOCATION = ethers.parseEther("2256000");
    const LIQUIDITY_ALLOCATION = ethers.parseEther("500000");
    const FOUNDATION_ALLOCATION = ethers.parseEther("122000");
    const CORPORATE_ALLOCATION = ethers.parseEther("122000");

    beforeEach(async function () {
        [owner, icoAddress, liquidityAddress, stakingAddress, genesisVesting, 
         faucetAddress, foundationAddress, corporateAddress, user1, user2] = await ethers.getSigners();

        const EquorumToken = await ethers.getContractFactory("EquorumToken");
        equorumToken = await EquorumToken.deploy(
            liquidityAddress.address
        );
        await equorumToken.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Should set correct name and symbol", async function () {
            expect(await equorumToken.name()).to.equal("Equorum Token");
            expect(await equorumToken.symbol()).to.equal("EQM");
        });

        it("Should have 18 decimals", async function () {
            expect(await equorumToken.decimals()).to.equal(18);
        });

        it("Should mint total supply to owner", async function () {
            expect(await equorumToken.totalSupply()).to.equal(TOTAL_SUPPLY);
        });

        it("Should keep ICO allocation in contract", async function () {
            const contractBalance = await equorumToken.balanceOf(await equorumToken.getAddress());
            // Contract should have: ICO (4M) + Staking (38M) + Genesis (3M) + Faucet (2.256M) + Reserve (244K)
            // Total: 47.5M (all except liquidity which was transferred)
            const expectedBalance = TOTAL_SUPPLY - LIQUIDITY_ALLOCATION;
            expect(contractBalance).to.equal(expectedBalance);
        });

        it("Should transfer liquidity allocation", async function () {
            expect(await equorumToken.balanceOf(liquidityAddress.address)).to.equal(LIQUIDITY_ALLOCATION);
        });

        it("Should set owner correctly", async function () {
            expect(await equorumToken.owner()).to.equal(owner.address);
        });

        it("Should have ICO contract as zero initially", async function () {
            expect(await equorumToken.icoContract()).to.equal(ethers.ZeroAddress);
        });

        it("Should revert if liquidity address is zero", async function () {
            const EquorumToken = await ethers.getContractFactory("EquorumToken");
            await expect(
                EquorumToken.deploy(ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(EquorumToken, "InvalidAddress");
        });
    });

    describe("Contract Configuration", function () {
        it("Should allow owner to set staking contract", async function () {
            await equorumToken.setStakingContract(stakingAddress.address);
            expect(await equorumToken.stakingContract()).to.equal(stakingAddress.address);
        });

        it("Should transfer staking allocation when set", async function () {
            await equorumToken.setStakingContract(stakingAddress.address);
            expect(await equorumToken.balanceOf(stakingAddress.address)).to.equal(STAKING_ALLOCATION);
        });

        it("Should not allow non-owner to set staking", async function () {
            await expect(
                equorumToken.connect(user1).setStakingContract(stakingAddress.address)
            ).to.be.reverted;
        });

        it("Should not allow setting staking twice", async function () {
            await equorumToken.setStakingContract(stakingAddress.address);
            await expect(
                equorumToken.setStakingContract(stakingAddress.address)
            ).to.be.revertedWithCustomError(equorumToken, "AlreadySet");
        });

        it("Should allow owner to set genesis vesting", async function () {
            await equorumToken.setGenesisVesting(genesisVesting.address);
            expect(await equorumToken.genesisVesting()).to.equal(genesisVesting.address);
        });

        it("Should transfer genesis allocation when set", async function () {
            await equorumToken.setGenesisVesting(genesisVesting.address);
            expect(await equorumToken.balanceOf(genesisVesting.address)).to.equal(GENESIS_ALLOCATION);
        });

        it("Should not allow setting genesis vesting twice", async function () {
            await equorumToken.setGenesisVesting(genesisVesting.address);
            await expect(
                equorumToken.setGenesisVesting(genesisVesting.address)
            ).to.be.revertedWithCustomError(equorumToken, "AlreadySet");
        });

        it("Should allow owner to set faucet", async function () {
            await equorumToken.setFaucetContract(faucetAddress.address);
            expect(await equorumToken.faucetContract()).to.equal(faucetAddress.address);
        });

        it("Should transfer faucet allocation when set", async function () {
            await equorumToken.setFaucetContract(faucetAddress.address);
            expect(await equorumToken.balanceOf(faucetAddress.address)).to.equal(FAUCET_ALLOCATION);
        });

        it("Should allow owner to set reserve manager", async function () {
            await equorumToken.setReserveManager(corporateAddress.address);
            expect(await equorumToken.reserveManager()).to.equal(corporateAddress.address);
        });

        it("Should transfer reserve allocation when set", async function () {
            const RESERVE_ALLOCATION = FOUNDATION_ALLOCATION + CORPORATE_ALLOCATION;
            await equorumToken.setReserveManager(corporateAddress.address);
            expect(await equorumToken.balanceOf(corporateAddress.address)).to.equal(RESERVE_ALLOCATION);
        });

        it("Should revert if setting zero address", async function () {
            await expect(
                equorumToken.setStakingContract(ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(equorumToken, "InvalidAddress");
        });

        it("Should allow owner to set ICO contract", async function () {
            await equorumToken.setICOContract(icoAddress.address);
            expect(await equorumToken.icoContract()).to.equal(icoAddress.address);
        });

        it("Should transfer ICO allocation when set", async function () {
            await equorumToken.setICOContract(icoAddress.address);
            expect(await equorumToken.balanceOf(icoAddress.address)).to.equal(ICO_ALLOCATION);
        });

        it("Should not allow setting ICO contract twice", async function () {
            await equorumToken.setICOContract(icoAddress.address);
            await expect(
                equorumToken.setICOContract(icoAddress.address)
            ).to.be.revertedWithCustomError(equorumToken, "AlreadySet");
        });

        it("Should not allow non-owner to set ICO contract", async function () {
            await expect(
                equorumToken.connect(user1).setICOContract(icoAddress.address)
            ).to.be.reverted;
        });
    });

    describe("Transfers", function () {
        beforeEach(async function () {
            // Transfer liquidity tokens to user1 for testing
            await equorumToken.connect(liquidityAddress).transfer(user1.address, ethers.parseEther("1000"));
        });

        it("Should allow normal transfers", async function () {
            const amount = ethers.parseEther("100");
            await expect(
                equorumToken.connect(user1).transfer(user2.address, amount)
            ).to.emit(equorumToken, "Transfer");
        });

        it("Should update balances correctly", async function () {
            const amount = ethers.parseEther("100");
            await equorumToken.connect(user1).transfer(user2.address, amount);

            expect(await equorumToken.balanceOf(user2.address)).to.equal(amount);
        });

        it("Should not allow transfer to zero address", async function () {
            await expect(
                equorumToken.connect(user1).transfer(ethers.ZeroAddress, 100)
            ).to.be.reverted;
        });

        it("Should not allow transfer more than balance", async function () {
            const balance = await equorumToken.balanceOf(user1.address);
            await expect(
                equorumToken.connect(user1).transfer(user2.address, balance + 1n)
            ).to.be.reverted;
        });
    });

    describe("Approvals", function () {
        beforeEach(async function () {
            // Give user1 tokens for approval tests
            await equorumToken.connect(liquidityAddress).transfer(user1.address, ethers.parseEther("1000"));
        });

        it("Should allow approving spender", async function () {
            const amount = ethers.parseEther("100");
            await expect(
                equorumToken.connect(user1).approve(user2.address, amount)
            ).to.emit(equorumToken, "Approval");
        });

        it("Should update allowance correctly", async function () {
            const amount = ethers.parseEther("100");
            await equorumToken.connect(user1).approve(user2.address, amount);

            expect(await equorumToken.allowance(user1.address, user2.address)).to.equal(amount);
        });

        it("Should allow transferFrom with approval", async function () {
            const amount = ethers.parseEther("100");
            
            await equorumToken.connect(user1).approve(user2.address, amount);
            await equorumToken.connect(user2).transferFrom(user1.address, user2.address, amount);

            expect(await equorumToken.balanceOf(user2.address)).to.equal(amount);
        });

        it("Should decrease allowance after transferFrom", async function () {
            const amount = ethers.parseEther("100");
            
            await equorumToken.connect(user1).approve(user2.address, amount);
            await equorumToken.connect(user2).transferFrom(user1.address, user2.address, amount / 2n);

            expect(await equorumToken.allowance(user1.address, user2.address)).to.equal(amount / 2n);
        });

        it("Should not allow transferFrom without approval", async function () {
            await expect(
                equorumToken.connect(user2).transferFrom(user1.address, user2.address, 100)
            ).to.be.reverted;
        });
    });

    describe("Pause Functionality", function () {
        it("Should allow owner to pause", async function () {
            await expect(
                equorumToken.pause()
            ).to.emit(equorumToken, "Paused");
        });

        it("Should not allow non-owner to pause", async function () {
            await expect(
                equorumToken.connect(user1).pause()
            ).to.be.reverted;
        });

        it("Should prevent transfers when paused", async function () {
            await equorumToken.pause();

            await expect(
                equorumToken.connect(user1).transfer(user2.address, 100)
            ).to.be.reverted;
        });

        it("Should allow owner to unpause", async function () {
            await equorumToken.pause();
            await expect(
                equorumToken.unpause()
            ).to.emit(equorumToken, "Unpaused");
        });

        it("Should allow transfers after unpause", async function () {
            await equorumToken.connect(liquidityAddress).transfer(user1.address, ethers.parseEther("1000"));
            await equorumToken.pause();
            await equorumToken.unpause();

            await expect(
                equorumToken.connect(user1).transfer(user2.address, 100)
            ).to.not.be.reverted;
        });
    });

    describe("Blacklist", function () {
        it("Should allow owner to blacklist address", async function () {
            await expect(
                equorumToken.blacklist(user1.address)
            ).to.emit(equorumToken, "Blacklisted");
        });

        it("Should not allow non-owner to blacklist", async function () {
            await expect(
                equorumToken.connect(user1).blacklist(user2.address)
            ).to.be.reverted;
        });

        it("Should prevent blacklisted from sending", async function () {
            await equorumToken.connect(liquidityAddress).transfer(user1.address, ethers.parseEther("1000"));
            await equorumToken.blacklist(user1.address);

            await expect(
                equorumToken.connect(user1).transfer(user2.address, 100)
            ).to.be.revertedWithCustomError(equorumToken, "SenderBlacklisted");
        });

        it("Should prevent sending to blacklisted", async function () {
            await equorumToken.connect(liquidityAddress).transfer(user1.address, ethers.parseEther("1000"));
            await equorumToken.blacklist(user2.address);

            await expect(
                equorumToken.connect(user1).transfer(user2.address, 100)
            ).to.be.revertedWithCustomError(equorumToken, "RecipientBlacklisted");
        });

        it("Should allow owner to remove from blacklist", async function () {
            await equorumToken.blacklist(user1.address);
            await expect(
                equorumToken.unblacklist(user1.address)
            ).to.emit(equorumToken, "Unblacklisted");
        });

        it("Should allow transfers after removing from blacklist", async function () {
            await equorumToken.connect(liquidityAddress).transfer(user1.address, ethers.parseEther("1000"));
            await equorumToken.blacklist(user1.address);
            await equorumToken.unblacklist(user1.address);

            await expect(
                equorumToken.connect(user1).transfer(user2.address, 100)
            ).to.not.be.reverted;
        });

        it("Should check blacklist status correctly", async function () {
            expect(await equorumToken.blacklisted(user1.address)).to.be.false;
            
            await equorumToken.blacklist(user1.address);
            expect(await equorumToken.blacklisted(user1.address)).to.be.true;
            
            await equorumToken.unblacklist(user1.address);
            expect(await equorumToken.blacklisted(user1.address)).to.be.false;
        });
    });

    describe("Ownership", function () {
        it("Should allow owner to transfer ownership", async function () {
            await equorumToken.transferOwnership(user1.address);
            expect(await equorumToken.owner()).to.equal(user1.address);
        });

        it("Should not allow non-owner to transfer ownership", async function () {
            await expect(
                equorumToken.connect(user1).transferOwnership(user2.address)
            ).to.be.reverted;
        });

        it("Should allow new owner to perform owner functions", async function () {
            await equorumToken.transferOwnership(user1.address);
            
            await expect(
                equorumToken.connect(user1).pause()
            ).to.not.be.reverted;
        });

        it("Should not allow old owner to perform owner functions", async function () {
            await equorumToken.transferOwnership(user1.address);
            
            await expect(
                equorumToken.pause()
            ).to.be.reverted;
        });
    });

    describe("Supply Verification", function () {
        it("Should have correct total supply", async function () {
            expect(await equorumToken.totalSupply()).to.equal(TOTAL_SUPPLY);
        });

        it("Should distribute all tokens correctly", async function () {
            await equorumToken.setStakingContract(stakingAddress.address);
            await equorumToken.setGenesisVesting(genesisVesting.address);
            await equorumToken.setFaucetContract(faucetAddress.address);
            await equorumToken.setReserveManager(corporateAddress.address);

            const totalDistributed = 
                await equorumToken.balanceOf(stakingAddress.address) +
                await equorumToken.balanceOf(genesisVesting.address) +
                await equorumToken.balanceOf(faucetAddress.address) +
                await equorumToken.balanceOf(liquidityAddress.address) +
                await equorumToken.balanceOf(corporateAddress.address) +
                await equorumToken.balanceOf(await equorumToken.getAddress()); // ICO tokens in contract

            expect(totalDistributed).to.equal(TOTAL_SUPPLY);
        });

        it("Should not allow minting new tokens", async function () {
            expect(equorumToken.mint).to.be.undefined;
        });

        it("Should not allow burning tokens", async function () {
            expect(equorumToken.burn).to.be.undefined;
        });

        describe("Gas Optimization", function () {
            it("Should use reasonable gas for transfer", async function () {
                await equorumToken.connect(liquidityAddress).transfer(user1.address, ethers.parseEther("1000"));
                
                const tx = await equorumToken.connect(user1).transfer(user2.address, 100);
                const receipt = await tx.wait();
                
                expect(receipt.gasUsed).to.be.lt(100000);
            });

            it("Should use reasonable gas for approve", async function () {
                const tx = await equorumToken.approve(user1.address, ethers.parseEther("1000"));
                const receipt = await tx.wait();
                
                expect(receipt.gasUsed).to.be.lt(80000);
            });
        });

        describe("Edge Cases", function () {
            it("Should handle zero amount transfers", async function () {
                await expect(
                    equorumToken.connect(liquidityAddress).transfer(user1.address, 0)
                ).to.not.be.reverted;
            });

            it("Should handle self transfers", async function () {
                await equorumToken.connect(liquidityAddress).transfer(user1.address, ethers.parseEther("1000"));
                
                await expect(
                    equorumToken.connect(user1).transfer(user1.address, 100)
                ).to.not.be.reverted;
            });

            it("Should handle maximum approval", async function () {
                const maxApproval = ethers.MaxUint256;
                
                await expect(
                    equorumToken.approve(user1.address, maxApproval)
                ).to.not.be.reverted;
            });
        });
    });
});

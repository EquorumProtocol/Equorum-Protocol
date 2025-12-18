const { ethers } = require("hardhat");

const TOKEN = "0xc735AbB9121A1eEdAAfB7D86AA4472c48e23cAB0";
const LIQUIDITY = "0x7359d53Aa0F5cBDfd9164B7980A1eaC22e5b9Ca1";
const GENESIS = "0xE47e15833eF9Ea4280C030c0663caA19fd94842C";

async function main() {
    console.log("Checking balances on Arbitrum One mainnet...\n");
    
    const token = await ethers.getContractAt("EquorumToken", TOKEN);
    
    const totalSupply = await token.totalSupply();
    console.log("Total Supply:", ethers.formatEther(totalSupply), "EQM");
    
    const liquidityBal = await token.balanceOf(LIQUIDITY);
    console.log("Liquidity wallet:", ethers.formatEther(liquidityBal), "EQM");
    
    const genesisBal = await token.balanceOf(GENESIS);
    console.log("Genesis wallet:", ethers.formatEther(genesisBal), "EQM");
    
    const contractBal = await token.balanceOf(TOKEN);
    console.log("Token contract (ICO):", ethers.formatEther(contractBal), "EQM");
}

main().catch(console.error);

const hre = require("hardhat");

/**
 * Script to send 100 EQM reward to a Genesis Staker
 * 
 * Usage:
 * npx hardhat run scripts/send-reward.js --network arbitrum
 * 
 * Then enter the recipient address when prompted
 */

async function main() {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise((resolve) => readline.question(query, resolve));

  console.log("🎁 Genesis Tester Token Sender\n");

  // Addresses
  const TOKEN_ADDRESS = "0xc735AbB9121A1eEdAAfB7D86AA4472c48e23cAB0";
  const REWARD_AMOUNT = hre.ethers.parseEther("60"); // 60 EQM for Genesis Program

  // Get signer
  const [deployer] = await hre.ethers.getSigners();
  console.log("📝 Sending from:", deployer.address);

  // Get token contract
  const token = await hre.ethers.getContractAt("EquorumToken", TOKEN_ADDRESS);

  // Check deployer balance
  const balance = await token.balanceOf(deployer.address);
  console.log(`💰 Your balance: ${hre.ethers.formatEther(balance)} EQM\n`);

  if (balance < REWARD_AMOUNT) {
    console.log("❌ Insufficient balance! You need at least 60 EQM.");
    console.log("Check your balance and ensure you have enough tokens.");
    readline.close();
    return;
  }

  // Ask for recipient address
  const recipient = await question("Enter Genesis Tester wallet address: ");
  
  // Validate address
  if (!hre.ethers.isAddress(recipient)) {
    console.log("❌ Invalid address!");
    readline.close();
    return;
  }

  console.log(`\n🎯 Sending 60 EQM to: ${recipient}`);
  console.log("⏳ Confirming transaction...\n");

  try {
    const tx = await token.transfer(recipient, REWARD_AMOUNT);
    console.log("📤 TX Hash:", tx.hash);
    console.log("⏳ Waiting for confirmation...");
    
    await tx.wait();
    
    console.log("\n✅ Reward sent successfully!");
    console.log(`🔗 View on Arbiscan: https://arbiscan.io/tx/${tx.hash}`);
    
    // Check new balance
    const newBalance = await token.balanceOf(deployer.address);
    console.log(`\n💰 Your new balance: ${hre.ethers.formatEther(newBalance)} EQM`);
    console.log(`📊 Genesis spots remaining: ${Math.floor(Number(hre.ethers.formatEther(newBalance)) / 60)}`);

  } catch (error) {
    console.log("\n❌ Error sending tokens:");
    console.log(error.message);
  }

  readline.close();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

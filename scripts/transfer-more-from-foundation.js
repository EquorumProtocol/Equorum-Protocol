const hre = require("hardhat");

async function main() {
  console.log("💸 Transferring additional 3000 EQM from Foundation to Owner...\n");

  const TOKEN_ADDRESS = "0xc735AbB9121A1eEdAAfB7D86AA4472c48e23cAB0";
  const FOUNDATION_ADDRESS = "0x897d4f95A41f7bd843814D848F08Af930256bEC9";
  const OWNER_ADDRESS = "0x04B285a392FFA8B8D23BA6a239C9BB7141C5391d";
  
  const AMOUNT = hre.ethers.parseEther("3000"); // 3000 EQM

  console.log("📝 From (Foundation):", FOUNDATION_ADDRESS);
  console.log("📝 To (Owner):       ", OWNER_ADDRESS);
  console.log("📝 Amount:           ", "3000 EQM\n");

  const foundationWallet = new hre.ethers.Wallet(
    process.env.FOUNDATION_PRIVATE_KEY,
    hre.ethers.provider
  );
  
  console.log("🔑 Using Foundation wallet:", foundationWallet.address);

  const token = await hre.ethers.getContractAt("EquorumToken", TOKEN_ADDRESS);
  const tokenAsFoundation = token.connect(foundationWallet);

  const balanceBefore = await token.balanceOf(FOUNDATION_ADDRESS);
  console.log(`\n💰 Foundation balance before: ${hre.ethers.formatEther(balanceBefore)} EQM`);

  console.log("\n💸 Transferring...");
  const tx = await tokenAsFoundation.transfer(OWNER_ADDRESS, AMOUNT);
  console.log("TX Hash:", tx.hash);
  console.log("⏳ Waiting for confirmation...");
  
  await tx.wait();
  
  console.log("\n✅ Transfer complete!");
  console.log(`🔗 View on Arbiscan: https://arbiscan.io/tx/${tx.hash}`);

  const foundationBalanceAfter = await token.balanceOf(FOUNDATION_ADDRESS);
  const ownerBalanceAfter = await token.balanceOf(OWNER_ADDRESS);
  
  console.log("\n📊 Balances after transfer:");
  console.log(`Foundation: ${hre.ethers.formatEther(foundationBalanceAfter)} EQM`);
  console.log(`Owner:      ${hre.ethers.formatEther(ownerBalanceAfter)} EQM`);

  console.log("\n✅ Done! You now have 6000 EQM total for Genesis Program!");
  console.log("💡 Enough for 100 Genesis Testers (60 EQM each)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

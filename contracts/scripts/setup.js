const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("🔧 Setting up contracts with initial data...\n");
  console.log("Using account:", deployer.address);

  // Load deployed addresses
  const addresses = require('../deployed-addresses.json');

  // Get contract instances
  const stableCoin = await hre.ethers.getContractAt("StableCoin", addresses.StableCoin);
  const cottonDPP = await hre.ethers.getContractAt("CottonDPP", addresses.CottonDPP);
  const didRegistry = await hre.ethers.getContractAt("DIDRegistry", addresses.DIDRegistry);
  const vcIssuer = await hre.ethers.getContractAt("VCIssuer", addresses.VCIssuer);

  console.log("\n📝 Creating test DIDs...");
  
  // Create DID for deployer (admin/certifier)
  const tx1 = await didRegistry.createDID(deployer.address, "publicKey123", "certifier");
  await tx1.wait();
  console.log("✅ DID created for certifier:", deployer.address);

  // Create test batch
  console.log("\n🌾 Creating test cotton batch...");
  const tx2 = await cottonDPP.createBatch(
    deployer.address,
    1000, // 1000 kg
    85, // quality 85%
    "Farm De Polder, Netherlands"
  );
  await tx2.wait();
  console.log("✅ Test batch created");

  console.log("\n💰 Minting test tokens...");
  const mintAmount = hre.ethers.parseUnits("10000", 2); // 10000 tokens
  const tx3 = await stableCoin.mint(deployer.address, mintAmount);
  await tx3.wait();
  console.log("✅ Minted 10000 CSC tokens");

  console.log("\n✅ Setup complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

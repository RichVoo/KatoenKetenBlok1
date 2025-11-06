const hre = require("hardhat");

async function main() {
  console.log("🚀 Starting deployment...\n");

  // Deploy USDT Mock
  console.log("💰 Deploying USDT Mock...");
  const USDTMock = await hre.ethers.getContractFactory("USDTMock");
  const usdt = await USDTMock.deploy();
  await usdt.waitForDeployment();
  const usdtAddress = await usdt.getAddress();
  console.log("✅ USDT Mock deployed to:", usdtAddress);

  // Deploy CottonDPP (DID, VC, Batch, IoT)
  console.log("\n📋 Deploying CottonDPP...");
  const CottonDPP = await hre.ethers.getContractFactory("CottonDPP");
  const dpp = await CottonDPP.deploy();
  await dpp.waitForDeployment();
  const dppAddress = await dpp.getAddress();
  console.log("✅ CottonDPP deployed to:", dppAddress);

  // Deploy CottonMarketplace (Marketplace, Escrow, Payments)
  console.log("\n🛒 Deploying CottonMarketplace...");
  const CottonMarketplace = await hre.ethers.getContractFactory("CottonMarketplace");
  const marketplace = await CottonMarketplace.deploy(usdtAddress, dppAddress);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("✅ CottonMarketplace deployed to:", marketplaceAddress);

  console.log("\n========================================");
  console.log("📦 DEPLOYMENT SUMMARY");
  console.log("========================================");
  console.log("USDT Mock:           ", usdtAddress);
  console.log("CottonDPP:           ", dppAddress);
  console.log("CottonMarketplace:   ", marketplaceAddress);
  console.log("========================================\n");

  const fs = require("fs");
  const addresses = {
    USDT: usdtAddress,
    CottonDPP: dppAddress,
    CottonMarketplace: marketplaceAddress,
    network: hre.network.name,
    deployedAt: new Date().toISOString()
  };
  fs.writeFileSync("deployed-addresses.json", JSON.stringify(addresses, null, 2));
  console.log("✅ Addresses saved to deployed-addresses.json\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

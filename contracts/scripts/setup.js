const hre = require("hardhat");

async function main() {
  console.log("🔧 Setting up IntegratedCottonDPP with roles...\n");

  // Get signers (Hardhat test accounts)
  const [admin, boer, transporteur, certificeerder, fabriek] = await hre.ethers.getSigners();
  
  console.log("� Accounts:");
  console.log("Admin:         ", admin.address);
  console.log("Boer:          ", boer.address);
  console.log("Transporteur:  ", transporteur.address);
  console.log("Certificeerder:", certificeerder.address);
  console.log("Fabriek:       ", fabriek.address);

  // Load deployed addresses
  const addresses = require('../deployed-addresses.json');

  // Get contract instances
  const usdt = await hre.ethers.getContractAt("USDTMock", addresses.USDT);
  const dpp = await hre.ethers.getContractAt("IntegratedCottonDPP", addresses.IntegratedCottonDPP);

  console.log("\n🔐 Granting roles...");
  
  // Grant FARMER_ROLE to boer
  const FARMER_ROLE = await dpp.FARMER_ROLE();
  let tx = await dpp.grantRole(FARMER_ROLE, boer.address);
  await tx.wait();
  console.log("✅ FARMER_ROLE granted to:", boer.address);

  // Grant TRANSPORTER_ROLE to transporteur
  const TRANSPORTER_ROLE = await dpp.TRANSPORTER_ROLE();
  tx = await dpp.grantRole(TRANSPORTER_ROLE, transporteur.address);
  await tx.wait();
  console.log("✅ TRANSPORTER_ROLE granted to:", transporteur.address);

  // Grant CERTIFIER_ROLE to certificeerder
  const CERTIFIER_ROLE = await dpp.CERTIFIER_ROLE();
  tx = await dpp.grantRole(CERTIFIER_ROLE, certificeerder.address);
  await tx.wait();
  console.log("✅ CERTIFIER_ROLE granted to:", certificeerder.address);

  // Grant FACTORY_ROLE to fabriek
  const FACTORY_ROLE = await dpp.FACTORY_ROLE();
  tx = await dpp.grantRole(FACTORY_ROLE, fabriek.address);
  await tx.wait();
  console.log("✅ FACTORY_ROLE granted to:", fabriek.address);

  console.log("\n💰 Minting USDT to all stakeholders...");
  const mintAmount = hre.ethers.parseUnits("100000", 6); // 100,000 USDT (6 decimals)
  
  tx = await usdt.mint(admin.address, mintAmount);
  await tx.wait();
  console.log("✅ Minted 100,000 USDT to Admin");
  
  tx = await usdt.mint(boer.address, mintAmount);
  await tx.wait();
  console.log("✅ Minted 100,000 USDT to Boer");
  
  tx = await usdt.mint(transporteur.address, mintAmount);
  await tx.wait();
  console.log("✅ Minted 100,000 USDT to Transporteur");
  
  tx = await usdt.mint(certificeerder.address, mintAmount);
  await tx.wait();
  console.log("✅ Minted 100,000 USDT to Certificeerder");
  
  tx = await usdt.mint(fabriek.address, mintAmount);
  await tx.wait();
  console.log("✅ Minted 100,000 USDT to Fabriek");

  console.log("\n� Registering DIDs for all stakeholders...");
  
  tx = await dpp.connect(admin).registerDID(boer.address, "boer-public-key", "farmer");
  await tx.wait();
  console.log("✅ DID registered for Boer");
  
  tx = await dpp.connect(admin).registerDID(transporteur.address, "transporteur-public-key", "transporter");
  await tx.wait();
  console.log("✅ DID registered for Transporteur");
  
  tx = await dpp.connect(admin).registerDID(certificeerder.address, "certificeerder-public-key", "certifier");
  await tx.wait();
  console.log("✅ DID registered for Certificeerder");
  
  tx = await dpp.connect(admin).registerDID(fabriek.address, "fabriek-public-key", "factory");
  await tx.wait();
  console.log("✅ DID registered for Fabriek");

  console.log("\n✅ Setup complete!");
  console.log("\n📋 Summary:");
  console.log("- All roles granted");
  console.log("- All stakeholders have 100,000 USDT");
  console.log("- All DIDs registered");
  console.log("\n🚀 Ready to use the DApp!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

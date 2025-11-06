const hre = require("hardhat");

async function main() {
  console.log("🔧 Setting up CottonDPP & CottonMarketplace with roles...\n");

  // Get signers (Hardhat test accounts)
  // LET OP: signers[4] = 0x15d34AAf... (dit is ons Cooperative account!)
  const signers = await hre.ethers.getSigners();
  const admin = signers[0];          // 0xf39Fd6...
  const boer = signers[1];           // 0x70997970...
  const transporteur = signers[2];   // 0x3C44CdDdB...
  const certificeerder = signers[3]; // 0x90F79bf6...
  const cooperative = signers[4];    // 0x15d34AAf... ← DIT IS HET JUISTE ACCOUNT!
  const processing = signers[6];     // 0x976EA740...
  
  console.log("👥 Accounts:");
  console.log("Admin:                ", admin.address);
  console.log("Boer:                 ", boer.address);
  console.log("Transporteur:         ", transporteur.address);
  console.log("Certificeerder:       ", certificeerder.address);
  console.log("Inkoop Coöperatie:    ", cooperative.address);
  console.log("Verwerking t/m Retail:", processing.address);

  // Load deployed addresses
  const addresses = require('../deployed-addresses.json');

  // Get contract instances
  const usdt = await hre.ethers.getContractAt("USDTMock", addresses.USDT);
  const dpp = await hre.ethers.getContractAt("CottonDPP", addresses.CottonDPP);
  const marketplace = await hre.ethers.getContractAt("CottonMarketplace", addresses.CottonMarketplace);

  console.log("\n🔐 Granting roles to CottonDPP...");
  
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
  
  // Grant TRANSPORTER_ROLE to processing (for IoT tracking Mumbai → New Delhi)
  tx = await dpp.grantRole(TRANSPORTER_ROLE, processing.address);
  await tx.wait();
  console.log("✅ TRANSPORTER_ROLE granted to processing:", processing.address);

  // Grant CERTIFIER_ROLE to certificeerder
  const CERTIFIER_ROLE = await dpp.CERTIFIER_ROLE();
  tx = await dpp.grantRole(CERTIFIER_ROLE, certificeerder.address);
  await tx.wait();
  console.log("✅ CERTIFIER_ROLE granted to:", certificeerder.address);

  // Grant FACTORY_ROLE to cooperative (account #5) and processing (account #6)
  const FACTORY_ROLE = await dpp.FACTORY_ROLE();
  tx = await dpp.grantRole(FACTORY_ROLE, cooperative.address);
  await tx.wait();
  console.log("✅ FACTORY_ROLE granted to:", cooperative.address);

  tx = await dpp.grantRole(FACTORY_ROLE, processing.address);
  await tx.wait();
  console.log("✅ FACTORY_ROLE granted to:", processing.address);

  console.log("\n🔐 Granting roles to CottonMarketplace...");
  
  tx = await marketplace.grantRole(FARMER_ROLE, boer.address);
  await tx.wait();
  console.log("✅ FARMER_ROLE granted to:", boer.address);

  tx = await marketplace.grantRole(TRANSPORTER_ROLE, transporteur.address);
  await tx.wait();
  console.log("✅ TRANSPORTER_ROLE granted to:", transporteur.address);

  tx = await marketplace.grantRole(CERTIFIER_ROLE, certificeerder.address);
  await tx.wait();
  console.log("✅ CERTIFIER_ROLE granted to:", certificeerder.address);

  tx = await marketplace.grantRole(FACTORY_ROLE, cooperative.address);
  await tx.wait();
  console.log("✅ FACTORY_ROLE granted to:", cooperative.address);

  tx = await marketplace.grantRole(FACTORY_ROLE, processing.address);
  await tx.wait();
  console.log("✅ FACTORY_ROLE granted to:", processing.address);

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
  
  tx = await usdt.mint(cooperative.address, mintAmount);
  await tx.wait();
  console.log("✅ Minted 100,000 USDT to Inkoop Coöperatie");
  
  tx = await usdt.mint(processing.address, mintAmount);
  await tx.wait();
  console.log("✅ Minted 100,000 USDT to Verwerking t/m Retail");

  console.log("\n🆔 Registering DIDs for all stakeholders...");
  
  tx = await dpp.connect(admin).registerDID(boer.address, "boer-public-key", "farmer");
  await tx.wait();
  console.log("✅ DID registered for Boer");
  
  tx = await dpp.connect(admin).registerDID(transporteur.address, "transporteur-public-key", "transporter");
  await tx.wait();
  console.log("✅ DID registered for Transporteur");
  
  tx = await dpp.connect(admin).registerDID(certificeerder.address, "certificeerder-public-key", "certifier");
  await tx.wait();
  console.log("✅ DID registered for Certificeerder");
  
  tx = await dpp.connect(admin).registerDID(cooperative.address, "cooperative-public-key", "cooperative");
  await tx.wait();
  console.log("✅ DID registered for Inkoop Coöperatie");
  
  tx = await dpp.connect(admin).registerDID(processing.address, "processing-public-key", "processing");
  await tx.wait();
  console.log("✅ DID registered for Verwerking t/m Retail");

  console.log("\n✅ Setup complete!");
  console.log("\n📋 Summary:");
  console.log("- All roles granted (6 stakeholders)");
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

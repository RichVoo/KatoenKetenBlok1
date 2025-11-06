const hre = require("hardhat");

async function main() {
  console.log("🔍 Checking DID registrations...\n");

  // Get signers
  const signers = await hre.ethers.getSigners();
  
  const accounts = [
    { name: "Admin", signer: signers[0] },
    { name: "Boer", signer: signers[1] },
    { name: "Transporteur", signer: signers[2] },
    { name: "Certificeerder", signer: signers[3] },
    { name: "Inkoop Coöperatie", signer: signers[5] },
    { name: "Verwerking t/m Retail", signer: signers[6] }
  ];

  // Load deployed addresses
  const addresses = require('../deployed-addresses.json');
  const dpp = await hre.ethers.getContractAt("CottonDPP", addresses.CottonDPP);

  console.log("Account Address Check:");
  console.log("=".repeat(80));
  
  for (const acc of accounts) {
    const address = acc.signer.address;
    console.log(`\n${acc.name}:`);
    console.log(`  Address: ${address}`);
    
    try {
      const hasDID = await dpp.hasDID(address);
      
      if (hasDID) {
        const didInfo = await dpp.dids(address);
        console.log(`  ✅ Has DID: YES`);
        console.log(`  Type: ${didInfo.didType}`);
        console.log(`  Active: ${didInfo.active}`);
      } else {
        console.log(`  ❌ Has DID: NO`);
      }
    } catch (error) {
      console.log(`  ❌ Error checking DID: ${error.message}`);
    }
  }
  
  console.log("\n" + "=".repeat(80));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

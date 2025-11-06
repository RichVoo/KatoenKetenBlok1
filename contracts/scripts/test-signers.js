const hre = require("hardhat");

async function main() {
  const signers = await hre.ethers.getSigners();
  
  console.log("Signer array test:");
  console.log("signers[0]:", signers[0].address);
  console.log("signers[1]:", signers[1].address);
  console.log("signers[2]:", signers[2].address);
  console.log("signers[3]:", signers[3].address);
  console.log("signers[4]:", signers[4].address);
  console.log("signers[5]:", signers[5].address);
  console.log("signers[6]:", signers[6].address);
}

main().catch(console.error);

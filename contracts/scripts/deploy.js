const hre = require("hardhat");

async function main() {
  console.log("?? Starting deployment...\n");

  // Deploy USDT Mock
  console.log("?? Deploying USDT Mock...");
  const USDTMock = await hre.ethers.getContractFactory("USDTMock");
  const usdt = await USDTMock.deploy();
  await usdt.waitForDeployment();
  const usdtAddress = await usdt.getAddress();
  console.log("? USDT Mock deployed to:", usdtAddress);

  // Deploy Integrated CottonDPP
  console.log("\n?? Deploying IntegratedCottonDPP...");
  const IntegratedCottonDPP = await hre.ethers.getContractFactory("IntegratedCottonDPP");
  const integratedDPP = await IntegratedCottonDPP.deploy(usdtAddress);
  await integratedDPP.waitForDeployment();
  const integratedDPPAddress = await integratedDPP.getAddress();
  console.log("? IntegratedCottonDPP deployed to:", integratedDPPAddress);

  console.log("\n========================================");
  console.log("?? DEPLOYMENT SUMMARY");
  console.log("========================================");
  console.log("USDT Mock:            ", usdtAddress);
  console.log("IntegratedCottonDPP:  ", integratedDPPAddress);
  console.log("========================================\n");

  const fs = require("fs");
  const addresses = {
    USDT: usdtAddress,
    IntegratedCottonDPP: integratedDPPAddress,
    network: hre.network.name,
    deployedAt: new Date().toISOString()
  };
  fs.writeFileSync("deployed-addresses.json", JSON.stringify(addresses, null, 2));
  console.log("? Addresses saved to deployed-addresses.json\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

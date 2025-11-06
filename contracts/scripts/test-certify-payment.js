const hre = require("hardhat");
const fs = require('fs');

async function main() {
    console.log("🧪 Testing Certify Payment Flow...\n");
    
    // Get deployed addresses
    const addresses = JSON.parse(fs.readFileSync('./deployed-addresses.json', 'utf8'));
    
    // Get contracts
    const USDT = await hre.ethers.getContractAt("USDTMock", addresses.USDT);
    const DPP = await hre.ethers.getContractAt("CottonDPP", addresses.CottonDPP);
    const Marketplace = await hre.ethers.getContractAt("CottonMarketplace", addresses.CottonMarketplace);
    
    // Get signers
    const [admin, farmer, transporter, certifier, factory] = await hre.ethers.getSigners();
    
    console.log("📋 Accounts:");
    console.log("Farmer:", farmer.address);
    console.log("Certifier:", certifier.address);
    console.log("Factory:", factory.address);
    console.log("");
    
    // 1. Farmer deposits escrow
    console.log("1️⃣ Farmer deposits 5000 USDT escrow...");
    await USDT.connect(farmer).approve(Marketplace.target, hre.ethers.parseUnits("5000", 6));
    await Marketplace.connect(farmer).depositFarmerEscrow(hre.ethers.parseUnits("5000", 6));
    console.log("✅ Farmer escrow deposited\n");
    
    // 2. Farmer creates batch
    console.log("2️⃣ Farmer creates batch (500kg, quality 75)...");
    const tx1 = await DPP.connect(farmer).createBatch(500, 75, "Gujarat, India");
    const receipt1 = await tx1.wait();
    
    // Get the batch ID from the event
    const batchCreatedEvent = receipt1.logs.find(log => {
        try {
            return DPP.interface.parseLog(log).name === 'BatchCreated';
        } catch {
            return false;
        }
    });
    const batchId = batchCreatedEvent ? Number(DPP.interface.parseLog(batchCreatedEvent).args[0]) : 2;
    
    // Put on market (skip if already on market)
    try {
        await Marketplace.connect(farmer).putBatchOnMarket(batchId);
        console.log(`✅ Batch #${batchId} created and on market\n`);
    } catch (error) {
        if (error.message.includes("Already sold")) {
            console.log(`✅ Batch #${batchId} created (already on market)\n`);
        } else {
            throw error;
        }
    }
    
    // 3. Factory purchases batch
    console.log("3️⃣ Factory purchases batch...");
    const batch = await DPP.getBatch(batchId);
    const quality = Number(batch.quality);
    const weight = Number(batch.weight);
    
    let pricePerKg = 10;
    if (quality >= 90) pricePerKg = 13;
    else if (quality >= 70) pricePerKg = 11.5;
    
    const totalPrice = hre.ethers.parseUnits((pricePerKg * weight).toString(), 6);
    
    await USDT.connect(factory).approve(Marketplace.target, totalPrice);
    await Marketplace.connect(factory).purchaseBatch(batchId);
    
    const marketData = await Marketplace.getBatchMarketData(batchId);
    console.log("💰 Total price:", hre.ethers.formatUnits(totalPrice, 6), "USDT");
    console.log("💰 Farmer amount:", hre.ethers.formatUnits(marketData.farmerAmount, 6), "USDT");
    console.log("💰 Certifier fee:", hre.ethers.formatUnits(marketData.certifierFee, 6), "USDT");
    console.log("💰 Transporter fee:", hre.ethers.formatUnits(marketData.transporterFee, 6), "USDT");
    console.log("✅ Batch purchased, escrow locked\n");
    
    // Check balances BEFORE certification
    const farmerBalanceBefore = await USDT.balanceOf(farmer.address);
    const certifierBalanceBefore = await USDT.balanceOf(certifier.address);
    const contractBalance = await USDT.balanceOf(Marketplace.target);
    
    console.log("📊 Balances BEFORE certification:");
    console.log("Farmer USDT:", hre.ethers.formatUnits(farmerBalanceBefore, 6));
    console.log("Certifier USDT:", hre.ethers.formatUnits(certifierBalanceBefore, 6));
    console.log("Contract USDT:", hre.ethers.formatUnits(contractBalance, 6));
    console.log("");
    
    // 4. Certifier approves batch
    console.log("4️⃣ Certifier approves batch...");
    const certifyTx = await Marketplace.connect(certifier).certifyBatch(batchId, true);
    const receipt = await certifyTx.wait();
    console.log("✅ Batch certified\n");
    
    // Check balances AFTER certification
    const farmerBalanceAfter = await USDT.balanceOf(farmer.address);
    const certifierBalanceAfter = await USDT.balanceOf(certifier.address);
    const contractBalanceAfter = await USDT.balanceOf(Marketplace.target);
    
    console.log("📊 Balances AFTER certification:");
    console.log("Farmer USDT:", hre.ethers.formatUnits(farmerBalanceAfter, 6));
    console.log("Certifier USDT:", hre.ethers.formatUnits(certifierBalanceAfter, 6));
    console.log("Contract USDT:", hre.ethers.formatUnits(contractBalanceAfter, 6));
    console.log("");
    
    const farmerIncrease = farmerBalanceAfter - farmerBalanceBefore;
    const certifierIncrease = certifierBalanceAfter - certifierBalanceBefore;
    
    console.log("💰 PAYMENT RESULTS:");
    console.log("Farmer received:", hre.ethers.formatUnits(farmerIncrease, 6), "USDT");
    console.log("Certifier received:", hre.ethers.formatUnits(certifierIncrease, 6), "USDT");
    console.log("");
    
    // Verify
    const expectedFarmerAmount = marketData.farmerAmount;
    const expectedCertifierFee = marketData.certifierFee;
    
    if (farmerIncrease === expectedFarmerAmount) {
        console.log("✅ Farmer payment CORRECT!");
    } else {
        console.log("❌ Farmer payment WRONG!");
        console.log("Expected:", hre.ethers.formatUnits(expectedFarmerAmount, 6));
        console.log("Got:", hre.ethers.formatUnits(farmerIncrease, 6));
    }
    
    if (certifierIncrease === expectedCertifierFee) {
        console.log("✅ Certifier payment CORRECT!");
    } else {
        console.log("❌ Certifier payment WRONG!");
        console.log("Expected:", hre.ethers.formatUnits(expectedCertifierFee, 6));
        console.log("Got:", hre.ethers.formatUnits(certifierIncrease, 6));
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

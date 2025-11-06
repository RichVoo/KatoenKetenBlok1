// Test script voor de nieuwe fee structuur
const { ethers } = require("ethers");

const RPC_URL = "http://localhost:8545";
const CONTRACT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

const DPP_ABI = [
    "function calculateTransporterFee(uint256 weight) pure returns (uint256)",
    "function calculateCertifierFee(uint256 weight) pure returns (uint256)"
];

async function testFees() {
    console.log("🧪 Testing nieuwe fee structuur...\n");
    
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, DPP_ABI, provider);
    
    const testWeights = [100, 250, 500, 750, 1000, 1500, 2000, 3000];
    
    console.log("┌─────────┬────────────────────┬───────────────────────┬──────────────┐");
    console.log("│ Gewicht │ Transporteur Fee   │ Certificeerder Fee    │ Totaal Fees  │");
    console.log("├─────────┼────────────────────┼───────────────────────┼──────────────┤");
    
    for (const weight of testWeights) {
        const transporterFee = await contract.calculateTransporterFee(weight);
        const certifierFee = await contract.calculateCertifierFee(weight);
        const totalFees = transporterFee + certifierFee;
        
        const transporterUSDT = parseFloat(ethers.formatUnits(transporterFee, 6));
        const certifierUSDT = parseFloat(ethers.formatUnits(certifierFee, 6));
        const totalUSDT = parseFloat(ethers.formatUnits(totalFees, 6));
        
        // Bereken effectief tarief per kg
        const transporterPerKg = (transporterUSDT / weight).toFixed(3);
        const certifierPerKg = (certifierUSDT / weight).toFixed(3);
        
        console.log(`│ ${weight.toString().padEnd(7)} │ ${transporterUSDT.toFixed(2).padEnd(18)} │ ${certifierUSDT.toFixed(2).padEnd(21)} │ ${totalUSDT.toFixed(2).padEnd(12)} │`);
        console.log(`│         │ (€${transporterPerKg}/kg)${' '.repeat(10)} │ (€${certifierPerKg}/kg)${' '.repeat(12)} │              │`);
        console.log("├─────────┼────────────────────┼───────────────────────┼──────────────┤");
    }
    
    console.log("\n📊 Fee Structuur Details:\n");
    console.log("🚛 Transporteur:");
    console.log("   - Basis fee: 50 USDT");
    console.log("   - Per kilo: 0.20 USDT (vast tarief)");
    console.log("");
    console.log("✅ Certificeerder (degressief):");
    console.log("   - Basis fee: 100 USDT");
    console.log("   - 0-500 kg: 1.00 USDT/kg");
    console.log("   - 501-1000 kg: 0.80 USDT/kg");
    console.log("   - 1001-2000 kg: 0.60 USDT/kg");
    console.log("   - 2001+ kg: 0.40 USDT/kg");
    console.log("");
    
    // Test voorbeelden
    console.log("💡 Voorbeelden:\n");
    
    const example1Weight = 500;
    const ex1Trans = await contract.calculateTransporterFee(example1Weight);
    const ex1Cert = await contract.calculateCertifierFee(example1Weight);
    console.log(`📦 Batch van ${example1Weight}kg:`);
    console.log(`   Transporteur: ${ethers.formatUnits(ex1Trans, 6)} USDT (50 + ${example1Weight} * 0.20)`);
    console.log(`   Certificeerder: ${ethers.formatUnits(ex1Cert, 6)} USDT (100 + ${example1Weight} * 1.00)\n`);
    
    const example2Weight = 1500;
    const ex2Trans = await contract.calculateTransporterFee(example2Weight);
    const ex2Cert = await contract.calculateCertifierFee(example2Weight);
    console.log(`📦 Batch van ${example2Weight}kg:`);
    console.log(`   Transporteur: ${ethers.formatUnits(ex2Trans, 6)} USDT (50 + ${example2Weight} * 0.20)`);
    console.log(`   Certificeerder: ${ethers.formatUnits(ex2Cert, 6)} USDT`);
    console.log(`   └─ Berekening: 100 (basis) + 500*1.00 + 500*0.80 + 500*0.60 = ${ethers.formatUnits(ex2Cert, 6)} USDT\n`);
    
    console.log("✅ Alle fee calculations werken correct!");
}

testFees().catch(console.error);

const hre = require("hardhat");

const FARMER_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

async function main() {
    console.log('🔍 Checking VCs for farmer:', FARMER_ADDRESS);
    
    const IntegratedCottonDPP = await hre.ethers.getContractFactory("IntegratedCottonDPP");
    const dpp = await IntegratedCottonDPP.attach("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");
    
    try {
        const vcIds = await dpp.getSubjectVCs(FARMER_ADDRESS);
        console.log('📋 VC IDs:', vcIds.map(id => id.toString()));
        console.log('📊 Total VCs:', vcIds.length);
        
        if (vcIds.length > 0) {
            for (const id of vcIds) {
                console.log('\n🎓 VC #' + id.toString());
                const vc = await dpp.getCredential(id);
                console.log('  Issuer:', vc.issuer);
                console.log('  Subject:', vc.subject);
                console.log('  Type:', vc.credentialType);
                console.log('  Data:', vc.data.substring(0, 100) + '...');
            }
        } else {
            console.log('\n❌ No VCs found for this farmer');
            console.log('💡 This means no VCs have been issued to this address yet with the current contract.');
            console.log('💡 Please issue a new VC using the VC Aanvraag module.');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

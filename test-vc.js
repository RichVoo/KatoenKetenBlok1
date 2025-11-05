const { ethers } = require('ethers');

const RPC_URL = "http://localhost:8545";
const CONTRACT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const FARMER_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

const ABI = [
    "function getSubjectVCs(address subject) view returns (uint256[])",
    "function getCredential(uint256 vcId) view returns (uint256 id, address issuer, address subject, string credentialType, string data, uint256 issuedAt, uint256 expiresAt, bool revoked)"
];

async function main() {
    console.log('🔍 Checking VCs for farmer:', FARMER_ADDRESS);
    
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
    
    try {
        const vcIds = await contract.getSubjectVCs(FARMER_ADDRESS);
        console.log('📋 VC IDs:', vcIds);
        console.log('📊 Total VCs:', vcIds.length);
        
        if (vcIds.length > 0) {
            for (const id of vcIds) {
                console.log('\n🎓 VC #' + id);
                const vc = await contract.getCredential(id);
                console.log('  Issuer:', vc.issuer);
                console.log('  Subject:', vc.subject);
                console.log('  Type:', vc.credentialType);
                console.log('  Data:', vc.data);
            }
        } else {
            console.log('❌ No VCs found for this farmer');
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

main();

// Configuration
const RPC_URL = "http://localhost:8545";
const DID_SERVICE_URL = "http://localhost:3002"; // DID service backend
const CONTRACT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

const DPP_ABI = [
    "function registerDID(address controller, string publicKey, string didType)",
    "function hasDID(address) view returns (bool)",
    "function dids(address) view returns (string identifier, string publicKey, string didType, uint256 registered, bool active)"
];

let provider, contract;
let pendingRegistration = null;

window.addEventListener('load', async () => {
    await init();
    await loadAllDIDs();
});

async function init() {
    try {
        provider = new ethers.JsonRpcProvider(RPC_URL);
        contract = new ethers.Contract(CONTRACT_ADDRESS, DPP_ABI, provider);
        console.log("✅ Connected to blockchain");
    } catch (error) {
        console.error("❌ Init error:", error);
    }
}

// Register New DID - Step 1: Request Verification
async function registerNewDID() {
    const result = document.getElementById('registerResult');
    result.innerHTML = '<div style="text-align: center; padding: 20px;">⏳ Sending verification request...</div>';
    
    try {
        const naam = document.getElementById('regNaam').value;
        const bedrijfsnaam = document.getElementById('regBedrijf').value;
        const urn = document.getElementById('regUrn').value;
        const email = document.getElementById('regEmail').value;
        const telefoon = document.getElementById('regTelefoon').value;
        const didType = document.getElementById('regDidType').value;
        
        if (!naam || !bedrijfsnaam || !urn || !email) {
            throw new Error("Alle verplichte velden moeten ingevuld zijn!");
        }
        
        // Call DID service backend
        const response = await fetch(`${DID_SERVICE_URL}/api/request-verification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ naam, bedrijfsnaam, urn, email, telefoon, didType })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Verification request failed');
        }
        
        // Store for verification step
        pendingRegistration = {
            naam, bedrijfsnaam, urn, email, telefoon, didType,
            verificationCode: data.code // In production this would be sent via email
        };
        
        result.innerHTML = `
            <div class="alert alert-success">
                <strong>✅ Verification Code Sent!</strong><br>
                Check console for verification code (in production this would be emailed).<br><br>
                <strong>⚠️ FOR TESTING:</strong> Code = <code style="background: #fff; padding: 5px 10px; border-radius: 4px; font-size: 18px;">${data.code}</code>
            </div>
        `;
        
        // Show verify section
        document.getElementById('verifySection').style.display = 'block';
        document.getElementById('verifySection').scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error("❌ Register error:", error);
        result.innerHTML = `<div class="alert alert-error"><strong>❌ Error:</strong> ${error.message}</div>`;
    }
}

// Register New DID - Step 2: Verify Code
async function verifyDID() {
    const result = document.getElementById('verifyResult');
    result.innerHTML = '<div style="text-align: center; padding: 20px;">⏳ Verifying and creating DID...</div>';
    
    try {
        if (!pendingRegistration) {
            throw new Error("No pending registration. Please request verification code first.");
        }
        
        const code = document.getElementById('verifyCode').value;
        
        if (!code) {
            throw new Error("Verification code is required!");
        }
        
        // Verify code with backend
        const response = await fetch(`${DID_SERVICE_URL}/api/verify-and-create-wallet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                verificationCode: code
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Verification failed');
        }
        
        // Now register DID on blockchain using ADMIN wallet (has permission to register DIDs)
        // Admin is hardhat account[0] with known private key
        const adminPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        const adminWallet = new ethers.Wallet(adminPrivateKey, provider);
        const dppWithSigner = new ethers.Contract(CONTRACT_ADDRESS, DPP_ABI, adminWallet);
        
        const tx = await dppWithSigner.registerDID(
            data.address,  // Controller is the new user's address
            data.publicKey || "auto-generated-key",
            pendingRegistration.didType
        );
        
        result.innerHTML = `<div class="alert alert-info">⏳ Transaction sent: ${tx.hash}<br>Waiting for confirmation...</div>`;
        
        await tx.wait();
        
        result.innerHTML = `
            <div class="alert alert-success">
                <strong>✅ DID Successfully Created!</strong><br><br>
                <strong>DID:</strong> ${data.did}<br>
                <strong>Address:</strong> ${data.address}<br>
                <strong>Private Key:</strong> <code style="word-break: break-all;">${data.privateKey}</code><br><br>
                <strong>⚠️ Save your private key securely!</strong><br>
                You will need it to sign transactions.<br><br>
                <strong>Registration Details:</strong><br>
                Naam: ${pendingRegistration.naam}<br>
                Bedrijf: ${pendingRegistration.bedrijfsnaam}<br>
                URN: ${pendingRegistration.urn}<br>
                Type: ${pendingRegistration.didType}
            </div>
        `;
        
        // Reset form and hide verify section
        document.getElementById('regNaam').value = '';
        document.getElementById('regBedrijf').value = '';
        document.getElementById('regUrn').value = '';
        document.getElementById('regEmail').value = '';
        document.getElementById('regTelefoon').value = '';
        document.getElementById('verifyCode').value = '';
        document.getElementById('verifySection').style.display = 'none';
        document.getElementById('registerResult').innerHTML = '';
        
        pendingRegistration = null;
        
        // Refresh DID list
        await loadAllDIDs();
        
    } catch (error) {
        console.error("❌ Verify error:", error);
        result.innerHTML = `<div class="alert alert-error"><strong>❌ Error:</strong> ${error.message}</div>`;
    }
}

// Load all DIDs from backend
async function loadAllDIDs() {
    const result = document.getElementById('didList');
    result.innerHTML = '<div style="text-align: center; padding: 20px;">⏳ Loading DIDs...</div>';
    
    try {
        // Get from backend
        const response = await fetch(`${DID_SERVICE_URL}/api/registrations`);
        const registrations = await response.json();
        
        if (registrations.length === 0) {
            result.innerHTML = '<div class="alert alert-info">No DIDs registered yet.</div>';
            return;
        }
        
        let html = '';
        for (const reg of registrations) {
            // Check if DID exists on blockchain
            let onChain = false;
            try {
                onChain = await contract.hasDID(reg.address);
            } catch (e) {
                console.log("Could not check blockchain for:", reg.address);
            }
            
            html += `
                <div class="did-item">
                    <strong>🆔 ${reg.naam} - ${reg.bedrijfsnaam}</strong>
                    <span>DID: ${reg.did}</span><br>
                    <span>URN: ${reg.urn}</span><br>
                    <span>Address: ${reg.address}</span><br>
                    <span>Registered: ${new Date(reg.timestamp).toLocaleString('nl-NL')}</span><br>
                    <span style="color: ${onChain ? '#10b981' : '#f59e0b'};">
                        ${onChain ? '✅ On Blockchain' : '⚠️ Not on Blockchain'}
                    </span>
                </div>
            `;
        }
        
        result.innerHTML = html;
        
    } catch (error) {
        console.error("❌ Load DIDs error:", error);
        result.innerHTML = `<div class="alert alert-error"><strong>❌ Error:</strong> ${error.message}</div>`;
    }
}

// Resolve DID
async function resolveDID() {
    const result = document.getElementById('resolveResult');
    result.innerHTML = '<div style="text-align: center; padding: 20px;">⏳ Resolving DID...</div>';
    
    try {
        const did = document.getElementById('resolveDid').value;
        
        if (!did) {
            throw new Error("DID is required!");
        }
        
        // Extract address from DID (did:ethr:0x...)
        const addressMatch = did.match(/0x[a-fA-F0-9]{40}/);
        if (!addressMatch) {
            throw new Error("Invalid DID format. Expected: did:ethr:0x...");
        }
        
        const address = addressMatch[0];
        
        // Check blockchain
        const hasDID = await contract.hasDID(address);
        
        if (!hasDID) {
            throw new Error("DID not found on blockchain");
        }
        
        const didData = await contract.dids(address);
        
        // Try to get registration details from backend
        let regDetails = null;
        try {
            const response = await fetch(`${DID_SERVICE_URL}/api/registrations`);
            const registrations = await response.json();
            regDetails = registrations.find(r => r.address.toLowerCase() === address.toLowerCase());
        } catch (e) {
            console.log("Could not fetch registration details");
        }
        
        result.innerHTML = `
            <div class="alert alert-success">
                <strong>✅ DID Resolved!</strong><br><br>
                <strong>DID:</strong> ${didData.identifier}<br>
                <strong>Address:</strong> ${address}<br>
                <strong>Type:</strong> ${didData.didType}<br>
                <strong>Registered:</strong> ${new Date(Number(didData.registered.toString()) * 1000).toLocaleString('nl-NL')}<br>
                <strong>Active:</strong> ${didData.active ? '✅ Yes' : '❌ No'}<br>
                ${regDetails ? `
                    <br><strong>Registration Details:</strong><br>
                    Naam: ${regDetails.naam}<br>
                    Bedrijf: ${regDetails.bedrijfsnaam}<br>
                    URN: ${regDetails.urn}<br>
                    Email: ${regDetails.email}
                ` : ''}
            </div>
        `;
        
    } catch (error) {
        console.error("❌ Resolve error:", error);
        result.innerHTML = `<div class="alert alert-error"><strong>❌ Error:</strong> ${error.message}</div>`;
    }
}

console.log("✅ DID Management loaded!");

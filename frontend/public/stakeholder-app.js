// Configuration
const RPC_URL = "http://localhost:8545";

const TEST_ACCOUNTS = [
    { address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", key: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", role: "Admin", type: "admin" },
    { address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", key: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", role: "Boer", type: "farmer" },
    { address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", key: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", role: "Transporteur", type: "transporter" },
    { address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", key: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", role: "Certificeerder", type: "certifier" },
    { address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", key: "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba", role: "Transport", type: "transport" },
    { address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", key: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", role: "Inkoop Coöperatie", type: "factory" }
];

const CONTRACTS = {
    USDT: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    IntegratedCottonDPP: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
};

const USDT_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function faucet()",
    "function mint(address to, uint256 amount)"
];

const DPP_ABI = [
    "function registerDID(address controller, string publicKey, string didType)",
    "function issueCredential(address subject, string credentialType, string data, uint256 validityDays)",
    "function createBatch(uint256 weight, uint256 initialQuality, string origin)",
    "function addIoTData(uint256 batchId, int256 temperature, uint256 humidity, string location)",
    "function addBatchIoTData(uint256 batchId, int256[] temperatures, uint256[] humidities, string[] locations)",
    "function payQualityBonus(uint256 batchId)",
    "function updateBatchStatus(uint256 batchId, uint8 newStatus)",
    "function purchaseBatch(uint256 batchId)",
    "function certifyBatch(uint256 batchId, bool approved)",
    "function getMarketBatches() view returns (uint256[])",
    "function getReservedBatches() view returns (uint256[])",
    "function getBatch(uint256) view returns (uint256 id, address farmer, uint256 weight, uint256 quality, string origin, uint256 createdAt, uint8 status, address currentOwner, uint256[] vcIds, bool onMarket, address buyer, uint256 escrowAmount, bool certified, bool rejected)",
    "function getFarmerBatches(address) view returns (uint256[])",
    "function getIoTData(uint256 batchId, uint256 index) view returns (int256 temperature, uint256 humidity, string location, uint256 timestamp, address recorder)",
    "function getIoTDataCount(uint256 batchId) view returns (uint256)",
    "function getBatchPayments(uint256) view returns (tuple(address from, address to, uint256 amount, uint256 batchId, string reason, uint256 timestamp)[])",
    "function hasDID(address) view returns (bool)",
    "function dids(address) view returns (string identifier, string publicKey, string didType, uint256 registered, bool active)",
    "function getSubjectVCs(address subject) view returns (uint256[])",
    "function getCredential(uint256 vcId) view returns (uint256 id, address issuer, address subject, string credentialType, string data, uint256 issuedAt, uint256 expiresAt, bool revoked)",
    "event DIDRegistered(address indexed controller, string identifier, string didType)",
    "event VCIssued(uint256 indexed vcId, address indexed issuer, address indexed subject, string credentialType)",
    "event BatchCreated(uint256 indexed batchId, address indexed farmer, uint256 weight, uint256 quality)",
    "event IoTDataAdded(uint256 indexed batchId, int256 temperature, uint256 humidity, string location)",
    "event BatchPurchased(uint256 indexed batchId, address indexed buyer, uint256 amount)",
    "event BatchCertified(uint256 indexed batchId, bool approved)",
    "event EscrowReleased(uint256 indexed batchId, address indexed farmer, uint256 amount)",
    "event EscrowRefunded(uint256 indexed batchId, address indexed buyer, uint256 amount)"
];

let provider, signer, currentAccount, usdt, dpp, currentRole;

window.addEventListener('load', async () => {
    await init();
});

async function init() {
    try {
        provider = new ethers.JsonRpcProvider(RPC_URL);
        console.log("✅ Connected to blockchain");
    } catch (error) {
        console.error("❌ Init error:", error);
    }
}

// Import custom wallet from DID service
async function importCustomWallet() {
    const result = document.getElementById('importResult');
    try {
        const privateKey = document.getElementById('customPrivateKey').value.trim();
        
        if (!privateKey) {
            throw new Error("Private key is required!");
        }
        
        if (!privateKey.startsWith('0x')) {
            throw new Error("Private key must start with 0x");
        }
        
        // Create wallet from private key
        const wallet = new ethers.Wallet(privateKey, provider);
        const address = wallet.address;
        
        // Check if this wallet has a DID
        const tempDpp = new ethers.Contract(CONTRACTS.IntegratedCottonDPP, DPP_ABI, wallet);
        const hasDID = await tempDpp.hasDID(address);
        
        if (!hasDID) {
            result.innerHTML = '<div class="alert alert-error">⚠️ Deze wallet heeft nog geen DID geregistreerd. Registreer eerst een DID.</div>';
            return;
        }
        
        // Get DID info
        const didInfo = await tempDpp.dids(address);
        
        // Add to TEST_ACCOUNTS array
        TEST_ACCOUNTS.push({
            address: address,
            key: privateKey,
            role: `Custom (${didInfo.didType})`,
            type: "custom"
        });
        
        result.innerHTML = `<div class="alert alert-success">✅ Wallet geïmporteerd!<br>Address: ${address}<br>Type: ${didInfo.didType}<br><br>Klik nu op "Custom DID" kaart om te gebruiken.</div>`;
        
        // Clear input
        document.getElementById('customPrivateKey').value = '';
        
        console.log("✅ Custom wallet imported:", address);
        
    } catch (error) {
        console.error("❌ Import error:", error);
        result.innerHTML = `<div class="alert alert-error">❌ Error: ${error.message}</div>`;
    }
}

function selectRole(roleType, accountIndex) {
    // For async operations in custom role, use wrapper
    if (roleType === 'custom') {
        selectCustomRole();
        return;
    }
    
    // Hide all dashboards
    document.querySelectorAll('.dashboard').forEach(d => d.classList.remove('active'));
    document.querySelectorAll('.role-card').forEach(c => c.classList.remove('active'));
    
    const account = TEST_ACCOUNTS[accountIndex];
    
    // Show selected dashboard
    document.getElementById(`dashboard-${roleType}`).classList.add('active');
    event.currentTarget.classList.add('active');
    
    // Set account
    currentRole = roleType;
    signer = new ethers.Wallet(account.key, provider);
    currentAccount = account.address;
    
    // Initialize contracts
    usdt = new ethers.Contract(CONTRACTS.USDT, USDT_ABI, signer);
    dpp = new ethers.Contract(CONTRACTS.IntegratedCottonDPP, DPP_ABI, signer);
    
    // Update display
    document.getElementById('currentAccount').innerHTML = `${currentAccount.substring(0,10)}...${currentAccount.substring(38)}<br><small>${account.role}</small>`;
    
    updateBalances();
    updateDIDStatus();
    
    // Auto-load farmer data
    if (roleType === 'farmer') {
        farmerLoadVCs();
    }
    
    console.log(`✅ Switched to ${account.role}`);
}

async function selectCustomRole() {
    // Hide all dashboards
    document.querySelectorAll('.dashboard').forEach(d => d.classList.remove('active'));
    document.querySelectorAll('.role-card').forEach(c => c.classList.remove('active'));
    
    const customAccounts = TEST_ACCOUNTS.filter(a => a.type === 'custom');
    if (customAccounts.length === 0) {
        alert('⚠️ Geen custom wallet geïmporteerd! Import eerst een wallet met je private key.');
        return;
    }
    
    const account = customAccounts[customAccounts.length - 1]; // Use last imported
    
    // Activate the custom role card
    const customCard = document.querySelector('[onclick*="custom"]');
    if (customCard) customCard.classList.add('active');
    
    let actualRoleType = 'farmer';
    let roleDisplayName = 'Custom (farmer)';
    
    try {
        // Get actual DID type from blockchain
        const tempProvider = new ethers.JsonRpcProvider(RPC_URL);
        const tempDpp = new ethers.Contract(CONTRACTS.IntegratedCottonDPP, DPP_ABI, tempProvider);
        const didInfo = await tempDpp.dids(account.address);
        
        console.log('📋 DID Info from blockchain:', didInfo);
        
        // Map DID type to dashboard type and display name
        const typeMapping = {
            'farmer': { dashboard: 'farmer', name: 'Boer' },
            'transporter': { dashboard: 'transporter', name: 'Transporteur' },
            'certifier': { dashboard: 'certifier', name: 'Certificeerder' },
            'factory': { dashboard: 'factory', name: 'Inkoop Coöperatie' }
        };
        
        const mapping = typeMapping[didInfo.didType] || typeMapping['farmer'];
        actualRoleType = mapping.dashboard;
        roleDisplayName = `Custom (${mapping.name})`;
        currentRole = actualRoleType;
        
        console.log(`✅ Custom role detected: ${didInfo.didType} -> dashboard: ${actualRoleType} -> display: ${roleDisplayName}`);
        
        // Show appropriate dashboard based on DID type
        document.getElementById(`dashboard-${actualRoleType}`).classList.add('active');
        
    } catch (error) {
        console.warn('Could not fetch DID type, defaulting to farmer:', error);
        currentRole = 'farmer';
        actualRoleType = 'farmer';
        roleDisplayName = 'Custom (Boer)';
        document.getElementById('dashboard-farmer').classList.add('active');
    }
    
    // Set account
    signer = new ethers.Wallet(account.key, provider);
    currentAccount = account.address;
    
    // Initialize contracts
    usdt = new ethers.Contract(CONTRACTS.USDT, USDT_ABI, signer);
    dpp = new ethers.Contract(CONTRACTS.IntegratedCottonDPP, DPP_ABI, signer);
    
    // Update display with correct role name
    document.getElementById('currentAccount').innerHTML = `${currentAccount.substring(0,10)}...${currentAccount.substring(38)}<br><small>${roleDisplayName}</small>`;
    
    await updateBalances();
    await updateDIDStatus();
    
    // Auto-load farmer data if custom wallet is a farmer
    if (actualRoleType === 'farmer') {
        farmerLoadVCs();
    }
    
    console.log(`✅ Switched to custom wallet (${currentRole})`);
}

async function updateBalances() {
    try {
        const ethBalance = await provider.getBalance(currentAccount);
        document.getElementById('ethBalance').textContent = `${ethers.formatEther(ethBalance).substring(0,8)} ETH`;
        
        const usdtBalance = await usdt.balanceOf(currentAccount);
        const decimals = await usdt.decimals();
        document.getElementById('usdtBalance').textContent = `${ethers.formatUnits(usdtBalance, decimals)} USDT`;
    } catch (error) {
        console.error("❌ Balance update error:", error);
    }
}

async function updateDIDStatus() {
    try {
        const hasDID = await dpp.hasDID(currentAccount);
        if (hasDID) {
            const did = await dpp.dids(currentAccount);
            document.getElementById('didStatus').innerHTML = `✅ ${did.didType}`;
        } else {
            document.getElementById('didStatus').textContent = "❌ Geen DID";
        }
    } catch (error) {
        console.error("❌ DID status error:", error);
    }
}

// ========== ADMIN FUNCTIONS ==========

function adminFillAddress() {
    const select = document.getElementById('admin-stakeholder');
    const index = select.value;
    if (index === "") return;
    
    const account = TEST_ACCOUNTS[parseInt(index)];
    document.getElementById('admin-address').value = account.address;
    document.getElementById('admin-type').value = account.type;
}

async function adminRegisterDID() {
    const result = document.getElementById('admin-did-result');
    result.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const address = document.getElementById('admin-address').value;
        const type = document.getElementById('admin-type').value;
        
        if (!address || !type) throw new Error("Selecteer een stakeholder!");
        
        const tx = await dpp.registerDID(address, "0x1234...", type);
        showInfo(result, `Transaction: ${tx.hash}`);
        
        await tx.wait();
        showSuccess(result, `✅ DID geregistreerd voor ${type}!`);
        await adminCheckAllDIDs();
    } catch (error) {
        console.error("❌ Register DID error:", error);
        showError(result, error.message);
    }
}

async function adminCheckAllDIDs() {
    const result = document.getElementById('admin-did-overview');
    result.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        let html = '';
        for (let i = 1; i <= 4; i++) {
            const account = TEST_ACCOUNTS[i];
            const hasDID = await dpp.hasDID(account.address);
            
            if (hasDID) {
                const did = await dpp.dids(account.address);
                html += `<div class="alert alert-success" style="margin: 10px 0;"><strong>✅ ${account.role}</strong><br>DID: ${did.identifier}</div>`;
            } else {
                html += `<div class="alert alert-warning" style="margin: 10px 0;"><strong>⚠️ ${account.role}</strong><br>Nog geen DID</div>`;
            }
        }
        result.innerHTML = html;
    } catch (error) {
        console.error("❌ Check DIDs error:", error);
        showError(result, "Fout bij ophalen");
    }
}

async function adminMintUSDT() {
    const result = document.getElementById('admin-mint-result');
    result.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const to = document.getElementById('admin-mint-to').value;
        const amount = document.getElementById('admin-mint-amount').value;
        
        if (!to || !amount) throw new Error("Alle velden verplicht!");
        
        const amountWei = ethers.parseUnits(amount, 6);
        const tx = await usdt.mint(to, amountWei);
        showInfo(result, `Transaction: ${tx.hash}`);
        
        await tx.wait();
        showSuccess(result, `✅ ${amount} USDT gemint naar ${to}!`);
        await updateBalances();
    } catch (error) {
        console.error("❌ Mint error:", error);
        showError(result, error.message);
    }
}

// ========== FARMER FUNCTIONS ==========

async function farmerCreateBatch() {
    const result = document.getElementById('farmer-create-result');
    result.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const weightInput = document.getElementById('farmer-weight');
        const originInput = document.getElementById('farmer-origin');
        
        if (!weightInput || !originInput) {
            throw new Error("Pagina niet correct geladen. Druk op Ctrl+Shift+R om te herladen!");
        }
        
        const weight = weightInput.value;
        const origin = originInput.value;
        
        // Generate random quality between 60-100
        const quality = Math.floor(Math.random() * 41) + 60;
        
        if (!weight || !origin) throw new Error("Gewicht en herkomst verplicht!");
        
        const tx = await dpp.createBatch(weight, quality, origin);
        showInfo(result, `Transaction: ${tx.hash}<br>Kwaliteit (random): ${quality}/100`);
        
        const receipt = await tx.wait();
        
        const event = receipt.logs.find(log => {
            try {
                const parsed = dpp.interface.parseLog(log);
                return parsed.name === 'BatchCreated';
            } catch { return false; }
        });
        
        let batchId = "Unknown";
        if (event) {
            const parsed = dpp.interface.parseLog(event);
            batchId = parsed.args.batchId.toString();
        }
        
        showSuccess(result, `✅ Batch #${batchId} aangemaakt!<br>Gewicht: ${weight} kg | Kwaliteit: ${quality}/100 (random)<br><br><a href="dpp-viewer.html?batch=${batchId}" target="_blank" class="button button-success" style="text-decoration: none; display: inline-block; width: auto; padding: 12px 24px; margin-top: 10px;">📱 View Digital Product Passport</a>`);
        await farmerLoadBatches();
    } catch (error) {
        console.error("❌ Create batch error:", error);
        showError(result, error.message);
    }
}

async function farmerLoadBatches() {
    const result = document.getElementById('farmer-batches');
    result.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const batchIds = await dpp.getFarmerBatches(currentAccount);
        
        if (batchIds.length === 0) {
            result.innerHTML = '<div class="alert alert-info">Geen batches gevonden.</div>';
            return;
        }
        
        const statusNames = ['Created', 'Reserved', 'Verified', 'Rejected', 'InTransit', 'QualityChecked', 'Delivered', 'Completed'];
        const statusClasses = ['status-created', 'status-transit', 'status-verified', 'status-danger', 'status-transit', 'status-checked', 'status-delivered', 'status-completed'];
        
        let html = '';
        for (const id of batchIds) {
            const batch = await dpp.getBatch(id);
            const date = new Date(Number(batch.createdAt) * 1000).toLocaleString('nl-NL');
            
            // Determine market status
            let marketStatus = '';
            if (batch.onMarket && batch.status === 0) {
                marketStatus = '<span style="color: #f59e0b; font-weight: bold;">🛒 Op Markt</span>';
            } else if (batch.status === 1) { // Reserved
                const escrowAmount = Number(ethers.formatUnits(batch.escrowAmount, 6)).toFixed(2);
                marketStatus = `<span style="color: #3b82f6; font-weight: bold;">💰 Verkocht! (Escrow: ${escrowAmount} USDT - Wacht op certificering)</span>`;
            } else if (batch.status === 2) { // Verified
                marketStatus = '<span style="color: #10b981; font-weight: bold;">✅ Goedgekeurd - Betaald!</span>';
            } else if (batch.status === 3) { // Rejected
                marketStatus = '<span style="color: #ef4444; font-weight: bold;">❌ Afgekeurd - Terug op Markt</span>';
            }
            
            html += `
                <div class="batch-item">
                    <strong>Batch #${id}</strong>
                    <span class="status-badge ${statusClasses[batch.status]}">${statusNames[batch.status]}</span><br>
                    Gewicht: ${batch.weight} kg | Kwaliteit: ${batch.quality}/100<br>
                    Herkomst: ${batch.origin} | ${date}<br>
                    ${marketStatus ? `<div style="margin-top: 8px;">${marketStatus}</div>` : ''}
                    <a href="dpp-viewer.html?batch=${id}" target="_blank" class="button button-success" style="text-decoration: none; display: inline-block; width: auto; padding: 8px 16px; margin-top: 8px; font-size: 13px;">📱 View DPP</a>
                </div>
            `;
        }
        
        result.innerHTML = html;
    } catch (error) {
        console.error("❌ Load batches error:", error);
        showError(result, "Fout bij laden");
    }
}

async function farmerLoadVCs() {
    const result = document.getElementById('farmer-vcs');
    
    // Check if contracts are initialized
    if (!dpp || !currentAccount) {
        result.innerHTML = '<div class="alert alert-warning">⚠️ Selecteer eerst een wallet om VCs te laden.</div>';
        return;
    }
    
    result.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        console.log('🔍 Fetching VCs for account:', currentAccount);
        console.log('🔗 DPP Contract:', CONTRACTS.IntegratedCottonDPP);
        
        // Get all VC IDs for this farmer
        const vcIds = await dpp.getSubjectVCs(currentAccount);
        console.log('📋 VC IDs found:', vcIds);
        console.log('📊 Total VCs:', vcIds.length);
        
        if (vcIds.length === 0) {
            result.innerHTML = '<div class="alert alert-info">💡 U heeft nog geen Verifiable Credentials. Een certificeerder kan deze aan u toewijzen.</div>';
            return;
        }
        
        let html = `<div style="margin-bottom: 1rem;"><strong>Totaal VCs: ${vcIds.length}</strong></div>`;
        
        // Load details for each VC
        for (const vcId of vcIds) {
            const vc = await dpp.getCredential(vcId);
            
            const issuedDate = new Date(Number(vc.issuedAt) * 1000).toLocaleDateString('nl-NL');
            
            // Parse data JSON to get real expiry date
            let realExpiryDate = null;
            let isExpired = false;
            let expiresDate = '';
            
            try {
                const dataObj = JSON.parse(vc.data);
                if (dataObj.geldigTot) {
                    realExpiryDate = new Date(dataObj.geldigTot);
                    expiresDate = realExpiryDate.toLocaleDateString('nl-NL');
                    isExpired = Date.now() > realExpiryDate.getTime();
                } else {
                    // Fallback to blockchain expiry if geldigTot not in data
                    expiresDate = new Date(Number(vc.expiresAt) * 1000).toLocaleDateString('nl-NL');
                    isExpired = Date.now() > Number(vc.expiresAt) * 1000;
                }
            } catch (e) {
                // If parsing fails, use blockchain expiry
                expiresDate = new Date(Number(vc.expiresAt) * 1000).toLocaleDateString('nl-NL');
                isExpired = Date.now() > Number(vc.expiresAt) * 1000;
            }
            
            const isRevoked = vc.revoked;
            
            let statusBadge = '';
            if (isRevoked) {
                statusBadge = '<span class="status-badge" style="background: #ef4444;">❌ Ingetrokken</span>';
            } else if (isExpired) {
                statusBadge = '<span class="status-badge" style="background: #f97316;">⏰ Verlopen</span>';
            } else {
                statusBadge = '<span class="status-badge status-verified">✅ Geldig</span>';
            }
            
            // Parse data JSON for display
            let dataDisplay = vc.data;
            try {
                const dataObj = JSON.parse(vc.data);
                dataDisplay = Object.entries(dataObj)
                    .map(([key, value]) => `<div style="margin: 4px 0;"><strong>${key}:</strong> ${value}</div>`)
                    .join('');
            } catch (e) {
                // Keep as plain text if not JSON
            }
            
            html += `
                <div class="batch-item" style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-left: 4px solid #0ea5e9;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <strong style="font-size: 16px;">🎓 VC #${vcId}</strong>
                        ${statusBadge}
                    </div>
                    <div style="margin: 8px 0;">
                        <strong>Type:</strong> ${vc.credentialType}<br>
                        <strong>Uitgever:</strong> <span style="font-family: monospace; font-size: 12px;">${vc.issuer}</span><br>
                        <strong>Uitgegeven:</strong> ${issuedDate}<br>
                        <strong>Geldig tot:</strong> ${expiresDate}
                    </div>
                    <div style="background: white; padding: 10px; border-radius: 6px; margin-top: 8px;">
                        <strong>📄 Details:</strong><br>
                        ${dataDisplay}
                    </div>
                </div>
            `;
        }
        
        result.innerHTML = html;
    } catch (error) {
        console.error("❌ Load VCs error:", error);
        showError(result, error.message || "Fout bij laden VCs");
    }
}

// ========== TRANSPORTER FUNCTIONS ==========

async function transporterAddIoT() {
    const result = document.getElementById('trans-iot-result');
    result.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const batchId = document.getElementById('trans-batch').value;
        
        if (!batchId) throw new Error("Batch ID verplicht!");
        
        // Generate 10-15 random IoT records
        const numRecords = Math.floor(Math.random() * 6) + 10; // 10 to 15
        const locations = [
            "Gujarat, India",
            "Maharashtra, India", 
            "Mumbai Port",
            "Arabian Sea",
            "Suez Canal",
            "Mediterranean Sea",
            "Rotterdam Port",
            "Netherlands Warehouse"
        ];
        
        showInfo(result, `📡 ${numRecords} IoT records genereren...`);
        
        let recordsAdded = 0;
        for (let i = 0; i < numRecords; i++) {
            // Random temperature between 15-35°C
            const temp = Math.floor(Math.random() * 21) + 15;
            // Random humidity between 40-80%
            const humidity = Math.floor(Math.random() * 41) + 40;
            // Pick random location from route
            const location = locations[Math.floor(Math.random() * locations.length)];
            
            const tx = await dpp.addIoTData(batchId, temp, humidity, location);
            await tx.wait();
            recordsAdded++;
            
            showInfo(result, `📡 Record ${recordsAdded}/${numRecords}: ${temp}°C, ${humidity}%, ${location}`);
        }
        
        showSuccess(result, `✅ ${numRecords} IoT records toegevoegd aan Batch #${batchId}!<br>🌡️ Temp: 15-35°C | 💧 Humidity: 40-80%`);
    } catch (error) {
        console.error("❌ Add IoT error:", error);
        showError(result, error.message);
    }
}

async function transporterTrack() {
    const result = document.getElementById('trans-track-result');
    result.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const batchId = document.getElementById('trans-track').value;
        if (!batchId) throw new Error("Batch ID verplicht!");
        
        const batch = await dpp.getBatch(batchId);
        let iotCount = await dpp.getIoTDataCount(batchId);
        
        const statusNames = ['Created', 'Verified', 'InTransit', 'QualityChecked', 'Delivered', 'Completed'];
        
        // If no IoT data exists, generate it automatically (realistic supply chain route)
        if (iotCount == 0) {
            showInfo(result, '📡 Geen IoT data gevonden. Supply chain route simuleren...');
            
            // Complete supply chain route with transport stages
            const supplyChainRoute = [
                // Stage 1: Boer → Inkoopcoöperatie (lokaal transport)
                { stage: "Boer → Inkoopcoöperatie", location: "Farm Gujarat, India", temp: [25, 30], humidity: [50, 60] },
                { stage: "Boer → Inkoopcoöperatie", location: "Transport Gujarat", temp: [28, 35], humidity: [45, 55] },
                { stage: "Boer → Inkoopcoöperatie", location: "Inkoopcoöperatie Gujarat", temp: [22, 28], humidity: [50, 60] },
                
                // Stage 2: Inkoopcoöperatie → Opslagfaciliteit (regionaal transport)
                { stage: "Inkoopcoöperatie → Opslagfaciliteit", location: "Transport Maharashtra", temp: [26, 32], humidity: [48, 58] },
                { stage: "Inkoopcoöperatie → Opslagfaciliteit", location: "Opslagfaciliteit Maharashtra", temp: [20, 25], humidity: [52, 62] },
                
                // Stage 3: Opslagfaciliteit → Haven (nationaal transport)
                { stage: "Opslagfaciliteit → Haven", location: "Transport naar Mumbai", temp: [28, 34], humidity: [55, 70] },
                { stage: "Opslagfaciliteit → Haven", location: "Mumbai Port India", temp: [30, 35], humidity: [60, 75] },
                
                // Stage 4: Zeevracht (internationaal transport)
                { stage: "Zeevracht", location: "Arabian Sea", temp: [25, 30], humidity: [65, 75] },
                { stage: "Zeevracht", location: "Indian Ocean", temp: [24, 29], humidity: [65, 75] },
                { stage: "Zeevracht", location: "Red Sea", temp: [26, 32], humidity: [60, 70] },
                { stage: "Zeevracht", location: "Suez Canal", temp: [25, 31], humidity: [55, 65] },
                { stage: "Zeevracht", location: "Mediterranean Sea", temp: [20, 26], humidity: [60, 70] },
                { stage: "Zeevracht", location: "Atlantic Ocean", temp: [18, 24], humidity: [65, 75] },
                
                // Stage 5: Haven Nederland → Verwerker (lokaal transport NL)
                { stage: "Haven → Verwerker", location: "Rotterdam Port Netherlands", temp: [15, 20], humidity: [70, 80] },
                { stage: "Haven → Verwerker", location: "Transport Rotterdam", temp: [16, 22], humidity: [68, 78] },
                { stage: "Haven → Verwerker", location: "Verwerker Netherlands", temp: [18, 22], humidity: [65, 75] }
            ];
            
            // Prepare arrays for batch IoT data
            const temperatures = [];
            const humidities = [];
            const locations = [];
            
            for (let i = 0; i < supplyChainRoute.length; i++) {
                const point = supplyChainRoute[i];
                
                // Random temperature within the realistic range for this location
                const temp = Math.floor(Math.random() * (point.temp[1] - point.temp[0] + 1)) + point.temp[0];
                
                // Random humidity within the realistic range for this location
                const humidity = Math.floor(Math.random() * (point.humidity[1] - point.humidity[0] + 1)) + point.humidity[0];
                
                temperatures.push(temp);
                humidities.push(humidity);
                locations.push(point.location);
                
                showInfo(result, `📡 [${point.stage}] ${i+1}/${supplyChainRoute.length}: ${point.location} - ${temp}°C, ${humidity}%`);
            }
            
            // Add all IoT records in ONE transaction
            showInfo(result, '🚀 IoT records naar blockchain sturen (1 transactie)...');
            const tx = await dpp.addBatchIoTData(batchId, temperatures, humidities, locations);
            await tx.wait();
            
            iotCount = await dpp.getIoTDataCount(batchId);
            showInfo(result, `✅ ${iotCount} IoT records toegevoegd in 1 transactie!`);
        }
        
        let html = `
            <div class="alert alert-info" style="margin-top: 1rem;">
                <strong>📦 Batch #${batchId}</strong><br>
                👨‍🌾 Boer: ${batch.farmer}<br>
                ⚖️ Gewicht: ${batch.weight} kg | ⭐ Kwaliteit: ${batch.quality}/100<br>
                📊 Status: ${statusNames[batch.status]}<br>
                📡 IoT Records: ${iotCount}<br><br>
                <a href="dpp-viewer.html?batch=${batchId}" target="_blank" class="button button-success" style="text-decoration: none; display: inline-block; width: auto; padding: 10px 20px; font-size: 14px;">📱 View Digital Product Passport</a>
            </div>
            <h3>🌡️ IoT Sensor Data:</h3>
        `;
        
        if (iotCount > 0) {
            for (let i = 0; i < iotCount; i++) {
                const iot = await dpp.getIoTData(batchId, i);
                const timestamp = new Date(Number(iot.timestamp) * 1000).toLocaleString('nl-NL');
                
                html += `
                    <div class="batch-item">
                        <strong>Record #${i + 1}</strong><br>
                        🌡️ ${iot.temperature}°C | 💧 ${iot.humidity}% | 📍 ${iot.location}<br>
                        📅 ${timestamp}
                    </div>
                `;
            }
        } else {
            html += '<div class="alert alert-warning">Nog geen IoT data.</div>';
        }
        
        result.innerHTML = html;
    } catch (error) {
        console.error("❌ Track error:", error);
        showError(result, error.message);
    }
}

// ========== CERTIFIER FUNCTIONS ==========
// Legacy certifierIssueVC() function removed - use vc-aanvraag.html for VC issuance

// ========== FACTORY FUNCTIONS ==========

async function factoryUpdateStatus() {
    const result = document.getElementById('fact-status-result');
    result.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const batchId = document.getElementById('fact-batch').value;
        const status = document.getElementById('fact-status').value;
        
        if (!batchId || !status) throw new Error("Alle velden verplicht!");
        
        const tx = await dpp.updateBatchStatus(batchId, status);
        showInfo(result, `Transaction: ${tx.hash}`);
        
        await tx.wait();
        
        const statusNames = ['Created', 'Verified', 'InTransit', 'QualityChecked', 'Delivered', 'Completed'];
        showSuccess(result, `✅ Batch #${batchId} status: ${statusNames[status]}`);
    } catch (error) {
        console.error("❌ Update status error:", error);
        showError(result, error.message);
    }
}

async function factoryPayFarmer() {
    const result = document.getElementById('fact-pay-result');
    result.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const batchId = document.getElementById('fact-pay-batch').value;
        if (!batchId) throw new Error("Batch ID verplicht!");
        
        showInfo(result, `📋 Batch #${batchId} ophalen en valideren...`);
        
        // Get batch details
        const batch = await dpp.getBatch(batchId);
        const farmerAddress = batch.farmer;
        const quality = Number(batch.quality);
        const weight = Number(batch.weight);
        const status = Number(batch.status);
        
        // Status check: must be Verified (1) or higher
        if (status < 1) {
            throw new Error(`❌ Batch moet eerst geverifieerd zijn door certificeerder!\n\nHuidige status: ${['Created', 'Verified', 'InTransit', 'QualityChecked', 'Delivered', 'Completed'][status]}\n\nVereist: Verified of hoger`);
        }
        
        showInfo(result, `✅ Batch status: ${['Created', 'Verified', 'InTransit', 'QualityChecked', 'Delivered', 'Completed'][status]}<br>🔍 Certificaten van boer controleren...`);
        
        // Check if farmer has valid VCs
        const vcIds = await dpp.getSubjectVCs(farmerAddress);
        
        if (vcIds.length === 0) {
            throw new Error(`❌ Boer heeft geen certificaten!\n\nBoer adres: ${farmerAddress}\n\nDe boer moet minimaal 1 geldig certificaat hebben voor uitbetaling.`);
        }
        
        // Check if at least one VC is valid (not expired, not revoked)
        let hasValidVC = false;
        let validVCTypes = [];
        
        for (const vcId of vcIds) {
            const vc = await dpp.getCredential(vcId);
            
            // Parse VC data for real expiry date
            let isExpired = false;
            try {
                const vcDataObj = JSON.parse(vc.data);
                if (vcDataObj.geldigTot) {
                    const realExpiryDate = new Date(vcDataObj.geldigTot);
                    isExpired = Date.now() > realExpiryDate.getTime();
                } else {
                    isExpired = Date.now() > Number(vc.expiresAt) * 1000;
                }
            } catch (e) {
                isExpired = Date.now() > Number(vc.expiresAt) * 1000;
            }
            
            if (!vc.revoked && !isExpired) {
                hasValidVC = true;
                validVCTypes.push(vc.credentialType);
            }
        }
        
        if (!hasValidVC) {
            throw new Error(`❌ Boer heeft geen geldig certificaat!\n\nBoer heeft ${vcIds.length} certificaat(en), maar allemaal verlopen of ingetrokken.\n\nDe boer moet minimaal 1 GELDIG certificaat hebben voor uitbetaling.`);
        }
        
        showInfo(result, `✅ Boer heeft ${validVCTypes.length} geldig(e) certificaat(en):<br>${validVCTypes.join(', ')}<br><br>💰 Betaling berekenen...`);
        
        // Calculate payment based on NEW quality structure
        const baseRate = 10; // NEW Base rate per kg
        let ratePerKg = baseRate;
        let bonusPerc = 0;
        let qualityTier = 'Basis';
        
        if (quality >= 90) {
            bonusPerc = 30;
            ratePerKg = 13; // 10 + 30% = 13
            qualityTier = 'Premium (90-100)';
        } else if (quality >= 70) {
            bonusPerc = 15;
            ratePerKg = 11.5; // 10 + 15% = 11.5
            qualityTier = 'Goed (70-89)';
        } else {
            qualityTier = 'Basis (50-69)';
        }
        
        const totalAmount = weight * ratePerKg;
        const amountWei = ethers.parseUnits(totalAmount.toString(), 6);
        
        showInfo(result, `Stap 1: USDT goedkeuren (${totalAmount.toFixed(2)} USDT)...`);
        const approveTx = await usdt.approve(CONTRACTS.IntegratedCottonDPP, amountWei);
        await approveTx.wait();
        
        showInfo(result, `Stap 2: Betaling uitvoeren...`);
        const tx = await dpp.payQualityBonus(batchId);
        showInfo(result, `Transaction: ${tx.hash}`);
        
        await tx.wait();
        
        showSuccess(result, `
            ✅ Boer succesvol uitbetaald!<br><br>
            <strong>📊 Batch Details:</strong><br>
            Gewicht: ${weight} kg<br>
            Kwaliteit: ${quality}/100 (${qualityTier})<br><br>
            <strong>💰 Betaling:</strong><br>
            Tarief: ${ratePerKg} USDT/kg ${bonusPerc > 0 ? `(+${bonusPerc}% bonus)` : ''}<br>
            <strong>Totaal: ${totalAmount.toFixed(2)} USDT</strong><br><br>
            <strong>✅ Certificaten:</strong><br>
            ${validVCTypes.join('<br>')}
        `);
        
        await updateBalances();
    } catch (error) {
        console.error("❌ Pay farmer error:", error);
        showError(result, error.message);
    }
}

async function factoryMarkAsDeliveredAndPay() {
    const result = document.getElementById('fact-delivery-result');
    result.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const batchId = document.getElementById('fact-delivery-batch').value;
        if (!batchId) throw new Error("Batch ID verplicht!");
        
        showInfo(result, `📋 Batch #${batchId} ophalen en valideren...`);
        
        // Get batch details
        const batch = await dpp.getBatch(batchId);
        const farmerAddress = batch.farmer;
        const quality = Number(batch.quality);
        const weight = Number(batch.weight);
        const status = Number(batch.status);
        const statusNames = ['Created', 'Verified', 'InTransit', 'QualityChecked', 'Delivered', 'Completed'];
        
        // Check if already delivered
        if (status >= 4) {
            throw new Error(`❌ Batch is al aangekomen/voltooid!\n\nHuidige status: ${statusNames[status]}`);
        }
        
        // Status check: must be Verified (1) or higher
        if (status < 1) {
            throw new Error(`❌ Batch moet eerst geverifieerd zijn door certificeerder!\n\nHuidige status: ${statusNames[status]}\n\nVereist: Verified of hoger`);
        }
        
        showInfo(result, `✅ Batch status: ${statusNames[status]}<br>🔍 Certificaten van boer controleren...`);
        
        // Check if farmer has valid VCs
        const vcIds = await dpp.getSubjectVCs(farmerAddress);
        
        if (vcIds.length === 0) {
            throw new Error(`❌ Boer heeft geen certificaten!\n\nBoer adres: ${farmerAddress}\n\nDe boer moet minimaal 1 geldig certificaat hebben voor uitbetaling.`);
        }
        
        // Check if at least one VC is valid (not expired, not revoked)
        let hasValidVC = false;
        let validVCTypes = [];
        
        for (const vcId of vcIds) {
            const vc = await dpp.getCredential(vcId);
            
            // Parse VC data for real expiry date
            let isExpired = false;
            try {
                const vcDataObj = JSON.parse(vc.data);
                if (vcDataObj.geldigTot) {
                    const realExpiryDate = new Date(vcDataObj.geldigTot);
                    isExpired = Date.now() > realExpiryDate.getTime();
                } else {
                    isExpired = Date.now() > Number(vc.expiresAt) * 1000;
                }
            } catch (e) {
                isExpired = Date.now() > Number(vc.expiresAt) * 1000;
            }
            
            if (!vc.revoked && !isExpired) {
                hasValidVC = true;
                validVCTypes.push(vc.credentialType);
            }
        }
        
        if (!hasValidVC) {
            throw new Error(`❌ Boer heeft geen geldig certificaat!\n\nBoer heeft ${vcIds.length} certificaat(en), maar allemaal verlopen of ingetrokken.\n\nDe boer moet minimaal 1 GELDIG certificaat hebben voor uitbetaling.`);
        }
        
        showInfo(result, `✅ Boer heeft ${validVCTypes.length} geldig(e) certificaat(en):<br>${validVCTypes.join(', ')}<br><br>💰 Betaling berekenen...`);
        
        // Calculate payment based on NEW quality structure
        const baseRate = 10; // Base rate per kg
        let ratePerKg = baseRate;
        let bonusPerc = 0;
        let qualityTier = 'Basis';
        
        if (quality >= 90) {
            bonusPerc = 30;
            ratePerKg = 13; // 10 + 30% = 13
            qualityTier = 'Premium (90-100)';
        } else if (quality >= 70) {
            bonusPerc = 15;
            ratePerKg = 11.5; // 10 + 15% = 11.5
            qualityTier = 'Goed (70-89)';
        } else {
            qualityTier = 'Basis (50-69)';
        }
        
        const totalAmount = weight * ratePerKg;
        const amountWei = ethers.parseUnits(totalAmount.toString(), 6);
        
        showInfo(result, `Stap 1: USDT goedkeuren (${totalAmount.toFixed(2)} USDT)...`);
        const approveTx = await usdt.approve(CONTRACTS.IntegratedCottonDPP, amountWei);
        await approveTx.wait();
        
        showInfo(result, `Stap 2: Betaling uitvoeren...`);
        const payTx = await dpp.payQualityBonus(batchId);
        showInfo(result, `Betaling Transaction: ${payTx.hash}`);
        await payTx.wait();
        
        showInfo(result, `Stap 3: Status wijzigen naar Delivered...`);
        const statusTx = await dpp.updateBatchStatus(batchId, 4); // 4 = Delivered
        showInfo(result, `Status Transaction: ${statusTx.hash}`);
        await statusTx.wait();
        
        showSuccess(result, `
            ✅ Batch succesvol aangekomen en boer uitbetaald!<br><br>
            <strong>📦 Batch #${batchId}</strong><br>
            Nieuwe Status: <strong>Delivered (Aangekomen)</strong><br><br>
            <strong>📊 Batch Details:</strong><br>
            Gewicht: ${weight} kg<br>
            Kwaliteit: ${quality}/100 (${qualityTier})<br><br>
            <strong>💰 Betaling aan Boer:</strong><br>
            Basis tarief: ${baseRate} USDT/kg<br>
            ${bonusPerc > 0 ? `Bonus: +${bonusPerc}%<br>` : ''}
            <strong>Tarief: ${ratePerKg} USDT/kg</strong><br>
            <strong>Totaal Betaald: ${totalAmount.toFixed(2)} USDT</strong><br><br>
            <strong>✅ Certificaten:</strong><br>
            ${validVCTypes.join('<br>')}
        `);
        
        await updateBalances();
    } catch (error) {
        console.error("❌ Delivery + payment error:", error);
        showError(result, error.message);
    }
}

async function factoryViewBatch() {
    const result = document.getElementById('fact-view-result');
    result.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const batchId = document.getElementById('fact-view-batch').value;
        if (!batchId) throw new Error("Batch ID verplicht!");
        
        const batch = await dpp.getBatch(batchId);
        const statusNames = ['Created', 'Verified', 'InTransit', 'QualityChecked', 'Delivered', 'Completed'];
        
        let html = `
            <div class="info-grid" style="margin-top: 1rem;">
                <div class="info-item"><strong>Batch ID</strong><span>${batchId}</span></div>
                <div class="info-item"><strong>Boer</strong><span>${batch.farmer}</span></div>
                <div class="info-item"><strong>Gewicht</strong><span>${batch.weight} kg</span></div>
                <div class="info-item"><strong>Kwaliteit</strong><span>${batch.quality}/100</span></div>
                <div class="info-item"><strong>Herkomst</strong><span>${batch.origin}</span></div>
                <div class="info-item"><strong>Status</strong><span>${statusNames[batch.status]}</span></div>
            </div>
        `;
        
        result.innerHTML = html;
    } catch (error) {
        console.error("❌ View batch error:", error);
        showError(result, error.message);
    }
}

// ========== MARKETPLACE FUNCTIONS ==========

async function factoryLoadMarket() {
    const result = document.getElementById('factory-market');
    result.innerHTML = '<div class="loading"><div class="spinner"></div><p>Laden marktplaats...</p></div>';
    
    try {
        const marketBatches = await dpp.getMarketBatches();
        
        if (marketBatches.length === 0) {
            result.innerHTML = '<div class="alert alert-info">📭 Geen batches beschikbaar op de markt. Wacht tot boeren nieuwe batches aanmaken.</div>';
            return;
        }
        
        let html = '<div class="batch-list">';
        
        for (const batchId of marketBatches) {
            const batch = await dpp.getBatch(batchId);
            const quality = Number(batch.quality);
            const weight = Number(batch.weight);
            
            // Calculate price based on quality
            let pricePerKg = 10;
            let bonusText = '';
            if (quality >= 90) {
                pricePerKg = 13;
                bonusText = '<span style="color: #10b981;">+30% Premium</span>';
            } else if (quality >= 70) {
                pricePerKg = 11.5;
                bonusText = '<span style="color: #f59e0b;">+15% Bonus</span>';
            }
            
            const totalPrice = (pricePerKg * weight).toFixed(2);
            
            html += `
                <div class="batch-item" style="border-left: 4px solid #f59e0b;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1;">
                            <strong style="font-size: 16px;">🌾 Batch #${batchId}</strong>
                            <div style="margin-top: 8px; color: #666;">
                                <strong>Boer:</strong> ${batch.farmer.substring(0,10)}...${batch.farmer.substring(38)}<br>
                                <strong>Gewicht:</strong> ${weight} kg<br>
                                <strong>Kwaliteit:</strong> ${quality}/100 ${bonusText}<br>
                                <strong>Herkomst:</strong> ${batch.origin}<br>
                                <strong>💰 Prijs:</strong> ${pricePerKg} USDT/kg = <strong style="color: #059669; font-size: 18px;">${totalPrice} USDT</strong>
                            </div>
                        </div>
                        <div>
                            <button class="button button-success" onclick="factoryPurchaseBatch(${batchId})" style="min-width: 150px;">
                                🛒 Koop Batch
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        result.innerHTML = html;
        
    } catch (error) {
        console.error("❌ Load market error:", error);
        showError(result, error.message);
    }
}

async function factoryPurchaseBatch(batchId) {
    const result = document.getElementById('factory-market');
    
    if (!confirm(`Weet je zeker dat je Batch #${batchId} wilt kopen? Het bedrag wordt in escrow vastgezet tot de certificeerder goedkeurt.`)) {
        return;
    }
    
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'alert alert-info';
    loadingDiv.innerHTML = '⏳ Batch aan het kopen en escrow aan het zetten...';
    result.insertBefore(loadingDiv, result.firstChild);
    
    try {
        const batch = await dpp.getBatch(batchId);
        const quality = Number(batch.quality);
        const weight = Number(batch.weight);
        
        // Calculate price
        let pricePerKg = 10;
        if (quality >= 90) {
            pricePerKg = 13;
        } else if (quality >= 70) {
            pricePerKg = 11.5;
        }
        
        const totalPrice = ethers.parseUnits((pricePerKg * weight).toString(), 6);
        
        // Step 1: Approve USDT
        loadingDiv.innerHTML = '⏳ Stap 1/2: USDT goedkeuring...';
        const approveTx = await usdt.approve(CONTRACTS.IntegratedCottonDPP, totalPrice);
        await approveTx.wait();
        
        // Step 2: Purchase batch
        loadingDiv.innerHTML = '⏳ Stap 2/2: Batch kopen en escrow zetten...';
        const purchaseTx = await dpp.purchaseBatch(batchId);
        await purchaseTx.wait();
        
        loadingDiv.className = 'alert alert-success';
        loadingDiv.innerHTML = `
            ✅ Batch #${batchId} succesvol gekocht!<br>
            💰 ${ethers.formatUnits(totalPrice, 6)} USDT in escrow gezet<br>
            📋 Wacht nu op goedkeuring van de certificeerder
        `;
        
        await updateBalances();
        await factoryLoadMarket();
        await factoryLoadReservedBatches();
        
    } catch (error) {
        console.error("❌ Purchase batch error:", error);
        loadingDiv.className = 'alert alert-error';
        loadingDiv.innerHTML = `❌ Fout bij aankoop: ${error.message}`;
    }
}

async function factoryLoadReservedBatches() {
    const result = document.getElementById('factory-reserved');
    result.innerHTML = '<div class="loading"><div class="spinner"></div><p>Laden gekochte batches...</p></div>';
    
    try {
        const reservedBatches = await dpp.getReservedBatches();
        
        // Filter on batches where current account is the buyer
        const myReservedBatches = [];
        for (const batchId of reservedBatches) {
            const batch = await dpp.getBatch(batchId);
            if (batch.buyer.toLowerCase() === currentAccount.toLowerCase()) {
                myReservedBatches.push({ id: batchId, batch });
            }
        }
        
        if (myReservedBatches.length === 0) {
            result.innerHTML = '<div class="alert alert-info">📭 Je hebt nog geen batches gekocht die wachten op certificering.</div>';
            return;
        }
        
        let html = '<div class="batch-list">';
        
        for (const { id, batch } of myReservedBatches) {
            const quality = Number(batch.quality);
            const weight = Number(batch.weight);
            const escrowAmount = Number(ethers.formatUnits(batch.escrowAmount, 6));
            
            html += `
                <div class="batch-item" style="border-left: 4px solid #3b82f6;">
                    <strong style="font-size: 16px;">🌾 Batch #${id}</strong>
                    <div style="margin-top: 8px; color: #666;">
                        <strong>Boer:</strong> ${batch.farmer.substring(0,10)}...${batch.farmer.substring(38)}<br>
                        <strong>Gewicht:</strong> ${weight} kg<br>
                        <strong>Kwaliteit:</strong> ${quality}/100<br>
                        <strong>Herkomst:</strong> ${batch.origin}<br>
                        <strong>💰 Escrow:</strong> <span style="color: #3b82f6; font-weight: bold;">${escrowAmount.toFixed(2)} USDT</span><br>
                        <strong>Status:</strong> <span class="status-badge" style="background: #fef3c7; color: #92400e;">⏳ Wacht op Certificering</span>
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        result.innerHTML = html;
        
    } catch (error) {
        console.error("❌ Load reserved batches error:", error);
        showError(result, error.message);
    }
}

// ========== SHARED FUNCTIONS ==========

async function getFaucet() {
    const resultId = currentRole === 'farmer' ? 'farmer-faucet-result' : 'fact-faucet-result';
    const result = document.getElementById(resultId);
    result.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const tx = await usdt.faucet();
        showInfo(result, `Transaction: ${tx.hash}`);
        
        await tx.wait();
        showSuccess(result, `✅ 1000 USDT ontvangen!`);
        await updateBalances();
    } catch (error) {
        console.error("❌ Faucet error:", error);
        showError(result, error.message || "Mogelijk al genoeg USDT");
    }
}

// Helper functions
function showSuccess(element, message) {
    element.innerHTML = `<div class="alert alert-success">${message}</div>`;
}

function showError(element, message) {
    element.innerHTML = `<div class="alert alert-error">❌ ${message}</div>`;
}

function showInfo(element, message) {
    element.innerHTML = `<div class="alert alert-info">ℹ️ ${message}</div>`;
}

console.log("✅ Stakeholder app loaded!");

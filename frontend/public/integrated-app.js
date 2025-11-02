// Configuration
const RPC_URL = "http://localhost:8545";

// Test accounts from Hardhat
const TEST_ACCOUNTS = [
    { address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", key: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", role: "Admin" },
    { address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", key: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", role: "Boer" },
    { address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", key: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", role: "Transporteur" },
    { address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", key: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", role: "Certificeerder" },
    { address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", key: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", role: "Fabriek" }
];

// Contract addresses - UPDATED FROM DEPLOYMENT
const CONTRACTS = {
    USDT: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    IntegratedCottonDPP: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
};

// ABIs
const USDT_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function faucet()"
];

const INTEGRATED_DPP_ABI = [
    "function registerDID(address controller, string publicKey, string didType)",
    "function issueCredential(address subject, string credentialType, string data, uint256 validityDays)",
    "function createBatch(uint256 weight, uint256 initialQuality, string origin)",
    "function addIoTData(uint256 batchId, int256 temperature, uint256 humidity, string location)",
    "function addBatchIoTData(uint256 batchId, int256[] temperatures, uint256[] humidities, string[] locations)",
    "function payForBatch(uint256 batchId, address to, uint256 amount, string reason)",
    "function payQualityBonus(uint256 batchId)",
    "function attachVCToBatch(uint256 batchId, uint256 vcId)",
    "function updateBatchStatus(uint256 batchId, uint8 newStatus)",
    "function getBatch(uint256) view returns (uint256 id, address farmer, uint256 weight, uint256 quality, string origin, uint256 createdAt, uint8 status, address currentOwner, uint256[] vcIds)",
    "function getFarmerBatches(address) view returns (uint256[])",
    "function getTotalBatches() view returns (uint256)",
    "function getIoTData(uint256 batchId, uint256 index) view returns (int256 temperature, uint256 humidity, string location, uint256 timestamp, address recorder)",
    "function getIoTDataCount(uint256 batchId) view returns (uint256)",
    "function getBatchPayments(uint256) view returns (tuple(address from, address to, uint256 amount, uint256 batchId, string reason, uint256 timestamp)[])",
    "function hasDID(address) view returns (bool)",
    "function dids(address) view returns (string identifier, string publicKey, string didType, uint256 registered, bool active)",
    "function getCredential(uint256 vcId) view returns (uint256 id, address issuer, address subject, string credentialType, string data, uint256 issuedAt, uint256 expiresAt, bool revoked)",
    "event DIDRegistered(address indexed controller, string identifier, string didType)",
    "event VCIssued(uint256 indexed vcId, address indexed issuer, address indexed subject, string credentialType)",
    "event BatchCreated(uint256 indexed batchId, address indexed farmer, uint256 weight, uint256 quality)",
    "event IoTDataAdded(uint256 indexed batchId, int256 temperature, uint256 humidity, string location)",
    "event PaymentMade(uint256 indexed batchId, address indexed from, address indexed to, uint256 amount, string reason)"
];

// Global state
let provider;
let signer;
let currentAccount;
let usdt;
let integratedDPP;

// Initialize on load
window.addEventListener('load', async () => {
    await init();
});

async function init() {
    try {
        provider = new ethers.JsonRpcProvider(RPC_URL);
        
        // Test connection
        const network = await provider.getNetwork();
        console.log(`✅ Connected to blockchain (Chain ID: ${network.chainId})`);
        
        // Use Account #1 (Boer) by default
        await selectAccount(1);
        
        console.log("✅ App initialized");
    } catch (error) {
        console.error("❌ Init error:", error);
        showError(document.body, "Failed to connect to blockchain!");
    }
}

async function selectAccount(index) {
    try {
        const account = TEST_ACCOUNTS[index];
        signer = new ethers.Wallet(account.key, provider);
        currentAccount = account.address;
        
        // Initialize contracts
        usdt = new ethers.Contract(CONTRACTS.USDT, USDT_ABI, signer);
        integratedDPP = new ethers.Contract(CONTRACTS.IntegratedCottonDPP, INTEGRATED_DPP_ABI, signer);
        
        // Update display
        document.getElementById('currentAccount').textContent = `${currentAccount.substring(0, 10)}...${currentAccount.substring(38)} (${account.role})`;
        
        // Update balances
        await updateBalances();
        
        // Update DID status
        await updateDIDStatus();
        
        console.log(`✅ Switched to ${account.role}: ${currentAccount}`);
    } catch (error) {
        console.error("❌ Account switch error:", error);
    }
}

async function updateBalances() {
    try {
        // ETH balance
        const ethBalance = await provider.getBalance(currentAccount);
        document.getElementById('ethBalance').textContent = `${ethers.formatEther(ethBalance)} ETH`;
        
        // USDT balance
        const usdtBalance = await usdt.balanceOf(currentAccount);
        const decimals = await usdt.decimals();
        document.getElementById('usdtBalance').textContent = `${ethers.formatUnits(usdtBalance, decimals)} USDT`;
    } catch (error) {
        console.error("❌ Balance update error:", error);
    }
}

async function updateDIDStatus() {
    try {
        const hasDID = await integratedDPP.hasDID(currentAccount);
        if (hasDID) {
            const did = await integratedDPP.dids(currentAccount);
            document.getElementById('didStatus').innerHTML = `✅ ${did.didType} (${did.identifier})`;
            updateStep(1, 'completed');
        } else {
            document.getElementById('didStatus').textContent = "❌ Geen DID geregistreerd";
        }
    } catch (error) {
        console.error("❌ DID status error:", error);
        document.getElementById('didStatus').textContent = "Fout bij ophalen";
    }
}

function updateStep(stepNumber, status) {
    const step = document.getElementById(`step${stepNumber}`);
    const label = step.nextElementSibling;
    
    if (status === 'active') {
        step.classList.add('active');
        label.classList.add('active');
    } else if (status === 'completed') {
        step.classList.remove('active');
        step.classList.add('completed');
        label.classList.remove('active');
        label.classList.add('completed');
    }
}

// ========== DID FUNCTIONS ==========

// Helper function to fill DID address based on stakeholder selection
function fillDIDAddress() {
    const select = document.getElementById('didStakeholderSelect');
    const index = select.value;
    
    if (index === "") {
        document.getElementById('didAddress').value = "";
        document.getElementById('didType').value = "";
        return;
    }
    
    const account = TEST_ACCOUNTS[parseInt(index)];
    document.getElementById('didAddress').value = account.address;
    
    // Map role to DID type
    const roleMap = {
        "Boer": "farmer",
        "Transporteur": "transporter",
        "Certificeerder": "certifier",
        "Fabriek": "factory"
    };
    document.getElementById('didType').value = roleMap[account.role] || account.role.toLowerCase();
}

async function checkAllDIDs() {
    const result = document.getElementById('didStatusList');
    result.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        let html = '<div style="margin-top: 1rem;">';
        let allHaveDID = true;
        
        for (let i = 1; i <= 4; i++) {
            const account = TEST_ACCOUNTS[i];
            const hasDID = await integratedDPP.hasDID(account.address);
            
            if (hasDID) {
                const did = await integratedDPP.dids(account.address);
                html += `
                    <div class="alert alert-success" style="margin: 10px 0;">
                        <strong>✅ ${account.role}</strong><br>
                        DID: ${did.identifier}<br>
                        Type: ${did.didType}<br>
                        Address: ${account.address}
                    </div>
                `;
            } else {
                allHaveDID = false;
                html += `
                    <div class="alert alert-warning" style="margin: 10px 0;">
                        <strong>⚠️ ${account.role}</strong><br>
                        Nog geen DID geregistreerd<br>
                        Address: ${account.address}
                    </div>
                `;
            }
        }
        
        html += '</div>';
        
        if (allHaveDID) {
            html = '<div class="alert alert-success"><strong>🎉 Alle stakeholders hebben een DID!</strong> Je kunt nu verder met de supply chain.</div>' + html;
            updateStep(1, 'completed');
        } else {
            html = '<div class="alert alert-info"><strong>📋 Nog niet iedereen heeft een DID.</strong> Registreer eerst alle stakeholders.</div>' + html;
        }
        
        result.innerHTML = html;
    } catch (error) {
        console.error("❌ Check DIDs error:", error);
        showError(result, "Fout bij ophalen DID status");
    }
}

async function registerDID() {
    const result = document.getElementById('didResult');
    result.innerHTML = '<div class="loading"><div class="spinner"></div><p>DID registreren...</p></div>';
    
    try {
        const address = document.getElementById('didAddress').value;
        const publicKey = document.getElementById('didPublicKey').value;
        const didType = document.getElementById('didType').value;
        
        if (!address || !didType) {
            throw new Error("Selecteer eerst een stakeholder!");
        }
        
        const tx = await integratedDPP.registerDID(address, publicKey, didType);
        showInfo(result, `Transaction sent: ${tx.hash}`);
        
        const receipt = await tx.wait();
        
        // Extract DID from event
        const event = receipt.logs.find(log => {
            try {
                const parsed = integratedDPP.interface.parseLog(log);
                return parsed.name === 'DIDRegistered';
            } catch { return false; }
        });
        
        let didIdentifier = "Unknown";
        if (event) {
            const parsed = integratedDPP.interface.parseLog(event);
            didIdentifier = parsed.args.identifier;
        }
        
        showSuccess(result, `✅ DID geregistreerd!<br>DID: ${didIdentifier}<br>Type: ${didType}<br>Address: ${address}`);
        await updateDIDStatus();
        await checkAllDIDs();
    } catch (error) {
        console.error("❌ Register DID error:", error);
        showError(result, error.message || "Fout bij registreren DID");
    }
}

// ========== VC FUNCTIONS ==========

async function issueVC() {
    const result = document.getElementById('vcResult');
    result.innerHTML = '<div class="loading"><div class="spinner"></div><p>VC uitgeven...</p></div>';
    
    try {
        const subject = document.getElementById('vcSubject').value;
        const credentialType = document.getElementById('vcType').value;
        const data = document.getElementById('vcData').value;
        const validity = document.getElementById('vcValidity').value;
        
        if (!subject || !data || !validity) {
            throw new Error("Alle velden zijn verplicht!");
        }
        
        const tx = await integratedDPP.issueCredential(subject, credentialType, data, validity);
        showInfo(result, `Transaction sent: ${tx.hash}`);
        
        const receipt = await tx.wait();
        
        // Extract VC ID from event
        const event = receipt.logs.find(log => {
            try {
                const parsed = integratedDPP.interface.parseLog(log);
                return parsed.name === 'VCIssued';
            } catch { return false; }
        });
        
        let vcId = "Unknown";
        if (event) {
            const parsed = integratedDPP.interface.parseLog(event);
            vcId = parsed.args.vcId.toString();
        }
        
        showSuccess(result, `✅ Verifiable Credential uitgegeven!<br>VC ID: ${vcId}<br>Type: ${credentialType}<br>Subject: ${subject}`);
        updateStep(2, 'completed');
    } catch (error) {
        console.error("❌ Issue VC error:", error);
        showError(result, error.message || "Fout bij uitgeven VC");
    }
}

// ========== BATCH FUNCTIONS ==========

async function createBatch() {
    const result = document.getElementById('batchResult');
    result.innerHTML = '<div class="loading"><div class="spinner"></div><p>Batch aanmaken...</p></div>';
    
    try {
        const weightInput = document.getElementById('batchWeight');
        const originInput = document.getElementById('batchOrigin');
        
        if (!weightInput || !originInput) {
            throw new Error("Pagina niet correct geladen. Druk op Ctrl+Shift+R om te herladen!");
        }
        
        const weight = weightInput.value;
        const origin = originInput.value;
        
        // Generate random quality between 60-100
        const quality = Math.floor(Math.random() * 41) + 60; // 60 to 100
        
        if (!weight || !origin) {
            throw new Error("Gewicht en herkomst zijn verplicht!");
        }
        
        const tx = await integratedDPP.createBatch(weight, quality, origin);
        showInfo(result, `Transaction sent: ${tx.hash}<br>Kwaliteit (random): ${quality}/100`);
        
        const receipt = await tx.wait();
        
        // Extract batch ID from event
        const event = receipt.logs.find(log => {
            try {
                const parsed = integratedDPP.interface.parseLog(log);
                return parsed.name === 'BatchCreated';
            } catch { return false; }
        });
        
        let batchId = "Unknown";
        if (event) {
            const parsed = integratedDPP.interface.parseLog(event);
            batchId = parsed.args.batchId.toString();
        }
        
        showSuccess(result, `✅ Batch succesvol aangemaakt!<br>Batch ID: ${batchId}<br>Gewicht: ${weight} kg<br>Kwaliteit: ${quality}/100 (random)<br><br><a href="dpp-viewer.html?batch=${batchId}" target="_blank" class="button button-success" style="text-decoration: none; display: inline-block; width: auto; padding: 12px 24px; margin-top: 10px;">📱 View Digital Product Passport</a>`);
        updateStep(2, 'completed');
        await loadMyBatches();
    } catch (error) {
        console.error("❌ Create batch error:", error);
        showError(result, error.message || "Fout bij aanmaken batch");
    }
}

async function loadMyBatches() {
    const result = document.getElementById('myBatches');
    result.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const batchIds = await integratedDPP.getFarmerBatches(currentAccount);
        
        if (batchIds.length === 0) {
            result.innerHTML = '<div class="alert alert-info">Geen batches gevonden voor dit account.</div>';
            return;
        }
        
        const statusNames = ['Created', 'Verified', 'InTransit', 'QualityChecked', 'Delivered', 'Completed'];
        const statusClasses = ['status-created', 'status-verified', 'status-transit', 'status-checked', 'status-delivered', 'status-completed'];
        
        let html = '';
        for (const id of batchIds) {
            const batch = await integratedDPP.getBatch(id);
            const date = new Date(Number(batch.createdAt) * 1000).toLocaleString('nl-NL');
            const statusClass = statusClasses[batch.status];
            
            html += `
                <div class="batch-item" onclick="viewBatchDetails(${id})">
                    <strong>Batch #${id.toString()}</strong> 
                    <span class="status-badge ${statusClass}">${statusNames[batch.status]}</span><br>
                    Gewicht: ${batch.weight.toString()} kg | Kwaliteit: ${batch.quality.toString()}/100<br>
                    Herkomst: ${batch.origin} | Aangemaakt: ${date}<br>
                    <a href="dpp-viewer.html?batch=${id}" target="_blank" class="button button-success" style="text-decoration: none; display: inline-block; width: auto; padding: 8px 16px; margin-top: 8px; font-size: 13px;" onclick="event.stopPropagation();">📱 View DPP</a>
                </div>
            `;
        }
        
        result.innerHTML = html;
    } catch (error) {
        console.error("❌ Load batches error:", error);
        showError(result, "Fout bij laden batches");
    }
}

// ========== IOT FUNCTIONS ==========

async function addIoTData() {
    const result = document.getElementById('iotResult');
    result.innerHTML = '<div class="loading"><div class="spinner"></div><p>IoT data toevoegen (10-15 random records)...</p></div>';
    
    try {
        const batchId = document.getElementById('iotBatchId').value;
        
        if (!batchId) {
            throw new Error("Batch ID is verplicht!");
        }
        
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
            
            const tx = await integratedDPP.addIoTData(batchId, temp, humidity, location);
            await tx.wait();
            recordsAdded++;
            
            showInfo(result, `📡 Record ${recordsAdded}/${numRecords}: ${temp}°C, ${humidity}%, ${location}`);
        }
        
        showSuccess(result, `✅ ${numRecords} IoT records succesvol toegevoegd aan Batch #${batchId}!<br>🌡️ Temp: 15-35°C | 💧 Humidity: 40-80% | 📍 Verschillende locaties`);
        updateStep(3, 'completed');
    } catch (error) {
        console.error("❌ Add IoT data error:", error);
        showError(result, error.message || "Fout bij toevoegen IoT data");
    }
}

// ========== BATCH TRACKING FUNCTION ==========

async function trackBatch() {
    const result = document.getElementById('trackResult');
    result.innerHTML = '<div class="loading"><div class="spinner"></div><p>Batch tracking...</p></div>';
    
    try {
        const batchId = document.getElementById('trackBatchId').value;
        
        if (!batchId) {
            throw new Error("Batch ID is verplicht!");
        }
        
        // Get batch info
        const batch = await integratedDPP.getBatch(batchId);
        const iotCount = await integratedDPP.getIoTDataCount(batchId);
        
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
            const tx = await integratedDPP.addBatchIoTData(batchId, temperatures, humidities, locations);
            await tx.wait();
            
            // Refresh count
            const newIotCount = await integratedDPP.getIoTDataCount(batchId);
            showInfo(result, `✅ ${newIotCount} IoT records toegevoegd in 1 transactie!`);
        }
        
        // Display batch info with IoT data
        const finalIotCount = await integratedDPP.getIoTDataCount(batchId);
        
        let html = `
            <div class="alert alert-info" style="margin-top: 1rem;">
                <strong>📦 Batch #${batchId}</strong><br>
                👨‍🌾 Boer: ${batch.farmer}<br>
                ⚖️ Gewicht: ${batch.weight} kg<br>
                ⭐ Kwaliteit: ${batch.quality}/100<br>
                📍 Herkomst: ${batch.origin}<br>
                📊 Status: ${statusNames[batch.status]}<br>
                📡 IoT Records: ${finalIotCount}<br><br>
                <a href="dpp-viewer.html?batch=${batchId}" target="_blank" class="button button-success" style="text-decoration: none; display: inline-block; width: auto; padding: 10px 20px; font-size: 14px;">📱 View Digital Product Passport</a>
            </div>
            <h3 style="margin-top: 1.5rem;">🌡️ IoT Sensor Data:</h3>
        `;
        
        if (finalIotCount > 0) {
            for (let i = 0; i < finalIotCount; i++) {
                const iot = await integratedDPP.getIoTData(batchId, i);
                const timestamp = new Date(Number(iot.timestamp) * 1000).toLocaleString('nl-NL');
                
                html += `
                    <div class="batch-item" style="margin: 10px 0;">
                        <strong>📡 Record #${i + 1}</strong><br>
                        🌡️ ${iot.temperature}°C | 💧 ${iot.humidity}% | 📍 ${iot.location}<br>
                        📅 ${timestamp}
                    </div>
                `;
            }
        }
        
        result.innerHTML = html;
        updateStep(3, 'completed');
    } catch (error) {
        console.error("❌ Track batch error:", error);
        showError(result, error.message || "Fout bij tracken batch");
    }
}

// ========== BATCH STATUS FUNCTION ==========

async function updateBatchStatus() {
    const result = document.getElementById('qualityResult');
    result.innerHTML = '<div class="loading"><div class="spinner"></div><p>Batch status updaten...</p></div>';
    
    try {
        const batchId = document.getElementById('qualityBatchId').value;
        const status = document.getElementById('batchStatus').value;
        
        if (!batchId || !status) {
            throw new Error("Alle velden zijn verplicht!");
        }
        
        const tx = await integratedDPP.updateBatchStatus(batchId, status);
        showInfo(result, `Transaction sent: ${tx.hash}`);
        
        await tx.wait();
        
        const statusNames = ['Created', 'Verified', 'InTransit', 'QualityChecked', 'Delivered', 'Completed'];
        showSuccess(result, `✅ Batch status geüpdatet!<br>Batch #${batchId} → ${statusNames[status]}`);
        updateStep(4, 'completed');
    } catch (error) {
        console.error("❌ Update status error:", error);
        showError(result, error.message || "Fout bij updaten status");
    }
}

// ========== PAYMENT FUNCTIONS ==========

async function getUSDTFromFaucet() {
    const result = document.getElementById('paymentResult');
    result.innerHTML = '<div class="loading"><div class="spinner"></div><p>USDT ophalen van faucet...</p></div>';
    
    try {
        const tx = await usdt.faucet();
        showInfo(result, `Transaction sent: ${tx.hash}`);
        
        await tx.wait();
        showSuccess(result, `✅ 1000 USDT ontvangen van faucet!`);
        await updateBalances();
    } catch (error) {
        console.error("❌ Faucet error:", error);
        showError(result, error.message || "Fout bij ophalen USDT. Misschien heb je al genoeg?");
    }
}

async function payForBatch() {
    const result = document.getElementById('paymentResult');
    result.innerHTML = '<div class="loading"><div class="spinner"></div><p>Betaling verwerken...</p></div>';
    
    try {
        const batchId = document.getElementById('paymentBatchId').value;
        const to = document.getElementById('paymentTo').value;
        const amount = document.getElementById('paymentAmount').value;
        const reason = document.getElementById('paymentReason').value;
        
        if (!batchId || !to || !amount) {
            throw new Error("Alle velden zijn verplicht!");
        }
        
        // USDT has 6 decimals
        const amountWei = ethers.parseUnits(amount, 6);
        
        // First approve
        showInfo(result, `Stap 1: USDT goedkeuren...`);
        const approveTx = await usdt.approve(CONTRACTS.IntegratedCottonDPP, amountWei);
        await approveTx.wait();
        
        // Then pay
        showInfo(result, `Stap 2: Betaling uitvoeren...`);
        const tx = await integratedDPP.payForBatch(batchId, to, amountWei, reason);
        showInfo(result, `Transaction sent: ${tx.hash}`);
        
        await tx.wait();
        showSuccess(result, `✅ Betaling succesvol!<br>Bedrag: ${amount} USDT<br>Aan: ${to}<br>Reden: ${reason}`);
        await updateBalances();
        updateStep(5, 'completed');
    } catch (error) {
        console.error("❌ Payment error:", error);
        showError(result, error.message || "Fout bij betaling");
    }
}

async function payQualityBonus() {
    const result = document.getElementById('paymentResult');
    result.innerHTML = '<div class="loading"><div class="spinner"></div><p>Bonus berekenen en uitbetalen...</p></div>';
    
    try {
        const batchId = document.getElementById('bonusBatchId').value;
        
        if (!batchId) {
            throw new Error("Batch ID is verplicht!");
        }
        
        // Get batch to calculate bonus
        const batch = await integratedDPP.getBatch(batchId);
        const baseAmount = Number(batch.weight) * 10; // 10 USDT per kg
        let bonusPerc = 0;
        
        if (batch.quality >= 90) bonusPerc = 30;
        else if (batch.quality >= 70) bonusPerc = 15;
        
        const totalAmount = baseAmount + (baseAmount * bonusPerc / 100);
        const amountWei = ethers.parseUnits(totalAmount.toString(), 6);
        
        // Approve
        showInfo(result, `Stap 1: USDT goedkeuren (${totalAmount.toFixed(2)} USDT)...`);
        const approveTx = await usdt.approve(CONTRACTS.IntegratedCottonDPP, amountWei);
        await approveTx.wait();
        
        // Pay bonus
        showInfo(result, `Stap 2: Bonus uitbetalen...`);
        const tx = await integratedDPP.payQualityBonus(batchId);
        showInfo(result, `Transaction sent: ${tx.hash}`);
        
        await tx.wait();
        showSuccess(result, `✅ Kwaliteitsbonus uitbetaald!<br>Basis: ${baseAmount} USDT<br>Kwaliteit: ${batch.quality}/100<br>Bonus: +${bonusPerc}%<br>Totaal: ${totalAmount.toFixed(2)} USDT`);
        await updateBalances();
        updateStep(5, 'completed');
    } catch (error) {
        console.error("❌ Quality bonus error:", error);
        showError(result, error.message || "Fout bij uitbetalen bonus");
    }
}

// ========== TRACKING FUNCTIONS ==========

async function trackBatch() {
    const result = document.getElementById('trackResult');
    result.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const batchId = document.getElementById('trackBatchId').value;
        
        if (!batchId) {
            throw new Error("Batch ID is verplicht!");
        }
        
        const batch = await integratedDPP.getBatch(batchId);
        const iotCount = await integratedDPP.getIoTDataCount(batchId);
        const payments = await integratedDPP.getBatchPayments(batchId);
        
        const statusNames = ['Created', 'Verified', 'InTransit', 'QualityChecked', 'Delivered', 'Completed'];
        
        let html = `
            <h3 style="margin-top: 1.5rem;">📦 Batch Informatie</h3>
            <div class="info-grid">
                <div class="info-item"><strong>Batch ID</strong><span>${batchId}</span></div>
                <div class="info-item"><strong>Boer</strong><span>${batch.farmer}</span></div>
                <div class="info-item"><strong>Gewicht</strong><span>${batch.weight.toString()} kg</span></div>
                <div class="info-item"><strong>Kwaliteit</strong><span>${batch.quality.toString()}/100</span></div>
                <div class="info-item"><strong>Herkomst</strong><span>${batch.origin}</span></div>
                <div class="info-item"><strong>Status</strong><span>${statusNames[batch.status]}</span></div>
                <div class="info-item"><strong>Aangemaakt</strong><span>${new Date(Number(batch.createdAt) * 1000).toLocaleString('nl-NL')}</span></div>
                <div class="info-item"><strong>VCs</strong><span>${batch.vcIds.length} credentials</span></div>
            </div>
        `;
        
        // IoT Data
        html += `<h3 style="margin-top: 1.5rem;">📊 IoT Sensor Data (${iotCount.toString()} records)</h3>`;
        if (iotCount > 0) {
            for (let i = 0; i < iotCount; i++) {
                const iot = await integratedDPP.getIoTData(batchId, i);
                const timestamp = new Date(Number(iot.timestamp) * 1000).toLocaleString('nl-NL');
                
                html += `
                    <div class="batch-item">
                        <strong>Record #${i + 1}</strong><br>
                        🌡️ Temperatuur: ${iot.temperature.toString()}°C | 
                        💧 Luchtvochtigheid: ${iot.humidity.toString()}% | 
                        📍 Locatie: ${iot.location}<br>
                        👤 Geregistreerd door: ${iot.recorder}<br>
                        📅 ${timestamp}
                    </div>
                `;
            }
        } else {
            html += '<div class="alert alert-info">Nog geen IoT data geregistreerd.</div>';
        }
        
        // Payments
        html += `<h3 style="margin-top: 1.5rem;">💰 Betalingen (${payments.length} transacties)</h3>`;
        if (payments.length > 0) {
            for (const payment of payments) {
                const timestamp = new Date(Number(payment.timestamp) * 1000).toLocaleString('nl-NL');
                const amount = ethers.formatUnits(payment.amount, 6);
                
                html += `
                    <div class="batch-item">
                        <strong>💵 ${amount} USDT</strong><br>
                        Van: ${payment.from}<br>
                        Naar: ${payment.to}<br>
                        Reden: ${payment.reason}<br>
                        📅 ${timestamp}
                    </div>
                `;
            }
        } else {
            html += '<div class="alert alert-info">Nog geen betalingen voor deze batch.</div>';
        }
        
        result.innerHTML = html;
        updateStep(6, 'completed');
    } catch (error) {
        console.error("❌ Track batch error:", error);
        showError(result, error.message || "Fout bij tracken batch");
    }
}

async function viewBatchDetails(batchId) {
    document.getElementById('trackBatchId').value = batchId;
    await trackBatch();
    document.getElementById('trackBatchId').scrollIntoView({ behavior: 'smooth' });
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

console.log("✅ Integrated app loaded!");
console.log("📋 Contract addresses:", CONTRACTS);

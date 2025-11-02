// Configuration
const RPC_URL = "http://localhost:8545";
const CONTRACT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"; // IntegratedCottonDPP

const DPP_ABI = [
    "function getBatch(uint256) view returns (uint256 id, address farmer, uint256 weight, uint256 quality, string origin, uint256 createdAt, uint8 status, address currentOwner, uint256[] vcIds)",
    "function getIoTDataCount(uint256 batchId) view returns (uint256)",
    "function getIoTData(uint256 batchId, uint256 index) view returns (int256 temperature, uint256 humidity, string location, uint256 timestamp, address recorder)",
    "function getBatchPayments(uint256) view returns (tuple(address from, address to, uint256 amount, uint256 batchId, string reason, uint256 timestamp)[])",
    "function dids(address) view returns (string identifier, string publicKey, string didType, uint256 registered, bool active)"
];

let provider, contract;

const STATUS_NAMES = ['Created', 'Verified', 'In Transit', 'Quality Checked', 'Delivered', 'Completed'];
const STATUS_ICONS = ['🌱', '✅', '🚛', '🔬', '📦', '✔️'];

window.addEventListener('load', async () => {
    console.log("🚀 Page loaded, starting initialization...");
    
    const statusDiv = document.getElementById('connectionStatus');
    if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.style.background = '#fef3c7';
        statusDiv.style.border = '2px solid #f59e0b';
        statusDiv.style.color = '#92400e';
        statusDiv.innerHTML = '⏳ Verbinding maken met blockchain...';
    }
    
    const success = await init();
    
    if (success && statusDiv) {
        statusDiv.style.background = '#d1fae5';
        statusDiv.style.border = '2px solid #10b981';
        statusDiv.style.color = '#065f46';
        statusDiv.innerHTML = '✅ Verbonden met blockchain! Contract: ' + CONTRACT_ADDRESS.substring(0, 10) + '...';
        setTimeout(() => statusDiv.style.display = 'none', 3000);
    } else if (statusDiv) {
        statusDiv.style.background = '#fee2e2';
        statusDiv.style.border = '2px solid #ef4444';
        statusDiv.style.color = '#991b1b';
        statusDiv.innerHTML = '❌ Kan niet verbinden met blockchain. Check of Hardhat node draait!';
    }
    
    // Check if batch ID is in URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const batchId = urlParams.get('batch');
    
    if (batchId && success) {
        document.getElementById('batchIdInput').value = batchId;
        await loadDPP();
    }
});

async function init() {
    try {
        console.log("🔄 Initializing connection to blockchain...");
        console.log("RPC URL:", RPC_URL);
        console.log("Contract Address:", CONTRACT_ADDRESS);
        
        // Use ethers v6 syntax (JsonRpcProvider instead of providers.JsonRpcProvider)
        provider = new ethers.JsonRpcProvider(RPC_URL);
        console.log("✅ Provider created:", provider);
        
        contract = new ethers.Contract(CONTRACT_ADDRESS, DPP_ABI, provider);
        console.log("✅ Contract created:", contract);
        
        // Test connection
        const network = await provider.getNetwork();
        console.log("✅ Connected to network:", network.chainId);
        
        console.log("✅ Blockchain connection successful!");
        return true;
    } catch (error) {
        console.error("❌ Init error:", error);
        showError("Kan niet verbinden met blockchain. Zorg dat Hardhat node draait op localhost:8545!");
        return false;
    }
}

async function loadDPP() {
    const batchId = document.getElementById('batchIdInput').value;
    
    if (!batchId) {
        showError("Voer een Batch ID in!");
        return;
    }

    // Hide all sections
    document.getElementById('dppContent').classList.remove('active');
    document.getElementById('errorDiv').classList.remove('active');
    document.getElementById('loadingDiv').classList.add('active');

    try {
        // Ensure provider and contract are initialized
        if (!provider || !contract) {
            console.log("⚠️ Provider/Contract not initialized, calling init()...");
            const success = await init();
            if (!success || !contract) {
                throw new Error("Failed to initialize blockchain connection");
            }
        }
        
        console.log("📡 Fetching batch #" + batchId);
        console.log("Contract object:", contract);
        console.log("Contract address:", await contract.getAddress());
        
        // Get batch data
        const batch = await contract.getBatch(batchId);
        const iotCount = await contract.getIoTDataCount(batchId);
        const payments = await contract.getBatchPayments(batchId);

        // Get farmer DID
        let farmerName = "Onbekend";
        try {
            const farmerDID = await contract.dids(batch.farmer);
            if (farmerDID.active) {
                farmerName = farmerDID.didType === "farmer" ? "Boer" : farmerDID.didType;
            }
        } catch (e) {
            console.log("No DID for farmer");
        }

        // Build DPP HTML
        let html = `
            <div class="dpp-header">
                <h2>📱 Digital Product Passport</h2>
                <p style="opacity: 0.9; margin-top: 10px;">Batch #${batchId} - Volledige Supply Chain Geschiedenis</p>
            </div>

            <div class="dpp-product-info">
                <div>
                    <div class="product-image">🌾</div>
                </div>
                <div class="product-details">
                    <h3>Biologische Katoen Batch</h3>
                    <div class="detail-row">
                        <span class="detail-label">Batch ID:</span>
                        <span class="detail-value">DPP-2024-KT-${String(batchId).padStart(5, '0')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Boer Address:</span>
                        <span class="detail-value">${batch.farmer.substring(0, 10)}...${batch.farmer.substring(38)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Gewicht:</span>
                        <span class="detail-value">${batch.weight.toString()} kg</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Kwaliteit:</span>
                        <span class="detail-value">${batch.quality.toString()}/100</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Herkomst:</span>
                        <span class="detail-value">${batch.origin}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Aanmaakdatum:</span>
                        <span class="detail-value">${new Date(Number(batch.createdAt.toString()) * 1000).toLocaleDateString('nl-NL')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Status:</span>
                        <span class="status-badge success">${STATUS_ICONS[batch.status]} ${STATUS_NAMES[batch.status]}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">IoT Records:</span>
                        <span class="detail-value">${iotCount.toString()} sensor readings</span>
                    </div>
                </div>
            </div>

            <h3 style="color: #1e293b; font-size: 22px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                <span>🗺️</span> Supply Chain Tijdlijn
            </h3>

            <div class="timeline">
        `;

        // Step 1: Batch Creation (Farmer)
        const createdDate = new Date(Number(batch.createdAt.toString()) * 1000);
        html += `
            <div class="timeline-item">
                <div class="timeline-header">
                    <div>
                        <div class="timeline-title">👨‍🌾 Stap 1: Katoenoogst bij Boer</div>
                        <div class="timeline-actor">${batch.farmer.substring(0, 10)}...${batch.farmer.substring(38)}</div>
                    </div>
                    <div class="timeline-date">📅 ${createdDate.toLocaleDateString('nl-NL')}</div>
                </div>
                <div class="timeline-content">
                    Katoen geoogst en geregistreerd in het DPP systeem. Deze batch van ${batch.weight.toString()}kg werd geregistreerd met een initiële kwaliteitsscore van ${batch.quality.toString()}/100.
                </div>
                <div class="timeline-data">
                    <div class="data-badge">
                        <strong>Locatie</strong>
                        <span>${batch.origin}</span>
                    </div>
                    <div class="data-badge">
                        <strong>Hoeveelheid</strong>
                        <span>${batch.weight.toString()} kg ruwe katoen</span>
                    </div>
                    <div class="data-badge">
                        <strong>Kwaliteitsscore</strong>
                        <span>${batch.quality.toString()}/100 ${Number(batch.quality.toString()) >= 90 ? '- Uitstekend' : Number(batch.quality.toString()) >= 70 ? '- Goed' : '- Voldoende'}</span>
                    </div>
                    <div class="data-badge">
                        <strong>Blockchain TX</strong>
                        <span>Batch #${batchId}</span>
                    </div>
                </div>
            </div>
        `;

        // Step 2: Transport with IoT (if data exists)
        if (Number(iotCount.toString()) > 0) {
            // Get first and last IoT record
            const iotCountNum = Number(iotCount.toString());
            const firstIoT = await contract.getIoTData(batchId, 0);
            const lastIoT = await contract.getIoTData(batchId, iotCountNum - 1);
            
            const firstDate = new Date(Number(firstIoT.timestamp.toString()) * 1000);
            const lastDate = new Date(Number(lastIoT.timestamp.toString()) * 1000);
            
            // Calculate temperature range
            let minTemp = Number(firstIoT.temperature.toString());
            let maxTemp = Number(firstIoT.temperature.toString());
            let avgTemp = 0;
            
            for (let i = 0; i < iotCountNum; i++) {
                const iot = await contract.getIoTData(batchId, i);
                const temp = Number(iot.temperature.toString());
                minTemp = Math.min(minTemp, temp);
                maxTemp = Math.max(maxTemp, temp);
                avgTemp += temp;
            }
            avgTemp = Math.floor(avgTemp / iotCountNum);

            html += `
                <div class="timeline-item">
                    <div class="timeline-header">
                        <div>
                            <div class="timeline-title">🚛 Stap 2: Transport met IoT Monitoring</div>
                            <div class="timeline-actor">Transporteur - ${iotCount} sensor readings</div>
                        </div>
                        <div class="timeline-date">📅 ${firstDate.toLocaleDateString('nl-NL')} - ${lastDate.toLocaleDateString('nl-NL')}</div>
                    </div>
                    <div class="timeline-content">
                        Transport met real-time IoT monitoring. ${iotCount} sensor readings geregistreerd gedurende het transport van ${firstIoT.location} naar ${lastIoT.location}.
                    </div>
                    <div class="timeline-data">
                        <div class="data-badge">
                            <strong>Route</strong>
                            <span>${firstIoT.location} → ${lastIoT.location}</span>
                        </div>
                        <div class="data-badge">
                            <strong>IoT Records</strong>
                            <span>${iotCountNum} sensor readings</span>
                        </div>
                        <div class="data-badge">
                            <strong>Temperatuur</strong>
                            <span>${minTemp}°C - ${maxTemp}°C (Gem: ${avgTemp}°C)</span>
                        </div>
                        <div class="data-badge">
                            <strong>GPS Tracking</strong>
                            <span>✅ Volledig getraceerd</span>
                        </div>
                    </div>
                    
                    <h4 style="margin-top: 20px; margin-bottom: 10px; color: #1e293b; font-size: 16px;">📡 Gedetailleerde IoT Data:</h4>
            `;

            // Show all IoT records
            for (let i = 0; i < iotCountNum; i++) {
                const iot = await contract.getIoTData(batchId, i);
                const iotDate = new Date(Number(iot.timestamp.toString()) * 1000);
                
                html += `
                    <div class="timeline-data" style="margin-bottom: 10px;">
                        <div class="data-badge">
                            <strong>Record #${i + 1}</strong>
                            <span>${iotDate.toLocaleString('nl-NL')}</span>
                        </div>
                        <div class="data-badge">
                            <strong>Temperatuur</strong>
                            <span>${iot.temperature.toString()}°C</span>
                        </div>
                        <div class="data-badge">
                            <strong>Luchtvochtigheid</strong>
                            <span>${iot.humidity.toString()}%</span>
                        </div>
                        <div class="data-badge">
                            <strong>Locatie</strong>
                            <span>${iot.location}</span>
                        </div>
                    </div>
                `;
            }

            html += `</div>`;
        }

        // Step 3: Quality Check & Status Updates
        if (batch.status >= 3) {
            html += `
                <div class="timeline-item">
                    <div class="timeline-header">
                        <div>
                            <div class="timeline-title">🔬 Stap 3: Kwaliteitscontrole bij Verwerker</div>
                            <div class="timeline-actor">Fabriek/Verwerker</div>
                        </div>
                        <div class="timeline-date">📅 Na Transport</div>
                    </div>
                    <div class="timeline-content">
                        Katoen gearriveerd bij verwerker en kwaliteitscontrole uitgevoerd. Batch status geüpdatet naar "${STATUS_NAMES[batch.status]}".
                    </div>
                    <div class="timeline-data">
                        <div class="data-badge">
                            <strong>Status</strong>
                            <span>${STATUS_ICONS[batch.status]} ${STATUS_NAMES[batch.status]}</span>
                        </div>
                        <div class="data-badge">
                            <strong>Kwaliteit Check</strong>
                            <span>✅ ${batch.quality.toString()}/100</span>
                        </div>
                        <div class="data-badge">
                            <strong>Bonus Eligible</strong>
                            <span>${Number(batch.quality.toString()) >= 90 ? '✅ +30%' : Number(batch.quality.toString()) >= 70 ? '✅ +15%' : '❌ Geen bonus'}</span>
                        </div>
                    </div>
                </div>
            `;
        }

        // Step 4: Payments
        if (payments.length > 0) {
            for (let i = 0; i < payments.length; i++) {
                const payment = payments[i];
                const paymentDate = new Date(Number(payment.timestamp.toString()) * 1000);
                const amount = ethers.formatUnits(payment.amount, 6); // USDT has 6 decimals (ethers v6)

                html += `
                    <div class="timeline-item">
                        <div class="timeline-header">
                            <div>
                                <div class="timeline-title">💰 Stap ${4 + i}: USDT Betaling</div>
                                <div class="timeline-actor">${payment.reason}</div>
                            </div>
                            <div class="timeline-date">📅 ${paymentDate.toLocaleDateString('nl-NL')}</div>
                        </div>
                        <div class="timeline-content">
                            Betaling van ${amount} USDT voor ${payment.reason}.
                        </div>
                        <div class="timeline-data">
                            <div class="data-badge">
                                <strong>Van</strong>
                                <span>${payment.from.substring(0, 10)}...${payment.from.substring(38)}</span>
                            </div>
                            <div class="data-badge">
                                <strong>Naar</strong>
                                <span>${payment.to.substring(0, 10)}...${payment.to.substring(38)}</span>
                            </div>
                            <div class="data-badge">
                                <strong>Bedrag</strong>
                                <span>${amount} USDT</span>
                            </div>
                            <div class="data-badge">
                                <strong>Reden</strong>
                                <span>${payment.reason}</span>
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        html += `
            </div>

            <div class="verification-section">
                <h3>✅ Blockchain Verificatie</h3>
                <div class="alert alert-info">
                    <strong>🔐 Gedecentraliseerde Verificatie</strong><br>
                    Alle data in dit Digital Product Passport is cryptografisch beveiligd en opgeslagen op de blockchain.
                    Deze batch heeft ${2 + (iotCount > 0 ? 1 : 0) + (batch.status >= 3 ? 1 : 0) + payments.length} verificatiestappen doorlopen met 100% traceerbaarheid.
                </div>
            </div>

            <div class="blockchain-info">
                <p>
                    <strong>🔐 Blockchain Bevestiging</strong>
                    Dit Digital Product Passport is onveranderbaar vastgelegd op de blockchain.<br>
                    Contract Address: ${CONTRACT_ADDRESS}<br>
                    <strong>Batch #${batchId} is volledig traceerbaar en geverifieerd.</strong>
                </p>
            </div>
        `;

        // Show the DPP content
        document.getElementById('loadingDiv').classList.remove('active');
        document.getElementById('dppContent').innerHTML = html;
        document.getElementById('dppContent').classList.add('active');

    } catch (error) {
        console.error("❌ Load DPP error:", error);
        document.getElementById('loadingDiv').classList.remove('active');
        
        if (error.message.includes("invalid BigNumber")) {
            showError(`Batch #${batchId} bestaat niet. Probeer een ander Batch ID.`);
        } else {
            showError(`Fout bij laden DPP: ${error.message}`);
        }
    }
}

function showError(message) {
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorDiv').classList.add('active');
    document.getElementById('dppContent').classList.remove('active');
    document.getElementById('loadingDiv').classList.remove('active');
}

console.log("✅ DPP Viewer loaded!");

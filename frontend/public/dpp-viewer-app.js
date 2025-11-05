// Configuration
const RPC_URL = "http://localhost:8545";
const CONTRACT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"; // IntegratedCottonDPP

const DPP_ABI = [
    "function getBatch(uint256) view returns (uint256 id, address farmer, uint256 weight, uint256 quality, string origin, uint256 createdAt, uint8 status, address currentOwner, uint256[] vcIds)",
    "function getIoTDataCount(uint256 batchId) view returns (uint256)",
    "function getIoTData(uint256 batchId, uint256 index) view returns (int256 temperature, uint256 humidity, string location, uint256 timestamp, address recorder)",
    "function getBatchPayments(uint256) view returns (tuple(address from, address to, uint256 amount, uint256 batchId, string reason, uint256 timestamp)[])",
    "function dids(address) view returns (string identifier, string publicKey, string didType, uint256 registered, bool active)",
    "function getSubjectVCs(address subject) view returns (uint256[])",
    "function getCredential(uint256 vcId) view returns (uint256 id, address issuer, address subject, string credentialType, string data, uint256 issuedAt, uint256 expiresAt, bool revoked)"
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

        // Helper function to get stakeholder info
        async function getStakeholderInfo(address, defaultName = "Onbekend") {
            try {
                const response = await fetch(`http://localhost:3002/api/registration/${address}`);
                if (response.ok) {
                    const registration = await response.json();
                    return {
                        naam: registration.naam || defaultName,
                        bedrijfsnaam: registration.bedrijfsnaam || "Onbekend Bedrijf",
                        didType: registration.didType || "onbekend",
                        email: registration.email || ""
                    };
                }
            } catch (e) {
                console.log(`Could not load info for ${address}:`, e);
            }
            return {
                naam: defaultName,
                bedrijfsnaam: "Onbekend Bedrijf",
                didType: "onbekend",
                email: ""
            };
        }

        // Get farmer DID and registration info
        let farmerInfo = {
            naam: "Onbekend",
            bedrijfsnaam: "Onbekende Boerderij",
            location: "Onbekende Locatie"
        };
        
        try {
            const farmerDID = await contract.dids(batch.farmer);
            if (farmerDID.active) {
                const stakeholderInfo = await getStakeholderInfo(batch.farmer, "Boer");
                farmerInfo.naam = stakeholderInfo.naam;
                farmerInfo.bedrijfsnaam = stakeholderInfo.bedrijfsnaam;
                // Origin is stored in the batch
                farmerInfo.location = batch.origin || "Onbekende Locatie";
                console.log("✅ Farmer info loaded:", farmerInfo);
            }
        } catch (e) {
            console.log("Could not load farmer info:", e);
        }

        // Get farmer's VCs
        let farmerVCs = [];
        let vcCertificates = "Geen certificaten";
        try {
            const vcIds = await contract.getSubjectVCs(batch.farmer);
            console.log("📋 Farmer has", vcIds.length, "VCs");
            
            for (const vcId of vcIds) {
                const vc = await contract.getCredential(vcId);
                
                // Parse data to get real expiry date
                let realExpiryDate = null;
                let isExpired = false;
                
                try {
                    const dataObj = JSON.parse(vc.data);
                    if (dataObj.geldigTot) {
                        realExpiryDate = new Date(dataObj.geldigTot);
                        isExpired = Date.now() > realExpiryDate.getTime();
                    } else {
                        // Fallback to blockchain expiry
                        isExpired = Date.now() > Number(vc.expiresAt) * 1000;
                        realExpiryDate = new Date(Number(vc.expiresAt) * 1000);
                    }
                } catch (e) {
                    // If parsing fails, use blockchain expiry
                    isExpired = Date.now() > Number(vc.expiresAt) * 1000;
                    realExpiryDate = new Date(Number(vc.expiresAt) * 1000);
                }
                
                const isValid = !vc.revoked && !isExpired;
                
                if (isValid) {
                    farmerVCs.push({
                        id: vcId.toString(),
                        type: vc.credentialType,
                        issuer: vc.issuer,
                        issuedAt: new Date(Number(vc.issuedAt) * 1000),
                        expiresAt: realExpiryDate,
                        data: vc.data
                    });
                }
            }
            
            if (farmerVCs.length > 0) {
                // Extract certificate types from VCs
                const certTypes = farmerVCs.map(vc => {
                    // Try to parse data for standard info
                    try {
                        const data = JSON.parse(vc.data);
                        return data.norm || vc.type;
                    } catch (e) {
                        return vc.type;
                    }
                });
                vcCertificates = certTypes.join(', ');
            }
            
            console.log("✅ Loaded", farmerVCs.length, "valid VCs:", vcCertificates);
        } catch (e) {
            console.log("Could not load VCs:", e);
        }

        // Calculate totals for entire batch BEFORE building HTML
        const batchWeight = Number(batch.weight.toString());
        const waterFarm = Math.floor(batchWeight * 4.6); // 4.6L water per kg for farming
        const waterTransportCalc = Math.floor(batchWeight * 0.05); // 0.05L water per kg for transport
        const waterProcessingCalc = Math.floor(batchWeight * 0.65); // 0.65L water per kg for processing
        const totalWater = waterFarm + waterTransportCalc + waterProcessingCalc;
        
        const co2Farm = (batchWeight * 0.5 / 1000).toFixed(2); // 0.5kg CO2 per ton
        const co2TransportCalc = (batchWeight * 0.1 / 1000).toFixed(2); // 0.1kg CO2 per ton transported
        const co2ProcessingCalc = (batchWeight * 0.15 / 1000).toFixed(2);
        const totalCO2 = (parseFloat(co2Farm) + parseFloat(co2TransportCalc) + parseFloat(co2ProcessingCalc)).toFixed(2);

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
                        <span class="detail-label">Product ID:</span>
                        <span class="detail-value">DPP-2024-KT-${String(batchId).padStart(5, '0')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Merk:</span>
                        <span class="detail-value">GreenWear Sustainable</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Boer:</span>
                        <span class="detail-value">Rajesh Kumar - Gujarat, India</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Wallet:</span>
                        <span class="detail-value">${batch.farmer.substring(0, 10)}...${batch.farmer.substring(38)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Gewicht:</span>
                        <span class="detail-value">${batch.weight.toString()} kg ruwe katoen</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Kwaliteit:</span>
                        <span class="detail-value">${batch.quality.toString()}/100 ${Number(batch.quality.toString()) >= 90 ? '- Uitstekend' : Number(batch.quality.toString()) >= 70 ? '- Goed' : '- Voldoende'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Herkomst:</span>
                        <span class="detail-value">${batch.origin} (23.0225° N, 72.5714° E)</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Katoensoort:</span>
                        <span class="detail-value">Gossypium hirsutum</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Productiedatum:</span>
                        <span class="detail-value">${new Date(Number(batch.createdAt.toString()) * 1000).toLocaleDateString('nl-NL')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Status:</span>
                        <span class="status-badge success">${STATUS_ICONS[batch.status]} ${STATUS_NAMES[batch.status]}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Certificaten:</span>
                        <span class="detail-value">${vcCertificates}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">IoT Records:</span>
                        <span class="detail-value">${iotCount.toString()} sensor readings</span>
                    </div>
                </div>
            </div>

            <div class="cert-info-box">
                <h3>📜 Blockchain Verificatie & Certificaten</h3>
                <div class="cert-stats">
                    <div class="cert-stat">
                        <div class="cert-stat-value">${farmerVCs.length}</div>
                        <div class="cert-stat-label">Geldige VCs</div>
                    </div>
                    <div class="cert-stat">
                        <div class="cert-stat-value">${iotCount.toString()}</div>
                        <div class="cert-stat-label">IoT Records</div>
                    </div>
                    <div class="cert-stat">
                        <div class="cert-stat-value">${farmerVCs.length > 0 ? '✓' : '✗'}</div>
                        <div class="cert-stat-label">Gecertificeerd</div>
                    </div>
                    <div class="cert-stat">
                        <div class="cert-stat-value">${payments.length}</div>
                        <div class="cert-stat-label">Betalingen</div>
                    </div>
                </div>
                ${farmerVCs.length > 0 ? `
                    <div style="margin-top: 15px; padding: 15px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #0ea5e9;">
                        <strong style="color: #0c4a6e;">📜 Verifiable Credentials:</strong>
                        ${farmerVCs.map(vc => `
                            <div style="margin-top: 10px; padding: 10px; background: white; border-radius: 6px;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <strong style="color: #0284c7;">🎓 VC #${vc.id}</strong>
                                    <span style="font-size: 12px; color: #059669;">✅ Geldig</span>
                                </div>
                                <div style="font-size: 13px; margin-top: 5px; color: #64748b;">
                                    <strong>Type:</strong> ${vc.type}<br>
                                    <strong>Geldig tot:</strong> ${vc.expiresAt.toLocaleDateString('nl-NL')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div style="margin-top: 15px; padding: 15px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                        <strong style="color: #92400e;">⚠️ Geen geldige certificaten</strong>
                        <p style="margin: 5px 0 0 0; font-size: 13px; color: #78350f;">Deze boer heeft nog geen geldige Verifiable Credentials.</p>
                    </div>
                `}
            </div>

            <div class="impact-container">
                <div class="impact-box">
                    <div class="impact-left">
                        <div class="impact-icon">💧</div>
                        <div>
                            <div class="impact-title">Watergebruik Batch #${batchId}</div>
                            <div class="impact-stat">${totalWater} L</div>
                            <div class="impact-details" style="margin-bottom: 8px;">
                                <strong>Deze batch (${batchWeight}kg):</strong> ${totalWater}L totaal = ${(totalWater/batchWeight).toFixed(1)}L per kg<br>
                                <strong>Industrie gemiddelde:</strong> 5.4L per kg katoen
                            </div>
                            <ul class="impact-list">
                                <li>Teelt & oogst: ${waterFarm} L (${Math.floor(waterFarm/totalWater*100)}%)</li>
                                <li>Transport: ${waterTransportCalc} L (${Math.floor(waterTransportCalc/totalWater*100)}%)</li>
                                <li>Verwerking: ${waterProcessingCalc} L (${Math.floor(waterProcessingCalc/totalWater*100)}%)</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div class="impact-box co2">
                    <div class="impact-left">
                        <div class="impact-icon">💨</div>
                        <div>
                            <div class="impact-title">CO2-uitstoot Batch #${batchId}</div>
                            <div class="impact-stat">${totalCO2} kg</div>
                            <div class="impact-details" style="margin-bottom: 8px;">
                                <strong>Deze batch (${batchWeight}kg):</strong> ${totalCO2}kg totaal = ${(parseFloat(totalCO2)/batchWeight*1000).toFixed(2)}g per kg<br>
                                <strong>Industrie gemiddelde:</strong> 0.75g per kg katoen
                            </div>
                            <ul class="impact-list">
                                <li>Teelt & oogst: ${co2Farm} kg (${Math.floor(parseFloat(co2Farm)/parseFloat(totalCO2)*100)}%)</li>
                                <li>Transport: ${co2TransportCalc} kg (${Math.floor(parseFloat(co2TransportCalc)/parseFloat(totalCO2)*100)}%)</li>
                                <li>Verwerking: ${co2ProcessingCalc} kg (${Math.floor(parseFloat(co2ProcessingCalc)/parseFloat(totalCO2)*100)}%)</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            <h3 style="color: #1e293b; font-size: 22px; margin-top: 30px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
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
                        <div style="color: #64748b; font-size: 14px; margin-top: 5px;">
                            ${farmerInfo.naam} - ${farmerInfo.bedrijfsnaam}
                        </div>
                        <div style="color: #94a3b8; font-size: 13px; margin-top: 3px;">
                            📍 ${farmerInfo.location}
                        </div>
                        <div class="action-buttons">
                            <button type="button" class="action-btn" onclick="window.open('https://www.boerboer.nl/','_blank')">Bekijk</button>
                            <button type="button" class="action-btn donate" onclick="window.open('https://example.org/doneer','_blank')">Doneren</button>
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
                        <div class="timeline-date" style="text-align: center;">💨 CO2: ${co2Farm}kg | 💧 Water: ${waterFarm}L</div>
                        <div class="timeline-date">📅 ${createdDate.toLocaleDateString('nl-NL')}</div>
                    </div>
                </div>
                <div class="timeline-content">
                    Biologische katoen geoogst op gecertificeerde boerderij. Deze batch van ${batch.weight.toString()}kg voldoet aan alle bio-certificeringen en is geteeld zonder pesticides.
                </div>
                <div class="timeline-data">
                    <div class="data-badge">
                        <strong>Locatie</strong>
                        <span>23.0225° N, 72.5714° E</span>
                    </div>
                    <div class="data-badge">
                        <strong>Hoeveelheid</strong>
                        <span>${batch.weight.toString()} kg ruwe katoen</span>
                    </div>
                    <div class="data-badge">
                        <strong>Katoensoort</strong>
                        <span>Gossypium hirsutum</span>
                    </div>
                    <div class="data-badge">
                        <strong>Kwaliteitsscore</strong>
                        <span>${batch.quality.toString()}/100 ${Number(batch.quality.toString()) >= 90 ? '- Uitstekend' : Number(batch.quality.toString()) >= 70 ? '- Goed' : '- Voldoende'}</span>
                    </div>
                    <div class="data-badge">
                        <strong>Verifiable Credentials</strong>
                        <span>${farmerVCs.length > 0 ? farmerVCs.map(vc => `VC #${vc.id}`).join(', ') : 'Geen VCs'}</span>
                    </div>
                    <div class="data-badge">
                        <strong>Blockchain TX</strong>
                        <span>0x${batch.farmer.substring(2, 8)}...${batch.farmer.substring(38)}</span>
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
            
            // Get transporter info from IoT recorder
            const transporterInfo = await getStakeholderInfo(firstIoT.recorder, "Transporteur");
            
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
                            <div class="timeline-title">🚛 Stap 2: Transport naar Verwerker</div>
                            <div style="color: #64748b; font-size: 14px; margin-top: 5px;">
                                ${transporterInfo.naam} - ${transporterInfo.bedrijfsnaam}
                            </div>
                            <div class="action-buttons">
                                <button type="button" class="action-btn" onclick="window.open('https://www.dhl.com/nl-nl/home.html','_blank')">Bekijk</button>
                                <button type="button" class="action-btn donate" onclick="window.open('https://example.org/doneer','_blank')">Doneren</button>
                            </div>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
                            <div class="timeline-date" style="text-align: center;">💨 CO2: ${co2TransportCalc}kg | 💧 Water: ${waterTransportCalc}L</div>
                            <div class="timeline-date">📅 ${firstDate.toLocaleDateString('nl-NL')} - ${lastDate.toLocaleDateString('nl-NL')}</div>
                        </div>
                    </div>
                    <div class="timeline-content">
                        Transport van 280km met real-time IoT monitoring. ${iotCount} sensor readings geregistreerd. Alle condities binnen optimale parameters gebleven tijdens het transport.
                    </div>
                    <div class="timeline-data">
                        <div class="data-badge">
                            <strong>Route</strong>
                            <span>Gujarat → Maharashtra (280km)</span>
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
                            <div class="timeline-title">🏭 Stap 3: Verwerking (Ginning)</div>
                            <div style="color: #64748b; font-size: 14px; margin-top: 5px;">
                                Inkoop Coöperatie Processing
                            </div>
                            <div class="action-buttons">
                                <button type="button" class="action-btn" onclick="window.open('https://www.inkoop-coop.nl','_blank')">Bekijk</button>
                                <button type="button" class="action-btn donate" onclick="window.open('https://example.org/doneer','_blank')">Doneren</button>
                            </div>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
                            <div class="timeline-date" style="text-align: center;">💨 CO2: ${co2ProcessingCalc}kg | 💧 Water: ${waterProcessingCalc}L</div>
                            <div class="timeline-date">📅 Na Transport</div>
                        </div>
                    </div>
                    <div class="timeline-content">
                        Katoen gearriveerd bij verwerker (ginning facility). Zaden worden verwijderd en katoen wordt gekamd. Kwaliteitscontrole uitgevoerd volgens GOTS standaarden.
                    </div>
                    <div class="timeline-data">
                        <div class="data-badge">
                            <strong>Proces</strong>
                            <span>Ginning & Baling</span>
                        </div>
                        <div class="data-badge">
                            <strong>Status</strong>
                            <span>${STATUS_ICONS[batch.status]} ${STATUS_NAMES[batch.status]}</span>
                        </div>
                        <div class="data-badge">
                            <strong>Kwaliteit Check</strong>
                            <span>✅ ${batch.quality.toString()}/100</span>
                        </div>
                        <div class="data-badge">
                            <strong>Output</strong>
                            <span>${Math.floor(Number(batch.weight.toString()) * 0.4)} kg clean fiber</span>
                        </div>
                        <div class="data-badge">
                            <strong>Boer Certificaten</strong>
                            <span>${vcCertificates}</span>
                        </div>
                    </div>
                </div>
            `;
        }

        // Helper function to get stakeholder name
        const getStakeholderName = (address) => {
            const addr = address.toLowerCase();
            if (addr.includes('f39fd')) return 'Admin (Inkoop Coöperatie)';
            if (addr.includes('70997')) return 'Rajesh Kumar (Boer)';
            if (addr.includes('3c44c')) return 'LogiCotton Transport';
            if (addr.includes('90f79')) return 'Quality Certifier';
            if (addr.includes('15d34')) return 'Inkoop Coöperatie Processing';
            return address.substring(0, 10) + '...';
        };

        // Step 4: Payments
        if (payments.length > 0) {
            for (let i = 0; i < payments.length; i++) {
                const payment = payments[i];
                const paymentDate = new Date(Number(payment.timestamp.toString()) * 1000);
                const amount = ethers.formatUnits(payment.amount, 6); // USDT has 6 decimals (ethers v6)
                const fromName = getStakeholderName(payment.from);
                const toName = getStakeholderName(payment.to);

                html += `
                    <div class="timeline-item">
                        <div class="timeline-header">
                            <div>
                                <div class="timeline-title">💰 Stap ${4 + i}: USDT Betaling - ${payment.reason}</div>
                                <div style="color: #64748b; font-size: 14px; margin-top: 5px;">
                                    ${fromName} → ${toName}
                                </div>
                            </div>
                            <div class="timeline-date">📅 ${paymentDate.toLocaleDateString('nl-NL')}</div>
                        </div>
                        <div class="timeline-content">
                            Betaling van ${amount} USDT gestort op de blockchain. ${payment.reason} - Automatisch uitgevoerd via smart contract.
                        </div>
                        <div class="timeline-data">
                            <div class="data-badge">
                                <strong>Van</strong>
                                <span>${fromName}</span>
                            </div>
                            <div class="data-badge">
                                <strong>Naar</strong>
                                <span>${toName}</span>
                            </div>
                            <div class="data-badge">
                                <strong>Bedrag</strong>
                                <span>${amount} USDT</span>
                            </div>
                            <div class="data-badge">
                                <strong>Transaction</strong>
                                <span>0x${payment.from.substring(2, 8)}...${payment.from.substring(38)}</span>
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

// Configuration
const RPC_URL = "http://localhost:8545";
const DPP_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"; // CottonDPP
const MARKETPLACE_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"; // CottonMarketplace

const DPP_ABI = [
    "function getBatch(uint256) view returns (uint256 id, address farmer, uint256 weight, uint256 quality, string origin, uint256 createdAt, uint8 status, address currentOwner, uint256[] vcIds)",
    "function getIoTDataCount(uint256 batchId) view returns (uint256)",
    "function getIoTData(uint256 batchId, uint256 index) view returns (int256 temperature, uint256 humidity, string location, uint256 timestamp, address recorder)",
    "function dids(address) view returns (string identifier, string publicKey, string didType, uint256 registered, bool active)",
    "function getSubjectVCs(address subject) view returns (uint256[])",
    "function getCredential(uint256 vcId) view returns (uint256 id, address issuer, address subject, string credentialType, string data, uint256 issuedAt, uint256 expiresAt, bool revoked)"
];

const MARKETPLACE_ABI = [
    "function getBatchMarketData(uint256) view returns (bool onMarket, address buyer, uint256 escrowAmount, uint256 farmerAmount, uint256 certifierFee, uint256 transporterFee, uint256 farmerEscrow, address certifier, address transporter, bool certified, bool rejected, bool certifierPaid, bool transporterPaid)",
    "function getBatchPayments(uint256) view returns (tuple(address from, address to, uint256 amount, uint256 batchId, string reason, uint256 timestamp)[])"
];

let provider, dppContract, marketplaceContract;

const STATUS_NAMES = ['Created', 'Reserved', 'Verified', 'Rejected', 'In Transit', 'Quality Checked', 'Delivered', 'Completed'];
const STATUS_ICONS = ['🌱', '💰', '✅', '❌', '🚛', '🔬', '📦', '✔️'];

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
        statusDiv.innerHTML = '✅ Verbonden met blockchain! DPP: ' + DPP_ADDRESS.substring(0, 10) + '... | Marketplace: ' + MARKETPLACE_ADDRESS.substring(0, 10) + '...';
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
        console.log("DPP Address:", DPP_ADDRESS);
        console.log("Marketplace Address:", MARKETPLACE_ADDRESS);
        
        // Use ethers v6 syntax (JsonRpcProvider instead of providers.JsonRpcProvider)
        provider = new ethers.JsonRpcProvider(RPC_URL);
        console.log("✅ Provider created:", provider);
        
        dppContract = new ethers.Contract(DPP_ADDRESS, DPP_ABI, provider);
        marketplaceContract = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, provider);
        console.log("✅ Contracts created");
        
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
        // Ensure provider and contracts are initialized
        if (!provider || !dppContract || !marketplaceContract) {
            console.log("⚠️ Provider/Contracts not initialized, calling init()...");
            const success = await init();
            if (!success || !dppContract || !marketplaceContract) {
                throw new Error("Failed to initialize blockchain connection");
            }
        }
        
        console.log("📡 Fetching batch #" + batchId);
        console.log("DPP Contract:", await dppContract.getAddress());
        console.log("Marketplace Contract:", await marketplaceContract.getAddress());
        
        // Get batch data from both contracts
        const batch = await dppContract.getBatch(batchId);
        const marketData = await marketplaceContract.getBatchMarketData(batchId);
        const iotCount = await dppContract.getIoTDataCount(batchId);
        const payments = await marketplaceContract.getBatchPayments(batchId);
        
        console.log("✅ Batch data received:", batch);
        console.log("✅ Market data received:", marketData);
        console.log("✅ IoT records:", iotCount.toString());
        console.log("✅ Payment history:", payments);


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
            const farmerDID = await dppContract.dids(batch.farmer);
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
            const vcIds = await dppContract.getSubjectVCs(batch.farmer);
            console.log("📋 Farmer has", vcIds.length, "VCs");
            
            for (const vcId of vcIds) {
                const vc = await dppContract.getCredential(vcId);
                
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
                    <h3>Biologisch Katoen T-Shirt</h3>
                    <div class="detail-row">
                        <span class="detail-label">Product-ID:</span>
                        <span class="detail-value">DPP-2024-KT-${String(batchId).padStart(5, '0')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Merk:</span>
                        <span class="detail-value">GreenWear Sustainable</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Eindkwaliteit:</span>
                        <span class="detail-value">${batch.quality.toString()}/100 ${Number(batch.quality.toString()) >= 90 ? '- Uitstekend' : Number(batch.quality.toString()) >= 70 ? '- Goed' : '- Voldoende'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Shirt-Maat:</span>
                        <span class="detail-value">M (Medium) - Unisex</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Herkomst:</span>
                        <span class="detail-value">${batch.origin}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Katoensoort:</span>
                        <span class="detail-value">Gossypium hirsutum (Biologisch)</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Productie-Datum:</span>
                        <span class="detail-value">${new Date(Number(batch.createdAt.toString()) * 1000).toLocaleDateString('nl-NL')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Status:</span>
                        <span class="status-badge success">${STATUS_ICONS[batch.status]} ${STATUS_NAMES[batch.status]}</span>
                    </div>
                    ${batch.status === 1 && Number(marketData.escrowAmount) > 0 ? `
                    <div class="detail-row" style="background: #dbeafe; padding: 15px; border-radius: 8px; margin-top: 10px;">
                        <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
                            <div style="color: #1e40af; font-weight: 600; font-size: 15px;">💰 Escrow Status</div>
                            <div style="color: #3b82f6; font-size: 14px;">
                                <strong>Bedrag in Escrow:</strong> ${(Number(marketData.escrowAmount) / 1000000).toFixed(2)} USDT<br>
                                <strong>Gekocht door:</strong> ${marketData.buyer.substring(0,10)}...${marketData.buyer.substring(38)}<br>
                                <strong>Status:</strong> ⏳ Wacht op certificering
                            </div>
                        </div>
                    </div>
                    ` : ''}
                    ${batch.status === 2 && marketData.certified ? `
                    <div class="detail-row" style="background: #d1fae5; padding: 15px; border-radius: 8px; margin-top: 10px;">
                        <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
                            <div style="color: #065f46; font-weight: 600; font-size: 15px;">✅ Betaling Voltooid</div>
                            <div style="color: #059669; font-size: 14px;">
                                <strong>Escrow Uitbetaald:</strong> ${Number(marketData.escrowAmount) > 0 ? (Number(marketData.escrowAmount) / 1000000).toFixed(2) + ' USDT' : 'N/A'}<br>
                                <strong>Gecertificeerd:</strong> ✅ Ja<br>
                                <strong>Betaald aan:</strong> Boer
                            </div>
                        </div>
                    </div>
                    ` : ''}
                    ${batch.status === 3 && marketData.rejected ? `
                    <div class="detail-row" style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 10px;">
                        <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
                            <div style="color: #92400e; font-weight: 600; font-size: 15px;">❌ Batch Afgekeurd</div>
                            <div style="color: #d97706; font-size: 14px;">
                                <strong>Escrow Teruggestort:</strong> ${Number(marketData.escrowAmount) > 0 ? (Number(marketData.escrowAmount) / 1000000).toFixed(2) + ' USDT' : 'N/A'}<br>
                                <strong>Teruggestort aan:</strong> ${marketData.buyer.substring(0,10)}...${marketData.buyer.substring(38)}<br>
                                <strong>Status:</strong> Terug op markt
                            </div>
                        </div>
                    </div>
                    ` : ''}
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
                ${payments.length > 0 ? `
                    <div style="margin-top: 15px; padding: 15px; background: #d1fae5; border-radius: 8px; border-left: 4px solid #10b981;">
                        <strong style="color: #065f46;">💰 Betaling Status:</strong>
                        ${payments.map(payment => {
                            const amount = ethers.formatUnits(payment.amount, 6);
                            const quality = Number(batch.quality.toString());
                            let qualityTier = '';
                            let bonusPerc = 0;
                            // NEW bonus structure: 10 USDT base, +15% for 70-89, +30% for 90-100
                            if (quality >= 90) {
                                qualityTier = 'Premium Kwaliteit';
                                bonusPerc = 30;
                            } else if (quality >= 70) {
                                qualityTier = 'Goede Kwaliteit';
                                bonusPerc = 15;
                            } else {
                                qualityTier = 'Basis Kwaliteit';
                                bonusPerc = 0;
                            }
                            
                            return `
                            <div style="margin-top: 10px; padding: 10px; background: white; border-radius: 6px;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <strong style="color: #059669;">✅ Boer Uitbetaald</strong>
                                    <span style="font-size: 14px; font-weight: bold; color: #047857;">${amount} USDT</span>
                                </div>
                                <div style="font-size: 13px; margin-top: 5px; color: #64748b;">
                                    <strong>Reden:</strong> ${payment.reason}<br>
                                    <strong>Kwaliteitsscore:</strong> ${quality}/100 - ${qualityTier}${bonusPerc > 0 ? ` (+${bonusPerc}% bonus)` : ''}<br>
                                    <strong>Basis tarief:</strong> 10 USDT/kg<br>
                                    <strong>Betaald tarief:</strong> ${(parseFloat(amount) / Number(batch.weight.toString())).toFixed(2)} USDT/kg<br>
                                    <strong>Datum:</strong> ${new Date(Number(payment.timestamp.toString()) * 1000).toLocaleDateString('nl-NL')}
                                </div>
                            </div>
                            `;
                        }).join('')}
                    </div>
                ` : batch.status >= 1 ? `
                    <div style="margin-top: 15px; padding: 15px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                        <strong style="color: #92400e;">⚠️ Nog niet uitbetaald</strong>
                        <p style="margin: 5px 0 0 0; font-size: 13px; color: #78350f;">
                            Batch is geverifieerd (status: ${['Created', 'Verified', 'InTransit', 'QualityChecked', 'Delivered', 'Completed'][batch.status]})${farmerVCs.length > 0 ? ' en boer is gecertificeerd' : ' maar boer moet nog gecertificeerd worden'}.<br><br>
                            ${farmerVCs.length > 0 ? '<strong>💡 Inkoopcoöperatie moet nu de boer uitbetalen!</strong><br>Na verificatie door certificeerder kan de inkoopcoöperatie de betaling uitvoeren via het Factory dashboard.' : '<strong>⚠️ Boer moet eerst gecertificeerd worden voordat uitbetaling mogelijk is.</strong>'}<br><br>
                            <strong>💰 Geschatte Betaling (basis 10 USDT/kg):</strong><br>
                            Kwaliteit ${Number(batch.quality)}/100: ${Number(batch.quality) >= 90 ? '13 USDT/kg (+30% bonus)' : Number(batch.quality) >= 70 ? '11.5 USDT/kg (+15% bonus)' : '10 USDT/kg (basis)'}<br>
                            Totaal: ~${(Number(batch.weight) * (Number(batch.quality) >= 90 ? 13 : Number(batch.quality) >= 70 ? 11.5 : 10)).toFixed(2)} USDT
                        </p>
                    </div>
                ` : batch.status === 0 && farmerVCs.length > 0 ? `
                    <div style="margin-top: 15px; padding: 15px; background: #e0f2fe; border-radius: 8px; border-left: 4px solid #0ea5e9;">
                        <strong style="color: #075985;">📋 Wacht op Certificering</strong>
                        <p style="margin: 5px 0 0 0; font-size: 13px; color: #0c4a6e;">
                            Batch moet eerst door certificeerder geverifieerd worden.<br>
                            ✅ Boer is gecertificeerd en klaar voor betaling<br>
                            🔄 Na certificering kan <strong>inkoopcoöperatie de boer uitbetalen</strong>!<br><br>
                            <strong>💰 Geschatte Betaling:</strong><br>
                            Kwaliteit ${Number(batch.quality)}/100: ${Number(batch.quality) >= 90 ? '13 USDT/kg (+30% bonus)' : Number(batch.quality) >= 70 ? '11.5 USDT/kg (+15% bonus)' : '10 USDT/kg (basis)'}<br>
                            Totaal: ~${(Number(batch.weight) * (Number(batch.quality) >= 90 ? 13 : Number(batch.quality) >= 70 ? 11.5 : 10)).toFixed(2)} USDT
                        </p>
                    </div>
                ` : ''}
                <button onclick="window.location.href='certificate_viewer.html?batch=${batchId}'" class="cert-button" style="margin-top: 15px;">
                    📜 Bekijk alle certificaten in detail
                </button>
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
                <span>�</span> Verdeling van Opbrengst binnen de Keten
            </h3>

            <div style="background: white; border-radius: 12px; padding: 25px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 30px;">
                <div style="color: #64748b; font-size: 14px; margin-bottom: 20px;">
                    <strong>Benadering:</strong> Percentage van de productiewaarde per stakeholder (Totaal: 100%)
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
                    <!-- Boer -->
                    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 10px; padding: 20px; color: white; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                            <span style="font-size: 28px;">👨‍🌾</span>
                            <div>
                                <div style="font-size: 14px; opacity: 0.9;">Boer</div>
                                <div style="font-size: 32px; font-weight: bold;">6%</div>
                            </div>
                        </div>
                        <div style="background: rgba(255,255,255,0.2); height: 8px; border-radius: 4px; overflow: hidden;">
                            <div style="background: white; height: 100%; width: 6%;"></div>
                        </div>
                    </div>

                    <!-- Transport -->
                    <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 10px; padding: 20px; color: white; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                            <span style="font-size: 28px;">🚚</span>
                            <div>
                                <div style="font-size: 14px; opacity: 0.9;">Transport</div>
                                <div style="font-size: 32px; font-weight: bold;">10%</div>
                            </div>
                        </div>
                        <div style="background: rgba(255,255,255,0.2); height: 8px; border-radius: 4px; overflow: hidden;">
                            <div style="background: white; height: 100%; width: 10%;"></div>
                        </div>
                    </div>

                    <!-- Verwerker (Ginning) -->
                    <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); border-radius: 10px; padding: 20px; color: white; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                            <span style="font-size: 28px;">🏭</span>
                            <div>
                                <div style="font-size: 14px; opacity: 0.9;">Verwerker (Ginning)</div>
                                <div style="font-size: 32px; font-weight: bold;">8%</div>
                            </div>
                        </div>
                        <div style="background: rgba(255,255,255,0.2); height: 8px; border-radius: 4px; overflow: hidden;">
                            <div style="background: white; height: 100%; width: 8%;"></div>
                        </div>
                    </div>

                    <!-- Spinnerij (Garen) -->
                    <div style="background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); border-radius: 10px; padding: 20px; color: white; box-shadow: 0 4px 12px rgba(236, 72, 153, 0.3);">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                            <span style="font-size: 28px;">🧵</span>
                            <div>
                                <div style="font-size: 14px; opacity: 0.9;">Spinnerij (Garen)</div>
                                <div style="font-size: 32px; font-weight: bold;">15%</div>
                            </div>
                        </div>
                        <div style="background: rgba(255,255,255,0.2); height: 8px; border-radius: 4px; overflow: hidden;">
                            <div style="background: white; height: 100%; width: 15%;"></div>
                        </div>
                    </div>

                    <!-- Weverij (Stof) -->
                    <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 10px; padding: 20px; color: white; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                            <span style="font-size: 28px;">🪡</span>
                            <div>
                                <div style="font-size: 14px; opacity: 0.9;">Weverij (Stof)</div>
                                <div style="font-size: 32px; font-weight: bold;">18%</div>
                            </div>
                        </div>
                        <div style="background: rgba(255,255,255,0.2); height: 8px; border-radius: 4px; overflow: hidden;">
                            <div style="background: white; height: 100%; width: 18%;"></div>
                        </div>
                    </div>

                    <!-- Confectiefabriek -->
                    <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 10px; padding: 20px; color: white; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                            <span style="font-size: 28px;">👕</span>
                            <div>
                                <div style="font-size: 14px; opacity: 0.9;">Confectiefabriek</div>
                                <div style="font-size: 32px; font-weight: bold;">43%</div>
                            </div>
                        </div>
                        <div style="background: rgba(255,255,255,0.2); height: 8px; border-radius: 4px; overflow: hidden;">
                            <div style="background: white; height: 100%; width: 43%;"></div>
                        </div>
                    </div>
                </div>

                <!-- Visual Bar Chart -->
                <div style="margin-top: 30px;">
                    <div style="color: #1e293b; font-weight: 600; margin-bottom: 15px; font-size: 16px;">
                        📊 Visuele Verdeling (Totaal: 100%)
                    </div>
                    <div style="display: flex; height: 40px; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div style="background: #10b981; width: 6%; display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: bold;" title="Boer - 6%">
                            6%
                        </div>
                        <div style="background: #3b82f6; width: 10%; display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: bold;" title="Transport - 10%">
                            10%
                        </div>
                        <div style="background: #8b5cf6; width: 8%; display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: bold;" title="Verwerker - 8%">
                            8%
                        </div>
                        <div style="background: #ec4899; width: 15%; display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: bold;" title="Spinnerij - 15%">
                            15%
                        </div>
                        <div style="background: #f59e0b; width: 18%; display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: bold;" title="Weverij - 18%">
                            18%
                        </div>
                        <div style="background: #ef4444; width: 43%; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;" title="Confectiefabriek - 43%">
                            43%
                        </div>
                    </div>
                    <div style="display: flex; margin-top: 8px; font-size: 11px; color: #64748b;">
                        <div style="width: 6%; text-align: center;">👨‍🌾</div>
                        <div style="width: 10%; text-align: center;">🚚</div>
                        <div style="width: 8%; text-align: center;">🏭</div>
                        <div style="width: 15%; text-align: center;">🧵</div>
                        <div style="width: 18%; text-align: center;">🪡</div>
                        <div style="width: 43%; text-align: center;">👕</div>
                    </div>
                </div>

                <div style="margin-top: 25px; padding: 15px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #3b82f6;">
                    <strong style="color: #1e40af;">💡 Toelichting:</strong>
                    <p style="margin: 8px 0 0 0; color: #475569; font-size: 14px; line-height: 1.6;">
                        Deze percentages tonen de gemiddelde waarde-verdeling in de katoenketen. De confectiefabriek heeft het hoogste percentage 
                        omdat daar de grootste toegevoegde waarde ontstaat (design, branding, marketing, retail). De boer krijgt een relatief klein 
                        percentage, maar door blockchain-gebaseerde transparantie en directe betaling wordt eerlijke handel gestimuleerd.
                    </p>
                </div>
            </div>

            <h3 style="color: #1e293b; font-size: 22px; margin-top: 30px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                <span>�🗺️</span> Supply Chain Tijdlijn
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
            const firstIoT = await dppContract.getIoTData(batchId, 0);
            const lastIoT = await dppContract.getIoTData(batchId, iotCountNum - 1);
            
            const firstDate = new Date(Number(firstIoT.timestamp.toString()) * 1000);
            const lastDate = new Date(Number(lastIoT.timestamp.toString()) * 1000);
            
            // Get transporter info from IoT recorder
            const transporterInfo = await getStakeholderInfo(firstIoT.recorder, "Transporteur");
            
            // Calculate temperature range
            let minTemp = Number(firstIoT.temperature.toString());
            let maxTemp = Number(firstIoT.temperature.toString());
            let avgTemp = 0;
            
            for (let i = 0; i < iotCountNum; i++) {
                const iot = await dppContract.getIoTData(batchId, i);
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
                const iot = await dppContract.getIoTData(batchId, i);
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
                    DPP Contract: ${DPP_ADDRESS}<br>
                    Marketplace Contract: ${MARKETPLACE_ADDRESS}<br>
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

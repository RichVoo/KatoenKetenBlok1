# 🌾 Vertrouwen in de Katoenketen via Web3 - POC

## 📋 Overzicht
Een complete Web3-gebaseerde supply chain applicatie voor de katoenindustrie die transparantie en vertrouwen creëert van boer tot consument via blockchain technologie, IoT monitoring en smart incentive-mechanismen.

## 🎯 Kernfunctionaliteiten
- ✅ **Digital Product Passport (DPP)** - Volledige traceerbaarheid per batch
- ✅ **Automatische IoT Simulatie** - 17 meetpunten door complete supply chain
- ✅ **Role-Based Access Control** - Boer, Transporteur, Certificeerder, Fabriek
- ✅ **USDT Betalingen** - Stablecoin betalingen met kwaliteitsbonussen
- ✅ **Decentralized Identity (DID)** - Verificeerbare identiteiten voor stakeholders
- ✅ **Verifiable Credentials (VC)** - Certificeringen on-chain
- ✅ **Real-time Tracking** - Complete supply chain visibility
- ✅ **Public DPP Viewer** - Transparantie voor consumenten

## 🏗️ Technische Architectuur

### Smart Contracts (Hardhat 2.19.4)
**`IntegratedCottonDPP.sol`** - All-in-one contract met:
- DID Registry (Decentralized Identifiers)
- VC Issuance (Verifiable Credentials)
- Batch Management (Katoen batches met lifecycle)
- IoT Data Storage (Temperatuur, humidity, locatie)
- Payment System (USDT integratie met bonussen)
- Role-Based Access Control (OpenZeppelin AccessControl)

**`USDTMock.sol`** - ERC20 Stablecoin (6 decimals)
- Faucet functie voor testing
- Admin mint capabilities

### Backend (Node.js/Express)
- Minimal backend (alleen health check)
- Geen database - alles on-chain

### Frontend (Vanilla JavaScript + Ethers.js v6)
**`stakeholder.html`** - Role-based dashboards:
- 👨‍🌾 Boer: Batch aanmaken (auto quality 60-100)
- 🚛 Transporteur: IoT tracking (auto-generate 17 records)
- 🔬 Certificeerder: Verifiable Credentials uitgeven
- 🏭 Fabriek: Status updates & quality checks

**`integrated.html`** - Complete flow demonstratie

**`dpp-viewer.html`** - **Public DPP Viewer** voor consumenten:
- Zoek per Batch ID
- Visualiseer complete supply chain
- Timeline met alle transport stappen
- IoT data per locatie
- Blockchain verificatie

## 🚀 Quick Start

### Vereisten
- **Node.js** v18+ (voor Hardhat en backend)
- **Python 3** (voor frontend HTTP server)
- **PowerShell** (voor start script)

### 🎯 One-Command Setup
```powershell
.\setup.ps1
```
Dit installeert alle dependencies automatisch!

### ⚡ Start Alles in 1 Keer
```powershell
.\start.ps1
```

Dit start automatisch:
1. 🔗 **Hardhat local blockchain** (localhost:8545)
2. 📜 **Deploy contracts** (USDT + IntegratedCottonDPP)
3. 🔐 **Setup roles** (Boer, Transporteur, Certificeerder, Fabriek)
4. 💵 **Mint USDT** (100,000 naar elk account)
5. 📝 **Register DIDs** (Alle stakeholders)
6. � **DID Registration Service** (localhost:3002) - **NEW!**
7. �🖥️ **Backend server** (localhost:3001)
8. 🌐 **Frontend server** (localhost:8000)

### 🌐 Access Points

**🔐 DID Management (NEW - Verification System):**
```
http://localhost:8000/did-management.html
```

**👥 Stakeholder Dashboard (Role-based):**
```
http://localhost:8000/stakeholder.html
```

**🔄 Complete Flow Demo:**
```
http://localhost:8000/integrated.html
```

**📱 Public DPP Viewer:**
```
http://localhost:8000/dpp-viewer.html
```

**🔌 DID Service API:**
```
http://localhost:3002/health
```

## 🔧 Manual Setup (indien gewenst)

### 1. Dependencies Installeren
```bash
# Smart contracts
cd contracts
npm install

# Backend
cd ../backend
npm install
```

### 2. Lokale Blockchain Starten
```bash
cd contracts
npx hardhat node
```

### 3. Contracts Deployen
```bash
# Nieuw terminal venster
cd contracts
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/setup.js --network localhost
```

### 4. Frontend Starten
```bash
cd frontend/public
python -m http.server 8000
```

## 📊 Complete Supply Chain Flow

### 1. 👨‍🌾 Boer (Farmer)
**Selecteer rol "Boer" in stakeholder dashboard**
- Voer gewicht (kg) en herkomst in
- Klik "Maak Batch Aan"
- ✅ **Auto-generated:** Random kwaliteit (60-100)
- ✅ Batch krijgt uniek ID
- ✅ DPP wordt aangemaakt on-chain
- 💡 **View DPP** knop verschijnt

### 2. 🚛 Transporteur (Transporter)
**Selecteer rol "Transporteur" in stakeholder dashboard**
- Voer Batch ID in
- Klik "Track Batch"
- ✅ **Auto-generated:** 17 IoT records via complete route:
  - **Stage 1:** Boer → Inkoopcoöperatie (Gujarat)
  - **Stage 2:** Inkoopcoöperatie → Opslagfaciliteit (Maharashtra)
  - **Stage 3:** Opslagfaciliteit → Haven (Mumbai)
  - **Stage 4:** Zeevracht (Arabian Sea → Suez → Rotterdam)
  - **Stage 5:** Haven → Verwerker (Nederland)
- 📡 Realistische temp/humidity per locatie
- ⚡ **1 transactie** voor alle 17 records (super snel!)

### 3. 🔬 Certificeerder (Certifier)
**Selecteer rol "Certificeerder" in stakeholder dashboard**
- Selecteer stakeholder
- Kies credential type (Organic, Fair Trade, etc.)
- Voer certificaat data in (JSON)
- Klik "Geef VC Uit"
- ✅ Verifiable Credential on-chain

### 4. 🏭 Fabriek (Factory)
**Selecteer rol "Fabriek" in stakeholder dashboard**
- Voer Batch ID in
- Selecteer nieuwe status:
  - ✅ QualityChecked
  - ✅ Delivered
  - ✅ Completed
- Betaal kwaliteitsbonus aan boer
- ✅ Status update on-chain

### 5. 👥 Consument (Public)
**Open DPP Viewer (geen wallet nodig!)**
```
http://localhost:8000/dpp-viewer.html
```
- Voer Batch ID in of klik "View DPP" link
- 📱 Bekijk complete timeline:
  - Boer informatie
  - Alle 17 transport stappen
  - IoT data per locatie
  - Kwaliteitsinformatie
  - USDT betalingen
  - Blockchain verificatie
- 🔍 100% transparantie

## 🔐 Decentralized Identity (DID)

### DID Structuur
```javascript
{
  identifier: "did:cotton:0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  publicKey: "boer-public-key",
  didType: "farmer",
  registered: 1730534400,
  active: true
}
```

### Stakeholder DIDs
- 👨‍🌾 **Boer:** `did:cotton:farmer`
- 🚛 **Transporteur:** `did:cotton:transporter`
- 🔬 **Certificeerder:** `did:cotton:certifier`
- 🏭 **Fabriek:** `did:cotton:factory`

## � DID Registration Service (Verification System)

### 🎯 Overzicht
De DID Registration Service is een **aparte TypeScript service** die draait op **port 3002** en zorgt voor **geverifieerde identiteitsregistratie** via een verificatiecode-flow.

### 🏗️ Architectuur
```
did-service/
├── src/
│   ├── server.ts        # Express API server
│   └── blockchain.ts    # Wallet creation & DID generation
├── data/
│   └── registrations.json   # Persistent storage
└── package.json         # Dependencies (Express, Ethers, TypeScript)
```

### 🔄 Verification Flow

#### **Stap 1: Request Verification Code**
```javascript
POST http://localhost:3002/api/request-verification
{
  "naam": "Jan de Vries",
  "bedrijfsnaam": "Katoenfarm De Vries",
  "urn": "urn:kvk:12345678",
  "email": "jan@katoenfarm.nl",
  "telefoon": "+31612345678",
  "didType": "farmer"
}
```
**Response:**
```javascript
{
  "success": true,
  "message": "Verification code sent to email",
  "code": "123456"  // In productie: via email!
}
```

#### **Stap 2: Verify Code & Create Wallet**
```javascript
POST http://localhost:3002/api/verify-and-create-wallet
{
  "verificationCode": "123456"
}
```
**Response:**
```javascript
{
  "success": true,
  "registration": {
    "did": "did:ethr:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "privateKey": "0x...",  // Bewaar dit veilig!
    "naam": "Jan de Vries",
    "bedrijfsnaam": "Katoenfarm De Vries",
    "urn": "urn:kvk:12345678",
    "didType": "farmer",
    "verified": true,
    "timestamp": "2024-11-02T19:30:00.000Z",
    "didDocument": {
      "@context": "https://www.w3.org/ns/did/v1",
      "id": "did:ethr:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "verificationMethod": [ /* ... */ ]
    }
  }
}
```

### 🎨 Frontend Integration
**Toegang via:** `http://localhost:8000/did-management.html`

**Functionaliteit:**
1. **Register Form** - Vul gegevens in, ontvang code
2. **Verify Section** - Voer code in, krijg wallet
3. **View All DIDs** - Bekijk alle registraties
4. **Resolve DID** - Zoek DID informatie

**Frontend gebruikt:**
- DID Service API (port 3002) voor verificatie
- IntegratedCottonDPP contract voor on-chain registratie

### 🔌 API Endpoints

| Endpoint | Method | Doel |
|----------|--------|------|
| `/health` | GET | Health check |
| `/api/request-verification` | POST | Request verificatiecode |
| `/api/verify-and-create-wallet` | POST | Verify code & create wallet |
| `/api/registrations` | GET | Alle registraties (zonder private keys) |
| `/api/search?q=<query>` | GET | Zoek naar DID/URN/naam |
| `/api/resolve-did/:did` | GET | Resolve DID naar info |

### 🔒 Security Features
- ✅ **6-digit verification code** (10 min expiry)
- ✅ **URN uniqueness check** (prevent duplicates)
- ✅ **Private key generation** (secure random wallet)
- ✅ **Blockchain integration** (DID on-chain)
- ⚠️ **Note:** Email simulatie in console (prod: real SMTP)

### 🎯 Gebruik in Supply Chain
1. **Nieuwe stakeholder** registreert via did-management.html
2. **Ontvangt verificatiecode** (console of email)
3. **Verifieert en krijgt wallet** met DID
4. **Admin grant roles** via setup.js of stakeholder dashboard
5. **Stakeholder kan nu batches aanmaken** met geverifieerde identiteit

## �📜 Verifiable Credentials (VC)

### VC Types
- **OrganicCertificate** - Biologische certificering
- **FairTradeCertificate** - Fair trade certificering
- **QualityCertificate** - Kwaliteitscontrole
- **SustainabilityCertificate** - Duurzaamheid

### VC Structuur
```javascript
{
  id: 1,
  issuer: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", // Certificeerder
  subject: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Boer
  credentialType: "OrganicCertificate",
  data: '{"cert_id": "ORG-2024-001", "valid_until": "2025-12-31"}',
  issuedAt: 1730534400,
  expiresAt: 1762070400,
  revoked: false
}
```

## 💰 USDT Payment & Incentive System

### Payment Mechanisme
```javascript
// Base payment
basePayment = batchWeight * pricePerKg

// Quality bonus calculation
if (quality >= 90) {
  bonus = basePayment * 0.30  // +30%
} else if (quality >= 70) {
  bonus = basePayment * 0.15  // +15%
} else {
  bonus = 0
}

totalPayment = basePayment + bonus
```

### Kwaliteitsbonussen
| Kwaliteit | Bonus | Voorbeeld (1000 kg) |
|-----------|-------|---------------------|
| 90-100    | +30%  | 13,000 USDT        |
| 70-89     | +15%  | 11,500 USDT        |
| 60-69     | 0%    | 10,000 USDT        |
| < 60      | -20%  | 8,000 USDT         |

### Betaalreasons
- `"harvest"` - Initiële betaling voor oogst
- `"transport"` - Betaling voor transport
- `"quality_bonus"` - Extra bonus voor hoge kwaliteit

## 🔑 Test Accounts (Hardhat)

| Role           | Address                                      | Private Key |
|----------------|----------------------------------------------|-------------|
| Admin          | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | Account #0  |
| Boer           | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | Account #1  |
| Transporteur   | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | Account #2  |
| Certificeerder | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | Account #3  |
| Fabriek        | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` | Account #4  |

**Elk account start met:**
- 10,000 ETH (Hardhat)
- 100,000 USDT (via setup script)
- Correct toegewezen role
- Geregistreerde DID

## 🧪 Testing

### Smart Contract Tests
```bash
cd contracts
npx hardhat test
```

### Gas Reporter
```bash
REPORT_GAS=true npx hardhat test
```

### Coverage
```bash
npx hardhat coverage
```

## 📁 Project Structuur
```
Poc#1/
├── contracts/                    # Smart contracts
│   ├── contracts/
│   │   ├── IntegratedCottonDPP.sol  # Main contract
│   │   └── USDTMock.sol             # USDT token
│   ├── scripts/
│   │   ├── deploy.js                # Deploy script
│   │   └── setup.js                 # Setup roles & data
│   └── hardhat.config.js
├── backend/                      # Express backend
│   └── server.js                 # Health check only
├── frontend/public/              # Frontend (Vanilla JS)
│   ├── stakeholder.html          # Role-based dashboards
│   ├── stakeholder-app.js
│   ├── integrated.html           # Complete flow demo
│   ├── integrated-app.js
│   ├── dpp-viewer.html          # Public DPP viewer
│   └── dpp-viewer-app.js
├── setup.ps1                    # Setup dependencies
└── start.ps1                    # Start all services
```

## 🌍 UN Sustainable Development Goals

### SDG 12: Responsible Consumption and Production
✅ **Transparantie:** Volledige supply chain zichtbaarheid  
✅ **Kwaliteitsborging:** IoT monitoring en on-chain verificatie  
✅ **Fair Compensation:** Kwaliteitsbonussen voor boeren  
✅ **Traceerbaarheid:** Consumenten kunnen herkomst verifiëren  
✅ **Waste Reduction:** Betere kwaliteitscontrole = minder afval

### SDG 8: Decent Work and Economic Growth
✅ **Fair Payment:** Directe USDT betalingen aan boeren  
✅ **Incentives:** Hogere beloning voor betere kwaliteit  
✅ **Trust:** Transparante betalingsstructuur

### SDG 9: Industry, Innovation and Infrastructure
✅ **Blockchain:** Gedecentraliseerde infrastructuur  
✅ **IoT Integration:** Real-time monitoring  
✅ **Smart Contracts:** Geautomatiseerde processen

## 🚀 Roadmap

### ✅ MVP (Current)
- [x] IntegratedCottonDPP contract
- [x] USDT payment system
- [x] IoT simulation (17 records)
- [x] Role-based access control
- [x] DID/VC implementation
- [x] Public DPP viewer
- [x] Batch IoT function (1 transaction)

### 🔄 Phase 2 (Next)
- [ ] QR code generation per batch
- [ ] Mobile-friendly DPP viewer
- [ ] Real IoT sensor integration
- [ ] Multi-language support
- [ ] Analytics dashboard
- [ ] Export to PDF/CSV

### 🔮 Future
- [ ] Deploy to testnet (Sepolia)
- [ ] IPFS integration voor documents
- [ ] NFT badges voor certificaten
- [ ] DAO governance
- [ ] Cross-chain bridge (Polygon)

## 📝 Licentie
MIT License - zie LICENSE file

## 👥 Team
**Blockchain Minor - Cotton Supply Chain POC**  
Hogeschool Rotterdam - 2024-2025

## 🤝 Contributing
Pull requests welkom! Voor grote wijzigingen, open eerst een issue.

## 📧 Support
Vragen? Open een GitHub issue of neem contact op via de course coordinator.

---

**Made with ❤️ for a more transparent cotton industry** 🌾

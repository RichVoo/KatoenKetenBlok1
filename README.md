# 🌾 Vertrouwen in de Katoenketen via Web3 - POC

## 📋 Overzicht
Een complete Web3-gebaseerde supply chain applicatie voor de katoenindustrie die transparantie en vertrouwen creëert van boer tot consument via blockchain technologie, Decentralized Identity (DID), IoT monitoring en smart incentive-mechanismen.

## 🎯 Kernfunctionaliteiten
- ✅ **Digital Product Passport (DPP)** - Volledige traceerbaarheid per batch
- ✅ **Decentralized Identity (DID)** - Verificeerbare identiteiten met email verificatie
- ✅ **Role-Based Access Control** - 5 supply chain rollen (Farmer, Processor, Manufacturer, Retailer, Auditor)
- ✅ **Custom Wallet Import** - Gebruik je eigen geregistreerde DID wallet
- ✅ **Automatische IoT Simulatie** - 17 meetpunten door complete supply chain
- ✅ **USDT Betalingen** - Stablecoin betalingen met kwaliteitsbonussen
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

### DID Service (TypeScript/Express - Port 3002)
**Decentralized Identity Service** met:
- DID registratie met email verificatie (6-digit code, 10 min geldig)
- Wallet aanmaken (Ethereum wallet + DID document)
- On-chain DID registratie via smart contract
- Verificatie codes opgeslagen in JSON (persistent bij herstart)
- Role-based registration (farmer, processor, manufacturer, retailer, auditor)
- API endpoints:
  - `POST /api/request-verification` - Vraag verificatie code aan
  - `POST /api/verify-and-create-wallet` - Verifieer code en maak wallet
  - `POST /api/register-on-chain` - Registreer DID on-chain met nonce management
  - `GET /api/registrations` - Lijst van alle DIDs

### Frontend (Vanilla JavaScript + Ethers.js v6 - Port 8000)
**`stakeholder.html`** - Main dashboard:
- � Import custom DID wallet (private key)
- Role selection: Admin, Farmer, Transporter, Certifier, Factory, Custom DID
- Role-based dashboards met volledige supply chain functionaliteit
- Link naar DID registratie pagina

**`register.html`** - DID Registration:
- Formulier met email verificatie flow
- 6-digit verificatie code (getoond in DID service console)
- Wallet aanmaken + on-chain registratie
- Private key output (om te importeren in stakeholder.html)
- Lijst van alle geregistreerde DIDs met rol badges

**`dpp-viewer.html`** - Public DPP Viewer:
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
3. 🔐 **Setup roles** (Admin + 4 test stakeholders)
4. 🔌 **DID Service** (localhost:3002) - Email verificatie & wallet creation
5. 🌐 **Frontend server** (localhost:8000) - Python HTTP server

**⚠️ Belangrijk:** Start.ps1 moet draaien in één PowerShell venster om alle services te beheren!

### 🌐 Access Points

**👥 Main Dashboard (START HERE):**
```
http://localhost:8000/stakeholder.html
```
- Import wallet of selecteer test account
- Kies je rol en gebruik het dashboard

**🔐 DID Registratie:**
```
http://localhost:8000/register.html
```
- Nieuwe DID aanmaken met email verificatie
- Ontvang private key om te importeren

**📱 Public DPP Viewer:**
```
http://localhost:8000/dpp-viewer.html
```
- Bekijk batch informatie (publiek toegankelijk)

**🔌 DID Service API:**
```
http://localhost:3002/health
```
- Backend service voor DID registratie

## 🔧 Manual Setup (indien gewenst)

### 1. Dependencies Installeren
```powershell
# Smart contracts
cd contracts
npm install

# DID Service
cd ../did-service
npm install
```

### 2. Lokale Blockchain Starten
```powershell
cd contracts
npx hardhat node
```

### 3. Contracts Deployen
```powershell
# Nieuw terminal venster
cd contracts
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/setup.js --network localhost
```

### 4. DID Service Starten
```powershell
cd did-service
npm start
```

### 5. Frontend Starten
```powershell
cd frontend/public
python -m http.server 8000
```

## � DID Registratie Workflow

### Nieuwe DID Aanmaken:
1. **Open** `http://localhost:8000/register.html`
2. **Vul formulier in:**
   - Volledige naam
   - Bedrijfsnaam
   - URN (Udyog Registration Number)
   - Email adres (verplicht!)
   - Rol (Farmer, Processor, Manufacturer, Retailer, Auditor)
3. **Klik** "Vraag Verificatie Code Aan"
4. **Kopieer** de 6-digit code uit de DID service terminal
5. **Voer code in** en klik "Verifieer en Maak Wallet Aan"
6. **Kopieer je Private Key** (belangrijk!)
7. **Ga naar** `stakeholder.html` → "Import DID Wallet" → Plak private key
8. **Selecteer** "Custom DID" rol om je eigen wallet te gebruiken

### Features:
- ✅ Email verificatie (code geldig 10 minuten)
- ✅ Persistent opslag (codes blijven bij herstart)
- ✅ On-chain DID registratie via smart contract
- ✅ Automatische nonce management (geen nonce errors)
- ✅ Lijst van alle geregistreerde DIDs met status

## �📊 Complete Supply Chain Flow

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
├── contracts/                       # Smart contracts (Hardhat)
│   ├── contracts/
│   │   ├── IntegratedCottonDPP.sol     # Main contract (DID + VC + Batches + IoT)
│   │   └── USDTMock.sol                # USDT ERC20 token
│   ├── scripts/
│   │   ├── deploy.js                   # Deploy beide contracts
│   │   └── setup.js                    # Setup admin + test accounts
│   ├── artifacts/                      # Compiled contracts
│   ├── deployed-addresses.json         # Contract addresses
│   └── hardhat.config.js
│
├── did-service/                     # DID Registration Service (TypeScript)
│   ├── src/
│   │   ├── server.ts                   # Express API server
│   │   └── blockchain.ts               # Ethers.js wallet utils
│   ├── data/
│   │   ├── registrations.json          # DID registrations
│   │   └── verifications.json          # Verification codes
│   ├── dist/                           # Compiled JavaScript
│   └── package.json
│
├── frontend/public/                 # Frontend (Vanilla JS + Ethers.js v6)
│   ├── stakeholder.html                # Main dashboard
│   ├── stakeholder-app.js              # Dashboard logic
│   ├── register.html                   # DID registration UI
│   ├── register-app.js                 # Registration logic
│   ├── dpp-viewer.html                 # Public DPP viewer
│   └── dpp-viewer-app.js               # Viewer logic
│
├── setup.ps1                        # Install all dependencies
├── start.ps1                        # Start all services (ONE COMMAND!)
├── README.md                        # This file
└── INSTALLATION.md                  # Detailed installation guide
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

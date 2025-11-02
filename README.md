# Vertrouwen in de Katoenketen via Web3 - POC

## 📋 Overzicht
Een Web3-gebaseerde supply chain applicatie voor de katoenketen die vertrouwen versterkt via incentive-mechanismen, certificering en IoT-integratie.

## 🎯 Doel
Creëer transparantie en vertrouwen in de katoen supply chain van boer tot consument via:
- **Digitale Product Paspoorten (DPP)** op blockchain
- **IoT-monitoring** van kwaliteit tijdens transport
- **Incentive-mechanismen** via stablecoins
- **Decentralized Identifiers (DIDs)** en Verifiable Credentials (VCs)
- **QR-codes** voor consumenten inzicht

## 🏗️ Architectuur

### Smart Contracts
- `CottonDPP.sol` - Digitaal Product Paspoort voor katoen batches
- `StableCoin.sol` - ERC20 token voor betalingen en rewards
- `SupplyChain.sol` - Supply chain tracking en IoT data opslag
- `DIDRegistry.sol` - Decentralized Identity management
- `VCIssuer.sol` - Verifiable Credentials uitgifte en verificatie

### Backend (Node.js/Express)
- IoT data simulatie
- Blockchain interactie
- QR code generatie
- API endpoints voor frontend

### Frontend (React)
- MetaMask wallet integratie
- Boeren dashboard (batch creatie)
- Transport dashboard (IoT monitoring)
- Consument viewer (QR code scanner)
- Admin panel

## 🚀 Installatie

### Vereisten
- Node.js v18+
- MetaMask browser extensie
- Git

### Setup
```bash
# Clone repository
cd c:\blockchain_minor\Poc#1

# Installeer dependencies voor smart contracts
cd contracts
npm install

# Installeer dependencies voor backend
cd ../backend
npm install

# Installeer dependencies voor frontend
cd ../frontend
npm install
```

## 🔧 Configuratie

### 1. MetaMask Setup
- Installeer MetaMask
- Schakel over naar Sepolia testnet
- Vraag testnet ETH aan via Sepolia faucet

### 2. Smart Contracts Deployen
```bash
cd contracts
npx hardhat compile
npx hardhat run scripts/deploy.js --network sepolia
```

### 3. Environment Variables
Maak `.env` files aan:

**contracts/.env:**
```
PRIVATE_KEY=your_metamask_private_key
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
```

**backend/.env:**
```
PORT=3001
CONTRACT_ADDRESS_DPP=deployed_contract_address
CONTRACT_ADDRESS_STABLECOIN=deployed_contract_address
CONTRACT_ADDRESS_SUPPLYCHAIN=deployed_contract_address
PRIVATE_KEY=your_backend_private_key
RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
```

**frontend/.env:**
```
REACT_APP_API_URL=http://localhost:3001
REACT_APP_NETWORK_ID=11155111
```

## 🎮 Gebruik

### Start Backend
```bash
cd backend
npm start
```

### Start Frontend
```bash
cd frontend
npm start
```

Navigeer naar `http://localhost:3000`

## 📊 Proces Flow

1. **Boer Dashboard**
   - Klik op "Genereer Batch"
   - Systeem genereert random kwaliteit (1-100)
   - DPP wordt aangemaakt op blockchain

2. **Transport Fase**
   - IoT sensoren simuleren temperatuur, vochtigheid, locatie
   - Data wordt elke 10 seconden bijgewerkt
   - Smart contract slaat data op

3. **Kwaliteitscontrole**
   - Bij aankomst wordt kwaliteit beoordeeld
   - Goede batches (>70): bonus stablecoins
   - Slechte batches (<50): verminderde betaling

4. **Consument**
   - QR code scannen
   - Volledige traceability zien
   - Verificatie van VC's

## 🔐 DID & Verifiable Credentials

### DID Aanmaken
Elke stakeholder krijgt een unieke DID:
```
did:ethr:sepolia:0x123...abc
```

### VC Structuur
- **Issuer**: Certificerende partij
- **Subject**: Boer/transporteur
- **Claims**: Kwaliteitscertificaten, duurzaamheid

## 🪙 Incentive Mechanisme

### Stablecoin Rewards
- Base prijs: 10 tokens per kg
- Kwaliteit >90: +30% bonus
- Kwaliteit 70-90: +15% bonus
- Kwaliteit 50-70: base prijs
- Kwaliteit <50: -20%

## 🌍 UN SDG-12
Verantwoorde consumptie en productie door:
- Transparantie in supply chain
- Eerlijke beloning voor kwaliteit
- Traceerbaarheid voor consumenten

## 📝 Licentie
MIT License

## 👥 Contact
Blockchain Minor - POC #1

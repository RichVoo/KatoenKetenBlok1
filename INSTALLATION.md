# Cotton Supply Chain - Installation & Setup Guide

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **Python 3** (voor frontend HTTP server) - [Download](https://www.python.org/)
- **PowerShell** (Windows default)
- **Git** - [Download](https://git-scm.com/)

## 🚀 Quick Start (AANBEVOLEN)

### Automatische Setup & Start
```powershell
# 1. Installeer alle dependencies
.\setup.ps1

# 2. Start alle services in één keer
.\start.ps1
```

**Dat is alles!** Ga naar `http://localhost:8000/stakeholder.html` en begin.

---

## 🔧 Manual Setup (voor advanced users)

### 1. Install Dependencies

```powershell
# Install contracts dependencies
cd contracts
npm install

# Install DID service dependencies
cd ../did-service
npm install
```

### 2. Start Services Manually

**Terminal 1 - Hardhat (Blockchain)**
```powershell
cd contracts
npx hardhat node
```

**Terminal 2 - Deploy Contracts**
```powershell
cd contracts
npx hardhat run scripts/deploy.js --network localhost
```

**Terminal 3 - Setup DID Roles**
```powershell
cd contracts
npx hardhat run scripts/setup.js --network localhost
```

**Terminal 4 - DID Service**
```powershell
cd did-service
npm run dev
```

**Terminal 5 - Frontend**
```powershell
cd frontend
python -m http.server 8000
```

**Access de applicatie:**
- Stakeholder Dashboard: `http://localhost:8000/stakeholder.html`
- DID Registratie: `http://localhost:8000/register.html`
- Batch Viewer: `http://localhost:8000/dpp-viewer.html`

---

## 🔗 Services & Endpoints

Nadat je `.\start.ps1` hebt gedraaid, zijn deze services actief:

| Service | URL | Beschrijving |
|---------|-----|--------------|
| **Hardhat Blockchain** | `http://localhost:8545` | Lokale Ethereum blockchain |
| **DID Service API** | `http://localhost:3002` | Email verificatie & DID registratie |
| **Frontend** | `http://localhost:8000` | Webapplicatie (3 pagina's) |

### API Endpoints (DID Service)
- `POST /api/request-verification` - Aanvraag verificatiecode
- `POST /api/verify-and-create-wallet` - Verifieer code & maak wallet
- `POST /api/register-on-chain` - Registreer DID on-chain
- `GET /api/registrations` - Bekijk alle DIDs

---

## 🦊 MetaMask Setup (Optioneel)

Als je wilt testen met eigen wallets:

1. Open MetaMask
2. Add Local Network:
   - Network Name: **Hardhat Localhost**
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: **1337**
   - Currency Symbol: **ETH**
3. Import test account (admin wallet):
   - Private Key: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
   - Address: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`

---

## 🌐 Deploy to Sepolia Testnet (Optioneel)

### 1. Get Test ETH
Visit [Sepolia Faucet](https://sepoliafaucet.com/) to get test ETH.

### 2. Configure Sepolia
Edit `contracts/.env`:
```
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
PRIVATE_KEY=your_private_key
```

### 3. Deploy to Sepolia
```powershell
cd contracts
npx hardhat run scripts/deploy.js --network sepolia
```

**Note:** Sepolia deployment is voor production testing. Lokaal development werkt prima met `.\start.ps1`.

---

## 📝 Usage Flow

### 1️⃣ Maak een Nieuwe DID (register.html)

**Stap 1: Vul Gegevens In**
- URN: `nl:kvk:12345678`
- Bedrijfsnaam: `Mijn Katoen BV`
- Email: `info@mijnkatoen.nl`
- Rol: Kies uit Farmer, Processor, Manufacturer, Retailer, of Auditor

**Stap 2: Email Verificatie**
- Klik "Vraag Verificatie Aan"
- Verificatiecode wordt getoond in console/alert
- Vul 6-cijferige code in
- Klik "Verifieer & Maak Wallet"

**Stap 3: Ontvang Private Key**
- Wallet wordt on-chain geregistreerd
- Kopieer private key en bewaar veilig
- DID verschijnt in lijst met groene "On-Chain" badge

### 2️⃣ Importeer Wallet (stakeholder.html)

**Optie A: Gebruik Custom DID**
1. Ga naar stakeholder dashboard
2. Plak private key in import veld
3. Selecteer "Aangepaste DID" kaart
4. Dashboard opent met jouw rol

**Optie B: Gebruik Test Accounts**
1. Selecteer een van de 5 voorgemaakte rollen:
   - Admin (smart contract owner)
   - Farmer (katoen producent)
   - Transporter (logistiek)
   - Certifier (kwaliteitscontrole)
   - Factory (verwerker)

### 3️⃣ Werk met Batches

**Als Farmer:**
1. Klik "Genereer Batch met Random Kwaliteit"
2. Bekijk batchID en QR code
3. Deel QR code met stakeholders

**Als Transport/Factory:**
1. Selecteer batch uit lijst
2. Voeg IoT data toe (temperatuur, luchtvochtigheid)
3. Bekijk real-time blockchain updates

**Als Consumer:**
1. Ga naar `dpp-viewer.html`
2. Voer batchID in of scan QR
3. Bekijk complete supply chain geschiedenis

---

## 🧪 Testing

### Smart Contract Tests
```powershell
cd contracts
npx hardhat test
```

### Test DID Service API
```powershell
# Test verification request
curl -X POST http://localhost:3002/api/request-verification `
  -H "Content-Type: application/json" `
  -d '{\"urn\":\"test:123\",\"name\":\"Test\",\"email\":\"test@example.com\",\"role\":\"Farmer\"}'

# Check registrations
curl http://localhost:3002/api/registrations
```

---

## 🐛 Troubleshooting

### Services starten niet
**Probleem:** `start.ps1` geeft errors  
**Oplossing:** 
1. Run eerst `.\setup.ps1` om dependencies te installeren
2. Check of Node.js en Python geïnstalleerd zijn

### DID Service connection error
**Probleem:** Frontend kan niet verbinden met http://localhost:3002  
**Oplossing:** 
1. Check of DID service draait: `Get-Process node`
2. Herstart service: `cd did-service; npm run dev`

### Contract not deployed
**Probleem:** "Contract address not found"  
**Oplossing:** 
1. Check `contracts/deployed-addresses.json` bestaat
2. Zo niet: `cd contracts; npx hardhat run scripts/deploy.js --network localhost`

### Blockchain connection refused
**Probleem:** "ECONNREFUSED 127.0.0.1:8545"  
**Oplossing:** 
1. Hardhat node draait niet
2. Start met: `cd contracts; npx hardhat node`

### Nonce errors bij DID registratie
**Probleem:** "Expected nonce to be X but got Y"  
**Oplossing:** 
- DID service heeft automatische retry logic (3 pogingen)
- Als het blijft falen: herstart Hardhat node (verliest wel data)

### Verification code werkt niet
**Probleem:** "Invalid or expired verification code"  
**Oplossing:** 
- Codes zijn 10 minuten geldig
- Vraag nieuwe code aan
- Check `did-service/data/verifications.json` voor actieve codes

---

## 📂 Project Structure

```
Poc#1/
├── contracts/              # Smart contracts (Hardhat)
│   ├── contracts/
│   │   ├── IntegratedCottonDPP.sol    # Hoofd contract (DID + Batches + IoT)
│   │   └── USDTMock.sol               # Test stablecoin
│   ├── scripts/
│   │   ├── deploy.js                  # Deploy contracts
│   │   └── setup.js                   # Setup DID roles
│   └── deployed-addresses.json        # Contract addresses
│
├── did-service/            # DID registratie backend (TypeScript/Express)
│   ├── src/
│   │   └── server.ts                  # Email verificatie & wallet creatie
│   └── data/
│       ├── registrations.json         # Alle DIDs met private keys
│       └── verifications.json         # Pending verificatie codes
│
├── frontend/               # Webapplicatie (vanilla JS)
│   └── public/
│       ├── stakeholder.html           # Dashboard met wallet import
│       ├── register.html              # DID registratie met email verificatie
│       └── dpp-viewer.html            # Publieke batch viewer
│
├── setup.ps1               # Installeer alle dependencies
└── start.ps1               # Start alle services (one-command)
```

---

## 📚 Documentation

- [Solidity Documentation](https://docs.soliditylang.org/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Ethers.js Documentation](https://docs.ethers.org/)
- [TypeScript](https://www.typescriptlang.org/)

---

## 🤝 Support

Voor vragen en problemen:
1. Check eerst de **Troubleshooting** sectie hierboven
2. Bekijk `README.md` voor architectuur details
3. Check console logs in browser (F12)
4. Check terminal output van services

---

**Built with ❤️ for Blockchain Minor - POC #1**

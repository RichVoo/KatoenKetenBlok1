# Cotton Supply Chain - Installation & Setup Guide

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **MetaMask** browser extension - [Install](https://metamask.io/)
- **Git** - [Download](https://git-scm.com/)

## 🚀 Quick Start

### 1. Install Dependencies

```powershell
# Install contracts dependencies
cd contracts
npm install

# Install backend dependencies
cd ../backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Configure Environment Variables

#### Contracts
```powershell
cd contracts
cp .env.example .env
```
Edit `.env` and add your private key and RPC URL.

#### Backend
```powershell
cd ../backend
cp .env.example .env
```
Edit `.env` and configure your settings.

#### Frontend
```powershell
cd ../frontend
cp .env.example .env
```

### 3. Start Local Blockchain (Development)

```powershell
cd contracts
npx hardhat node
```

Keep this terminal open.

### 4. Deploy Smart Contracts

In a new terminal:

```powershell
cd contracts
npx hardhat run scripts/deploy.js --network localhost
```

Copy the deployed contract addresses to:
- `backend/.env`
- `frontend/.env`

### 5. Start Backend Server

```powershell
cd backend
npm start
```

### 6. Start Frontend

```powershell
cd frontend
npm start
```

Visit `http://localhost:3000` in your browser.

## 🦊 MetaMask Setup

1. Open MetaMask
2. Add Local Network:
   - Network Name: Localhost
   - RPC URL: http://127.0.0.1:8545
   - Chain ID: 1337
   - Currency Symbol: ETH

3. Import one of the test accounts from Hardhat (private key shown in terminal)

## 🌐 Deploy to Sepolia Testnet

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

### 4. Update Backend & Frontend
Update the contract addresses in both `.env` files.

## 📝 Usage Flow

### As a Farmer (Boer):
1. Connect MetaMask
2. Go to "Boer" dashboard
3. Click "Genereer Batch met Random Kwaliteit"
4. View your batches and QR codes

### As a Transporter:
1. Go to "Transport" dashboard
2. Select a batch
3. Click "Start Transport"
4. Click "Start IoT Simulatie" to begin monitoring
5. Watch real-time IoT data being recorded
6. Click "Voltooi Transport & Betaal Boer" when done

### As a Consumer:
1. Go to "Consument" view
2. Enter batch ID or scan QR code
3. View complete traceability information

### DID & Verifiable Credentials:
1. Go to "DID/VC" dashboard
2. Create DIDs for stakeholders
3. Issue credentials (certificates)
4. Verify credentials

## 🧪 Testing

### Run Smart Contract Tests
```powershell
cd contracts
npx hardhat test
```

### Test IoT Generation
```powershell
cd backend
curl http://localhost:3001/api/iot/generate
```

## 🐛 Troubleshooting

### "Nonce too high" error
Reset MetaMask account:
Settings > Advanced > Reset Account

### Contract not deployed
Make sure you deployed contracts and updated addresses in `.env` files.

### Backend connection error
Check if backend is running on port 3001.

### MetaMask not connecting
Ensure you're on the correct network (Localhost or Sepolia).

## 📚 Documentation

- [Solidity Documentation](https://docs.soliditylang.org/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Ethers.js Documentation](https://docs.ethers.org/)
- [React Documentation](https://react.dev/)

## 🤝 Support

For issues and questions, contact the development team.

---

**Built with ❤️ for Blockchain Minor - POC #1**

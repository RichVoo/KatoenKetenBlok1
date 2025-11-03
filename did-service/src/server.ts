import express from 'express';
import path from 'path';
import { createWallet, getBalance, createDIDFromAddress, isValidDID, resolveAddressFromDID } from './blockchain';
import fs from 'fs/promises';
import { provider } from './blockchain';
import { ethers } from 'ethers';

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.use(express.static(path.join(__dirname, '../public')));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

const DATA_DIR = path.join(__dirname, '..', 'data');
const REG_FILE = path.join(DATA_DIR, 'registrations.json');

async function ensureDataDir() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const data = await readJson(REG_FILE);
        await fs.writeFile(REG_FILE, JSON.stringify(data, null, 2), { encoding: 'utf8' });
    } catch (e) {}
}

async function readJson(filePath: string) {
    try {
        const raw = await fs.readFile(filePath, 'utf8');
        return JSON.parse(raw || '[]');
    } catch (e) {
        return [];
    }
}

async function writeJson(filePath: string, data: any) {
    await ensureDataDir();
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

const VERIFY_FILE = path.join(DATA_DIR, 'verifications.json');

async function readVerifications() {
    try {
        const data = await readJson(VERIFY_FILE);
        // Clean up expired codes (older than 10 minutes)
        const now = Date.now();
        const valid = data.filter((v: any) => now - v.timestamp < 10 * 60 * 1000);
        if (valid.length !== data.length) {
            await writeJson(VERIFY_FILE, valid);
        }
        return valid;
    } catch (e) {
        return [];
    }
}

async function saveVerification(code: string, data: any) {
    const verifications = await readVerifications();
    verifications.push({ code, ...data, timestamp: Date.now() });
    await writeJson(VERIFY_FILE, verifications);
}

async function getVerification(code: string) {
    const verifications = await readVerifications();
    return verifications.find((v: any) => v.code === code);
}

async function deleteVerification(code: string) {
    const verifications = await readVerifications();
    const filtered = verifications.filter((v: any) => v.code !== code);
    await writeJson(VERIFY_FILE, filtered);
}

function generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email: string, code: string, naam: string, urn: string): Promise<void> {
    console.log('========== VERIFICATION EMAIL ==========');
    console.log(`To: ${email}`);
    console.log(`Subject: Verify your DID registration`);
    console.log(`Dear ${naam},`);
    console.log(`Your verification code for URN ${urn} is: ${code}`);
    console.log(`This code will expire in 10 minutes.`);
    console.log('========================================');
}

// Simple one-step registration (like original PoC_DID)
app.post('/api/register', async (req, res) => {
    try {
        const { naam, bedrijfsnaam, urn, email, telefoon, role } = req.body;
        
        if (!naam || !bedrijfsnaam || !urn) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const regs = await readJson(REG_FILE);
        if (regs.find((r: any) => r.urn.toLowerCase() === urn.toLowerCase())) {
            return res.status(400).json({ error: 'This URN is already registered' });
        }

        const wallet = await createWallet();
        const did = wallet.did;

        const didDocument = {
            '@context': 'https://www.w3.org/ns/did/v1',
            id: did,
            verificationMethod: [
                {
                    id: `${did}#key-1`,
                    type: 'EcdsaSecp256k1VerificationKey2019',
                    controller: did,
                    blockchainAccountId: `eip155:1337:${wallet.address}`
                }
            ],
            authentication: [`${did}#key-1`],
            created: new Date().toISOString()
        };

        const registration = {
            did,
            walletAddress: wallet.address,
            privateKey: wallet.privateKey,
            urn, naam, bedrijfsnaam, email, telefoon,
            role: role || 'farmer',
            didDocument,
            timestamp: new Date().toISOString(),
            verified: true
        };

        regs.push(registration);
        await writeJson(REG_FILE, regs);

        console.log(`DID Created: ${did} for ${naam} (${bedrijfsnaam}) - Role: ${role || 'farmer'}`);

        res.json(registration);
    } catch (e) {
        console.error('Error /api/register', e);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// On-chain registration endpoint
app.post('/api/register-on-chain', async (req, res) => {
    try {
        const { walletAddress } = req.body;
        if (!walletAddress) return res.status(400).json({ error: 'walletAddress is required' });

        console.log('Starting on-chain registration for address:', walletAddress);

        // Get registration data
        const regs = await readJson(REG_FILE);
        const registration = regs.find((r: any) => r.walletAddress.toLowerCase() === walletAddress.toLowerCase());
        if (!registration) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        const adminPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        const adminWallet = new ethers.Wallet(adminPrivateKey, provider);

        // We'll explicitly manage nonces and add a small retry in case the provider reports a nonce mismatch.
        const contractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
        const contractABI = [
            "function registerDID(address controller, string publicKey, string didType)"
        ];

        // Get current nonce and use it for the ETH transfer first.
        let baseNonce = await provider.getTransactionCount(adminWallet.address, 'latest');
        console.log('Starting on-chain flow with base nonce:', baseNonce);

        // 1) Send ETH to new wallet for gas using explicit nonce
        const ethTx = await adminWallet.sendTransaction({
            to: walletAddress,
            value: ethers.parseEther("0.1"),
            nonce: baseNonce
        });
        console.log('ETH tx sent (nonce', baseNonce, '):', ethTx.hash);
        const ethReceipt = await ethTx.wait();
        console.log('ETH confirmed');

        // 2) Call registerDID using nonce = baseNonce + 1. Add a small retry if nonce errors occur.
        const contract = new ethers.Contract(contractAddress, contractABI, adminWallet);
        const didType = registration.role || 'farmer';
        const publicKey = registration.walletAddress;

        let attempt = 0;
        const maxAttempts = 3;
        let didReceipt: any = null;
        while (attempt < maxAttempts) {
            const txNonce = baseNonce + 1 + attempt; // try increasing nonce on retry
            try {
                console.log(`Attempt ${attempt + 1}: registerDID with nonce ${txNonce}`);
                const didTx = await contract.registerDID(walletAddress, publicKey, didType, { nonce: txNonce });
                console.log('DID registration tx sent:', didTx.hash);
                didReceipt = await didTx.wait();
                console.log('DID registered on-chain!', didReceipt);
                break;
            } catch (err: any) {
                console.error(`Attempt ${attempt + 1} failed:`, err && err.message ? err.message : err);
                // If it's a nonce error, fetch latest nonce and adjust baseNonce
                if (err && err.code === 'NONCE_EXPIRED') {
                    const latest = await provider.getTransactionCount(adminWallet.address, 'latest');
                    console.log('Nonce expired. Updating baseNonce to', latest - 1);
                    baseNonce = Math.max(0, latest - 1);
                    // small delay before retry
                    await new Promise(r => setTimeout(r, 200));
                    attempt++;
                    continue;
                }
                // for other errors rethrow
                throw err;
            }
        }

        if (!didReceipt) {
            throw new Error('Failed to register DID on-chain after retries');
        }

        // Update registration with txHash
        const idx = regs.findIndex((r: any) => r.walletAddress.toLowerCase() === walletAddress.toLowerCase());
        if (idx !== -1) {
            regs[idx].txHash = didReceipt.transactionHash || didReceipt.hash;
            regs[idx].txReceipt = didReceipt;
            regs[idx].onChain = true;
            await writeJson(REG_FILE, regs);
        }

        res.json({ txHash: didReceipt.transactionHash || didReceipt.hash, receipt: didReceipt });

        
    } catch (e) {
        console.error('Error /api/register-on-chain', e);
        res.status(500).json({ error: 'On-chain registration failed: ' + (e as Error).message });
    }
});

app.post('/api/request-verification', async (req, res) => {
    try {
        const { naam, bedrijfsnaam, urn, email, telefoon, didType } = req.body;
        
        if (!naam || !bedrijfsnaam || !urn || !email) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const regs = await readJson(REG_FILE);
        if (regs.find((r: any) => r.urn.toLowerCase() === urn.toLowerCase())) {
            return res.status(400).json({ error: 'This URN is already registered' });
        }

        // Remove old verification codes for this URN
        const allVerifications = await readVerifications();
        const filtered = allVerifications.filter((v: any) => v.urn.toLowerCase() !== urn.toLowerCase());
        await writeJson(VERIFY_FILE, filtered);

        const code = generateVerificationCode();

        await saveVerification(code, {
            naam, bedrijfsnaam, urn, email, telefoon,
            didType: didType || 'organization'
        });

        await sendVerificationEmail(email, code, naam, urn);

        res.json({ success: true, message: 'Verification code sent to email', code });
    } catch (e) {
        console.error('Error requesting verification:', e);
        res.status(500).json({ error: 'Failed to initiate verification' });
    }
});

app.post('/api/verify-and-create-wallet', async (req, res) => {
    try {
        const { verificationCode } = req.body;
        
        if (!verificationCode) {
            return res.status(400).json({ error: 'Verification code required' });
        }

        const verificationData = await getVerification(verificationCode);
        if (!verificationData) {
            return res.status(400).json({ error: 'Invalid or expired verification code' });
        }

        if (Date.now() - verificationData.timestamp > 10 * 60 * 1000) {
            await deleteVerification(verificationCode);
            return res.status(400).json({ error: 'Verification code expired' });
        }

        const { naam, bedrijfsnaam, urn, email, telefoon, didType } = verificationData;
        await deleteVerification(verificationCode);

        const wallet = await createWallet();
        const did = wallet.did;

        const didDocument = {
            '@context': 'https://www.w3.org/ns/did/v1',
            id: did,
            verificationMethod: [
                {
                    id: `${did}#key-1`,
                    type: 'EcdsaSecp256k1VerificationKey2019',
                    controller: did,
                    blockchainAccountId: `eip155:1337:${wallet.address}`
                }
            ],
            authentication: [`${did}#key-1`],
            created: new Date().toISOString()
        };

        const registration = {
            did,
            walletAddress: wallet.address,
            privateKey: wallet.privateKey,
            urn, naam, bedrijfsnaam, email, telefoon, didType,
            didDocument,
            timestamp: new Date().toISOString(),
            verified: true
        };

        const regs = await readJson(REG_FILE);
        regs.push(registration);
        await writeJson(REG_FILE, regs);

        console.log(`DID Created: ${did} for ${naam} (${bedrijfsnaam})`);

        res.json(registration);
    } catch (e) {
        console.error('Error verifying and creating wallet:', e);
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.get('/api/registrations', async (req, res) => {
    try {
        const regs = await readJson(REG_FILE);
        const safeRegs = regs.map((r: any) => ({
            did: r.did, walletAddress: r.walletAddress, naam: r.naam,
            bedrijfsnaam: r.bedrijfsnaam, urn: r.urn, didType: r.didType,
            timestamp: r.timestamp, verified: r.verified
        }));
        res.json(safeRegs);
    } catch (e) {
        console.error('Error getting registrations:', e);
        res.status(500).json({ error: 'Failed to get registrations' });
    }
});

app.get('/api/search', async (req, res) => {
    try {
        const q = (req.query.q as string || '').trim();
        if (!q) return res.json([]);
        
        const regs = await readJson(REG_FILE);
        const lower = q.toLowerCase();
        const results = regs.filter((r: any) => (
            (r.did && r.did.toLowerCase().includes(lower)) ||
            (r.walletAddress && r.walletAddress.toLowerCase() === lower) ||
            (r.urn && r.urn.toLowerCase().includes(lower)) ||
            (r.naam && r.naam.toLowerCase().includes(lower)) ||
            (r.bedrijfsnaam && r.bedrijfsnaam.toLowerCase().includes(lower))
        ));
        res.json(results);
    } catch (e) {
        console.error('Error searching:', e);
        res.status(500).json({ error: 'Search failed' });
    }
});

app.get('/api/resolve-did/:did', async (req, res) => {
    try {
        const { did } = req.params;
        
        if (!isValidDID(did)) {
            return res.status(400).json({ error: 'Invalid DID format' });
        }

        const address = resolveAddressFromDID(did);
        if (!address) {
            return res.status(404).json({ error: 'Could not resolve DID' });
        }

        const balance = await getBalance(address);
        const regs = await readJson(REG_FILE);
        const registration = regs.find((r: any) => r.did.toLowerCase() === did.toLowerCase());

        if (!registration) {
            return res.json({
                did, address,
                balance: `${ethers.formatEther(balance)} ETH`,
                didDocument: {
                    '@context': 'https://www.w3.org/ns/did/v1',
                    id: did,
                    verificationMethod: [{
                        id: `${did}#key-1`,
                        type: 'EcdsaSecp256k1VerificationKey2019',
                        controller: did,
                        blockchainAccountId: `eip155:1337:${address}`
                    }],
                    authentication: [`${did}#key-1`]
                }
            });
        }

        res.json({
            did, address,
            balance: `${ethers.formatEther(balance)} ETH`,
            didDocument: registration.didDocument,
            registration: {
                naam: registration.naam,
                bedrijfsnaam: registration.bedrijfsnaam,
                urn: registration.urn,
                didType: registration.didType,
                email: registration.email,
                telefoon: registration.telefoon,
                geregistreerd: registration.timestamp,
                verified: registration.verified
            }
        });
    } catch (error) {
        console.error('Error resolving DID:', error);
        res.status(500).json({ error: 'Failed to resolve DID' });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'DID Registration Service' });
});

// Get all registrations
app.get('/api/registrations', async (req, res) => {
    try {
        const regs = await readJson(REG_FILE);
        // Remove private keys from response for security
        const safeRegs = regs.map((r: any) => ({
            did: r.did,
            walletAddress: r.walletAddress,
            urn: r.urn,
            naam: r.naam,
            bedrijfsnaam: r.bedrijfsnaam,
            role: r.role || 'farmer',
            timestamp: r.timestamp,
            txHash: r.txHash,
            verified: r.verified
        }));
        res.json(safeRegs);
    } catch (e) {
        console.error('Error /api/registrations', e);
        res.status(500).json({ error: 'Failed to load registrations' });
    }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`DID Service running on port ${PORT}`);
    console.log(`API: http://localhost:${PORT}`);
    console.log(`Health: http://localhost:${PORT}/health`);
});

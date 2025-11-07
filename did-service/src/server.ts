import express from 'express';
import path from 'path';
import {
    createWallet,
    getBalance,
    createDIDFromAddress,
    isValidDID,
    resolveAddressFromDID,
    fetchAllDIDs,
    fetchDIDByAddress,
    registerDIDOnChain,
    grantMarketplaceRole,
    getSubjectVCIds,
    getCredential,
    fundWalletWithETH,
    fundWalletWithUSDT,
    resetNonceTracking
} from './blockchain';
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

// Verificatie codes (in-memory storage)
interface VerificationRequest {
    code: string;
    naam: string;
    bedrijfsnaam: string;
    urn: string;
    email: string;
    telefoon: string;
    role: string;
    timestamp: number;
}

const verificationCodes = new Map<string, VerificationRequest>();
let blockchainReady = false;

function error(res: express.Response, status: number, msg: string) {
  return res.status(status).json({ error: msg });
}

function generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Middleware to check blockchain readiness
function requireBlockchain(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (!blockchainReady) {
        return error(res, 503, 'Blockchain not ready yet. Please wait a moment and try again.');
    }
    next();
}

// Nieuwe directe registratie: maakt lokale wallet + registreert direct on-chain
app.post('/api/register', requireBlockchain, async (req, res) => {
    try {
        const { naam, bedrijfsnaam, urn, email, telefoon, role } = req.body;
        if (!naam || !bedrijfsnaam || !urn) return error(res, 400, 'Missing required fields');

        // Maak nieuwe wallet
        const wallet = await createWallet();
        const did = wallet.did;
        const didType = role || 'farmer';

        // Reset nonce tracking for fresh transaction sequence
        resetNonceTracking();

        // Registreer direct on-chain (admin roept contract aan)
        const txHash = await registerDIDOnChain(wallet.address, didType, wallet.address);
        
        // Grant role in marketplace
        await grantMarketplaceRole(wallet.address, didType);

        // Fund wallet met ETH en USDT (voor testing)
        console.log(`💰 Funding wallet ${wallet.address} with 1,000 ETH and 1,000 USDT...`);
        await fundWalletWithETH(wallet.address, '1000');
        await fundWalletWithUSDT(wallet.address, '1000');
        console.log(`✅ Wallet funded successfully`);

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

        const response = {
            did,
            walletAddress: wallet.address,
            privateKey: wallet.privateKey,
            urn,
            naam,
            bedrijfsnaam,
            email,
            telefoon,
            didType,
            didDocument,
            timestamp: new Date().toISOString(),
            txHash,
            verified: true,
            onChain: true
        };

        console.log(`DID Created & On-chain: ${did} (${didType}) tx=${txHash}`);
        res.json(response);
    } catch (e: any) {
        console.error('Error /api/register', e);
        error(res, 500, 'Registration failed: ' + e.message);
    }
});

// On-chain registration endpoint
// Legacy endpoint kept as no-op (compatibility)
app.post('/api/register-on-chain', async (_req, res) => {
  return res.json({ message: 'Direct registratie wordt al on-chain gedaan via /api/register', alreadyOnChain: true });
});

// Request verification code (doesn't need blockchain)
app.post('/api/request-verification', async (req, res) => {
    try {
        const { naam, bedrijfsnaam, urn, email, telefoon, role } = req.body;
        if (!naam || !bedrijfsnaam || !urn || !email) {
            return error(res, 400, 'Missing required fields');
        }

        const code = generateVerificationCode();
        const timestamp = Date.now();

        verificationCodes.set(code, {
            code,
            naam,
            bedrijfsnaam,
            urn,
            email,
            telefoon: telefoon || email,
            role: role || 'farmer',
            timestamp
        });

        // Clean up old codes (older than 10 minutes)
        const tenMinutesAgo = timestamp - 10 * 60 * 1000;
        for (const [key, value] of verificationCodes.entries()) {
            if (value.timestamp < tenMinutesAgo) {
                verificationCodes.delete(key);
            }
        }

        console.log(`📧 Verification code generated: ${code} for ${naam} (${email})`);
        console.log(`   Role: ${role}, URN: ${urn}`);

        res.json({
            success: true,
            code, // In productie zou je dit NIET returnen maar per email versturen
            message: 'Verification code sent (check console)',
            expiresIn: '10 minutes'
        });
    } catch (e: any) {
        console.error('Error /api/request-verification', e);
        error(res, 500, 'Failed to generate verification code: ' + e.message);
    }
});

// Verify code and create wallet
app.post('/api/verify-and-create-wallet', requireBlockchain, async (req, res) => {
    try {
        const { verificationCode } = req.body;
        if (!verificationCode) {
            return error(res, 400, 'Verification code required');
        }

        const request = verificationCodes.get(verificationCode);
        if (!request) {
            return error(res, 400, 'Invalid or expired verification code');
        }

        // Check if code is expired (10 minutes)
        const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
        if (request.timestamp < tenMinutesAgo) {
            verificationCodes.delete(verificationCode);
            return error(res, 400, 'Verification code expired');
        }

        // Create wallet and register on-chain
        const wallet = await createWallet();
        const did = wallet.did;

        // Reset nonce tracking for fresh transaction sequence
        resetNonceTracking();

        // Register on-chain
        const txHash = await registerDIDOnChain(wallet.address, request.role, wallet.address);
        
        // Grant role in marketplace
        await grantMarketplaceRole(wallet.address, request.role);

        // Fund wallet met ETH en USDT (voor testing)
        console.log(`💰 Funding wallet ${wallet.address} with 1,000 ETH and 1,000 USDT...`);
        await fundWalletWithETH(wallet.address, '1000');
        await fundWalletWithUSDT(wallet.address, '1000');
        console.log(`✅ Wallet funded successfully`);

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

        const response = {
            did,
            walletAddress: wallet.address,
            privateKey: wallet.privateKey,
            urn: request.urn,
            naam: request.naam,
            bedrijfsnaam: request.bedrijfsnaam,
            email: request.email,
            telefoon: request.telefoon,
            didType: request.role,
            didDocument,
            timestamp: new Date().toISOString(),
            txHash,
            verified: true,
            onChain: true
        };

        // Remove used code
        verificationCodes.delete(verificationCode);

        console.log(`✅ Wallet created & registered on-chain: ${did} (${request.role}) tx=${txHash}`);
        res.json(response);
    } catch (e: any) {
        console.error('Error /api/verify-and-create-wallet', e);
        error(res, 500, 'Wallet creation failed: ' + e.message);
    }
});

app.get('/api/registrations', requireBlockchain, async (_req, res) => {
    try {
        const dids = await fetchAllDIDs();
        const mapped = dids.map(d => ({
            did: d.identifier,
            walletAddress: d.controller,
            naam: '(on-chain)',
            bedrijfsnaam: '(on-chain)',
            urn: d.controller.substring(0, 10),
            didType: d.didType,
            timestamp: new Date(d.registered * 1000).toISOString(),
            verified: d.active,
            txHash: null
        }));
        res.json(mapped);
    } catch (e: any) {
        console.error('Error /api/registrations', e);
        error(res, 500, 'Failed to load registrations: ' + e.message);
    }
});

app.get('/api/search', async (req, res) => {
    try {
        const q = (req.query.q as string || '').trim();
        if (!q) return res.json([]);
        const dids = await fetchAllDIDs();
        const lower = q.toLowerCase();
        const results = dids.filter(d => (
            d.identifier.toLowerCase().includes(lower) ||
            d.controller.toLowerCase() === lower ||
            d.publicKey.toLowerCase().includes(lower) ||
            d.didType.toLowerCase().includes(lower)
        ));
        res.json(results);
    } catch (e: any) {
        console.error('Error searching:', e);
        error(res, 500, 'Search failed: ' + e.message);
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
                const onChain = await fetchDIDByAddress(address);
                if (!onChain) {
                    return res.status(404).json({ error: 'DID not found on-chain' });
                }
                res.json({
                    did: did,
                    address,
                    balance: `${ethers.formatEther(balance)} ETH`,
                    didDocument: {
                        '@context': 'https://www.w3.org/ns/did/v1',
                        id: onChain.identifier,
                        verificationMethod: [{
                            id: `${onChain.identifier}#key-1`,
                            type: 'EcdsaSecp256k1VerificationKey2019',
                            controller: onChain.identifier,
                            blockchainAccountId: `eip155:1337:${address}`
                        }],
                        authentication: [`${onChain.identifier}#key-1`]
                    },
                    registration: {
                        naam: '(on-chain)',
                        bedrijfsnaam: '(on-chain)',
                        urn: address.substring(0, 12),
                        didType: onChain.didType,
                        geregistreerd: new Date(onChain.registered * 1000).toISOString(),
                        verified: onChain.active
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
// (Dubbele endpoint behouden voor backward compat) => levert dezelfde data
app.get('/api/registrations', async (_req, res) => {
    try {
        const dids = await fetchAllDIDs();
        const mapped = dids.map(d => ({
            did: d.identifier,
            walletAddress: d.controller,
            urn: d.controller.substring(0, 10),
            naam: '(on-chain)',
            bedrijfsnaam: '(on-chain)',
            role: d.didType,
            didType: d.didType,
            timestamp: new Date(d.registered * 1000).toISOString(),
            txHash: null,
            verified: d.active
        }));
        res.json(mapped);
    } catch (e: any) {
        console.error('Error /api/registrations', e);
        error(res, 500, 'Failed to load registrations: ' + e.message);
    }
});

// Get registration by wallet address
app.get('/api/registration/:address', async (req, res) => {
    try {
        const addr = req.params.address;
        const did = await fetchDIDByAddress(addr);
        if (!did) return error(res, 404, 'Registration not found (no on-chain DID)');
        res.json({
            did: did.identifier,
            walletAddress: did.controller,
            urn: did.controller.substring(0, 12),
            naam: '(on-chain)',
            bedrijfsnaam: '(on-chain)',
            role: did.didType,
            didType: did.didType,
            timestamp: new Date(did.registered * 1000).toISOString(),
            txHash: null,
            verified: did.active
        });
    } catch (e: any) {
        console.error('Error /api/registration/:address', e);
        error(res, 500, 'Failed to load registration: ' + e.message);
    }
});

// Extra: haal alle VC's van een subject
app.get('/api/vcs/:address', async (req, res) => {
    try {
        const subject = req.params.address;
        const ids = await getSubjectVCIds(subject);
        const vcList = [];
        for (const id of ids) {
            const vc = await getCredential(id);
            vcList.push({
                id: Number(vc.id),
                issuer: vc.issuer,
                subject: vc.subject,
                credentialType: vc.credentialType,
                data: vc.data,
                issuedAt: Number(vc.issuedAt),
                expiresAt: Number(vc.expiresAt),
                revoked: vc.revoked
            });
        }
        res.json(vcList);
    } catch (e: any) {
        console.error('Error /api/vcs/:address', e);
        error(res, 500, 'Failed to load VCs: ' + e.message);
    }
});

const PORT = process.env.PORT || 3002;

// Wait for blockchain to be ready
async function waitForBlockchain(maxRetries = 30, delayMs = 1000): Promise<boolean> {
    const { provider, CONTRACT_ADDRESS } = await import('./blockchain');
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            // Test blockchain connection
            await provider.getNetwork();
            
            // Test contract
            const code = await provider.getCode(CONTRACT_ADDRESS);
            if (code !== '0x') {
                console.log('✅ Blockchain and contract are ready!');
                return true;
            }
            console.log(`⏳ Contract not deployed yet, waiting... (${i + 1}/${maxRetries})`);
        } catch (error) {
            console.log(`⏳ Waiting for blockchain... (${i + 1}/${maxRetries})`);
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return false;
}

// Start server
app.listen(PORT, async () => {
    console.log(`🚀 DID Service starting on port ${PORT}`);
    console.log(`API: http://localhost:${PORT}`);
    console.log(`Health: http://localhost:${PORT}/health`);
    console.log('');
    console.log('Waiting for blockchain to be ready...');
    
    const ready = await waitForBlockchain();
    if (ready) {
        blockchainReady = true;
        console.log('✅ DID Service fully operational!');
    } else {
        console.log('⚠️ DID Service started but blockchain connection failed');
        console.log('   Requests may fail until blockchain is available');
    }
});

import { ethers } from 'ethers';

// Configuratie voor het Hardhat netwerk
export const config = {
    rpcUrl: 'http://127.0.0.1:8545',
    chainId: 1337
};

// Creëer een provider voor het Hardhat netwerk
export const provider = new ethers.JsonRpcProvider(config.rpcUrl);

// Contract addresses (localhost Hardhat)
export const CONTRACT_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
export const MARKETPLACE_ADDRESS = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';
export const USDT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

// Admin private key (first Hardhat account)
const ADMIN_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

// Role constants (keccak256 hashes)
const FARMER_ROLE = '0x7c6181838a71a779e445600d4c6ecbe16bacf2b3c5bda69c29fada66d1b645d1';
const TRANSPORTER_ROLE = '0x0e641c4b8e364f681756e85b17b1de5e948f72e122d0236a5d1ce5d527e2da57';
const CERTIFIER_ROLE = '0x5e25f0e5d57b7e8b0f3c5e4bb4a5c6e7e4e0c3d8e0e4a3c8e0e4a3c8e0e4a3c8';
const FACTORY_ROLE = '0x38f5d833e5e4b5e0e0e4a3c8e0e4a3c8e0e4a3c8e0e4a3c8e0e4a3c8e0e4a3c8';

export const DPP_ABI = [
    // DID
    'function getAllDIDControllers() view returns (address[])',
    'function getDID(address account) view returns (string identifier, string publicKey, string didType, uint256 registered, bool active)',
    'function dids(address) view returns (string identifier, string publicKey, string didType, uint256 registered, bool active)',
    'function hasDID(address) view returns (bool)',
    'function registerDID(address controller, string publicKey, string didType)',
    // VCs
    'function getSubjectVCs(address subject) view returns (uint256[])',
    'function getCredential(uint256 vcId) view returns (uint256 id, address issuer, address subject, string credentialType, string data, uint256 issuedAt, uint256 expiresAt, bool revoked)'
];

export const MARKETPLACE_ABI = [
    'function grantRole(bytes32 role, address account)',
    'function hasRole(bytes32 role, address account) view returns (bool)'
];

export const USDT_ABI = [
    'function mint(address to, uint256 amount)',
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)'
];

export function getContract(signerOrProvider: ethers.Wallet | ethers.JsonRpcProvider = provider) {
    if (!CONTRACT_ADDRESS) {
        throw new Error('Contract address not initialized');
    }
    return new ethers.Contract(CONTRACT_ADDRESS, DPP_ABI, signerOrProvider);
}

// Functie om een nieuwe wallet te maken
export async function createWallet(): Promise<{ address: string; privateKey: string; did: string }> {
    const randomWallet = ethers.Wallet.createRandom();
    const connectedWallet = randomWallet.connect(provider);
    const address = await connectedWallet.getAddress();

    return {
        address: address,
        privateKey: randomWallet.privateKey,
        did: createDIDFromAddress(address)
    };
}

// Functie om het saldo van een wallet te controleren
export async function getBalance(address: string): Promise<string> {
    const balance = await provider.getBalance(address);
    return balance.toString();
}

// Functie om DID te maken van een Ethereum adres
export function createDIDFromAddress(address: string): string {
    return `did:ethr:${address}`;
}

// Functie om wallet van private key te maken
export function getWalletFromPrivateKey(privateKey: string): ethers.Wallet {
    return new ethers.Wallet(privateKey, provider);
}

// Functie om DID te valideren
export function isValidDID(did: string): boolean {
    const regex = /^did:ethr:0x[a-fA-F0-9]{40}$/;
    return regex.test(did);
}

// Functie om DID te resolven naar een adres
export function resolveAddressFromDID(did: string): string | null {
    if (!isValidDID(did)) return null;
    return did.split(':')[2];
}

// On-chain DID helpers
export type OnChainDID = {
    controller: string;
    identifier: string;
    publicKey: string;
    didType: string;
    registered: number;
    active: boolean;
};

export async function fetchAllDIDs(): Promise<OnChainDID[]> {
    try {
        const contract = getContract();
        const controllers: string[] = await contract.getAllDIDControllers();
        const dids: OnChainDID[] = [];
        for (const addr of controllers) {
            const d = await contract.getDID(addr);
            dids.push({
                controller: addr,
                identifier: d.identifier,
                publicKey: d.publicKey,
                didType: d.didType,
                registered: Number(d.registered),
                active: d.active
            });
        }
        return dids;
    } catch (error: any) {
        throw new Error(`Failed to fetch DIDs from blockchain: ${error.message}`);
    }
}

export async function fetchDIDByAddress(address: string): Promise<OnChainDID | null> {
    try {
        const contract = getContract();
        const d = await contract.getDID(address);
        if (!d || !d.identifier) return null;
        return {
            controller: address,
            identifier: d.identifier,
            publicKey: d.publicKey,
            didType: d.didType,
            registered: Number(d.registered),
            active: d.active
        };
    } catch (error: any) {
        throw new Error(`Failed to fetch DID for address ${address}: ${error.message}`);
    }
}

// Reusable admin wallet to avoid nonce conflicts
let adminWallet: ethers.Wallet | null = null;
let lastBlockNumber: number = 0;
let transactionLock: Promise<void> = Promise.resolve();
let manualNonce: number | null = null;

async function getAdminWallet(): Promise<ethers.Wallet> {
    // Check if blockchain was restarted (block number went back to 0)
    const currentBlock = await provider.getBlockNumber();
    
    if (currentBlock < lastBlockNumber) {
        // Blockchain was restarted, reset wallet
        console.log('⚠️ Blockchain restart detected, resetting admin wallet');
        adminWallet = null;
        transactionLock = Promise.resolve();
        manualNonce = null;
    }
    
    lastBlockNumber = currentBlock;
    
    if (!adminWallet) {
        adminWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
        console.log(`🔑 Admin wallet initialized at block ${currentBlock}`);
    }
    return adminWallet;
}

async function getNextNonce(admin: ethers.Wallet): Promise<number> {
    if (manualNonce === null) {
        // First time - fetch from blockchain
        manualNonce = await admin.getNonce();
        console.log(`📊 Initial nonce fetched from blockchain: ${manualNonce}`);
        return manualNonce;
    }
    
    // Subsequent calls - increment our tracked nonce
    manualNonce++;
    console.log(`📊 Using incremented nonce: ${manualNonce}`);
    return manualNonce;
}

export function resetNonceTracking(): void {
    console.log('🔄 Resetting nonce tracking');
    manualNonce = null;
}

// Queue transactions to prevent nonce conflicts using a lock
async function queueTransaction<T>(txFn: () => Promise<T>): Promise<T> {
    // Chain this transaction after the previous one
    const previousLock = transactionLock;
    
    let resolveLock: () => void;
    transactionLock = new Promise(resolve => {
        resolveLock = resolve;
    });
    
    try {
        // Wait for previous transaction to complete
        await previousLock;
        console.log('🔓 Lock acquired, executing transaction...');
        
        // Execute transaction
        const result = await txFn();
        
        return result;
    } finally {
        // Release lock for next transaction
        resolveLock!();
        console.log('🔒 Lock released');
    }
}

export async function registerDIDOnChain(walletAddress: string, didType: string, publicKey?: string): Promise<string> {
    return queueTransaction(async () => {
        const admin = await getAdminWallet();
        const contract = getContract(admin);
        const pk = publicKey || walletAddress;
        
        // Get sequential nonce
        const nonce = await getNextNonce(admin);
        console.log(`📝 Registering DID with nonce: ${nonce}`);
        
        const tx = await contract.registerDID(walletAddress, pk, didType, { nonce });
        const receipt = await tx.wait();
        console.log(`✅ DID registered, nonce used: ${tx.nonce}`);
        
        return receipt.hash || tx.hash;
    });
}

// Grant role in marketplace - call this AFTER registerDIDOnChain
export async function grantMarketplaceRole(walletAddress: string, didType: string): Promise<void> {
    return queueTransaction(async () => {
        const admin = await getAdminWallet();
        const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, admin);
        
        // Determine which role to grant
        let role: string;
        let roleName: string;
        
        if (didType === 'farmer') {
            role = FARMER_ROLE;
            roleName = 'FARMER_ROLE';
        } else if (didType === 'transporter' || didType === 'processing') {
            role = TRANSPORTER_ROLE;
            roleName = 'TRANSPORTER_ROLE';
        } else if (didType === 'certifier') {
            role = CERTIFIER_ROLE;
            roleName = 'CERTIFIER_ROLE';
        } else if (didType === 'cooperative' || didType === 'factory') {
            role = FACTORY_ROLE;
            roleName = 'FACTORY_ROLE';
        } else {
            // Default to farmer role for custom types
            role = FARMER_ROLE;
            roleName = 'FARMER_ROLE (default)';
        }
        
        // Get sequential nonce
        const nonce = await getNextNonce(admin);
        console.log(`🔐 Granting ${roleName} in marketplace with nonce: ${nonce}`);
        
        const tx = await marketplace.grantRole(role, walletAddress, { nonce });
        const receipt = await tx.wait();
        console.log(`✅ Role granted, nonce used: ${tx.nonce}`);
    });
}

// Send ETH to a wallet (for testing)
export async function fundWalletWithETH(walletAddress: string, amountInEth: string = '1000'): Promise<string> {
    return queueTransaction(async () => {
        const admin = await getAdminWallet();
        
        // Get sequential nonce
        const nonce = await getNextNonce(admin);
        console.log(`💸 Sending ETH with nonce: ${nonce}`);
        
        const tx = await admin.sendTransaction({
            to: walletAddress,
            value: ethers.parseEther(amountInEth),
            nonce
        });
        const receipt = await tx.wait();
        console.log(`✅ ETH sent, nonce used: ${tx.nonce}`);
        return receipt?.hash || tx.hash;
    });
}

// Mint USDT to a wallet (for testing)
export async function fundWalletWithUSDT(walletAddress: string, amountInUSDT: string = '1000'): Promise<string> {
    return queueTransaction(async () => {
        const admin = await getAdminWallet();
        const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, admin);
        const amount = ethers.parseUnits(amountInUSDT, 6); // USDT has 6 decimals
        
        // Get sequential nonce
        const nonce = await getNextNonce(admin);
        console.log(`🪙 Minting USDT with nonce: ${nonce}`);
        
        const tx = await usdtContract.mint(walletAddress, amount, { nonce });
        const receipt = await tx.wait();
        console.log(`✅ USDT minted, nonce used: ${tx.nonce}`);
        return receipt?.hash || tx.hash;
    });
}

export async function getSubjectVCIds(address: string): Promise<bigint[]> {
    const contract = getContract();
    return await contract.getSubjectVCs(address);
}

export async function getCredential(vcId: bigint): Promise<any> {
    const contract = getContract();
    return await contract.getCredential(vcId);
}
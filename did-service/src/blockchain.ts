import { ethers } from 'ethers';

// Configuratie voor het Hardhat netwerk
export const config = {
    rpcUrl: 'http://127.0.0.1:8545',
    chainId: 1337
};

// Creëer een provider voor het Hardhat netwerk
export const provider = new ethers.JsonRpcProvider(config.rpcUrl);

// IntegratedCottonDPP contract config (localhost Hardhat)
export const CONTRACT_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
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

export function getContract(signerOrProvider: ethers.Wallet | ethers.JsonRpcProvider = provider) {
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
}

export async function fetchDIDByAddress(address: string): Promise<OnChainDID | null> {
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
}

// Admin key for localhost Hardhat (first account) - used to register DIDs on chain
const ADMIN_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

export async function registerDIDOnChain(walletAddress: string, didType: string, publicKey?: string): Promise<string> {
    const admin = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    const contract = getContract(admin);
    const pk = publicKey || walletAddress;
    const tx = await contract.registerDID(walletAddress, pk, didType);
    const receipt = await tx.wait();
    return receipt.hash || tx.hash;
}

export async function getSubjectVCIds(address: string): Promise<bigint[]> {
    const contract = getContract();
    return await contract.getSubjectVCs(address);
}

export async function getCredential(vcId: bigint): Promise<any> {
    const contract = getContract();
    return await contract.getCredential(vcId);
}
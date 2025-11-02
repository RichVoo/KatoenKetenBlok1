import { ethers } from 'ethers';

// Configuratie voor het Hardhat netwerk
export const config = {
    rpcUrl: 'http://127.0.0.1:8545',
    chainId: 1337
};

// Creëer een provider voor het Hardhat netwerk
export const provider = new ethers.JsonRpcProvider(config.rpcUrl);

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
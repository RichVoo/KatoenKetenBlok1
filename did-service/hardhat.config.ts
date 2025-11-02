import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
    solidity: "0.8.20",
    networks: {
        hardhat: {
            chainId: 1337,
            accounts: [{
                balance: "10000000000000000000", // 10 ETH
                privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" // First hardhat account
            }]
        }
    }
};

export default config;
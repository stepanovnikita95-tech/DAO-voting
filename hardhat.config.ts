import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@typechain/hardhat"; 
import "dotenv/config";

const config: HardhatUserConfig = {
solidity: {
    version: "0.8.30",                   
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",              
    },
  },  
  networks: {
    hardhat: {},
    sepolia: {
      url: process.env.ALCHEMY_SEPOLIA_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111, 
      gasPrice: "auto"
    },
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "D4XDJUTM685W846P2IITKZ3VHSNI9E9PTE",  // один ключ
  },
  sourcify: {
    enabled: true,
  },
}

export default config;
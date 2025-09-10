import { ethers } from 'ethers';

// Create and export a JSON-RPC provider that connects to an Ethereum node
export const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);

import { ethers } from 'ethers';

export class EthersProvider {
  private provider: ethers.Provider;
  private static instance: EthersProvider;

  constructor(rpcUrl?: string) {
    // Use public RPC endpoints as fallback
    const defaultRpcUrl = rpcUrl || 'https://eth.llamarpc.com';
    this.provider = new ethers.JsonRpcProvider(defaultRpcUrl);
  }

  static getInstance(rpcUrl?: string): EthersProvider {
    if (!EthersProvider.instance) {
      EthersProvider.instance = new EthersProvider(rpcUrl);
    }
    return EthersProvider.instance;
  }

  getProvider(): ethers.Provider {
    return this.provider;
  }

  async getContract(address: string, abi?: any[]): Promise<ethers.Contract | null> {
    try {
      if (!abi) {
        // Try to fetch ABI from Etherscan API if available
        // For now, return null if no ABI provided
        return null;
      }
      return new ethers.Contract(address, abi, this.provider);
    } catch (error) {
      console.error(`Error creating contract for ${address}:`, error);
      return null;
    }
  }

  async getCode(address: string): Promise<string> {
    try {
      return await this.provider.getCode(address);
    } catch (error) {
      console.error(`Error getting code for ${address}:`, error);
      return '0x';
    }
  }

  async getBalance(address: string): Promise<bigint> {
    try {
      return await this.provider.getBalance(address);
    } catch (error) {
      console.error(`Error getting balance for ${address}:`, error);
      return BigInt(0);
    }
  }

  async getTransactionCount(address: string): Promise<number> {
    try {
      return await this.provider.getTransactionCount(address);
    } catch (error) {
      console.error(`Error getting transaction count for ${address}:`, error);
      return 0;
    }
  }

  async getBlock(blockNumber: number | string): Promise<ethers.Block | null> {
    try {
      return await this.provider.getBlock(blockNumber);
    } catch (error) {
      console.error(`Error getting block ${blockNumber}:`, error);
      return null;
    }
  }

  async getTransaction(txHash: string): Promise<ethers.TransactionResponse | null> {
    try {
      return await this.provider.getTransaction(txHash);
    } catch (error) {
      console.error(`Error getting transaction ${txHash}:`, error);
      return null;
    }
  }
}
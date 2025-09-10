import { JsonRpcProvider } from 'ethers';

/**
 * Default RPC URLs for common networks
 */
export const RPC_URLS = {
  mainnet: 'https://eth.llamarpc.com',
  goerli: 'https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
  sepolia: 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
  polygon: 'https://polygon.llamarpc.com',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
} as const;

/**
 * Create and configure a JSON-RPC provider for Ethereum interactions
 * @param rpcUrl - The RPC endpoint URL (defaults to mainnet)
 * @returns Configured JsonRpcProvider instance
 */
export function createProvider(
  rpcUrl: string = RPC_URLS.mainnet,
): JsonRpcProvider {
  return new JsonRpcProvider(rpcUrl);
}

/**
 * Get a provider for a specific network
 * @param network - Network name
 * @returns Configured JsonRpcProvider instance
 */
export function getNetworkProvider(
  network: keyof typeof RPC_URLS,
): JsonRpcProvider {
  return createProvider(RPC_URLS[network]);
}

// Export a default mainnet provider
export const defaultProvider = createProvider();

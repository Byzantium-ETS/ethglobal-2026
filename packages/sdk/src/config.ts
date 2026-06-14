import * as dotenv from 'dotenv';
import * as path from 'node:path';

import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, sepolia } from 'viem/chains';
import { createEnsPublicClient, createEnsWalletClient } from '@ensdomains/ensjs';

// Load environment variables from the root directory
dotenv.config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

// Define the exact keys from your .env.example
const REQUIRED_ENV_VARS = [
  'RPC_URL',
  'DEMO_PRIVATE_KEY',
  'ARC_API_KEY',
  'ARC_RPC_URL',
  'WORLD_API_KEY',
  'WORLD_RPC_URL',
  'ENS_PARENT',
] as const;

type EnvVarName = typeof REQUIRED_ENV_VARS[number];

function validateEnv(): Record<EnvVarName, string> {
  const missing: string[] = [];
  const validatedConfig = {} as Record<EnvVarName, string>;

  for (const key of REQUIRED_ENV_VARS) {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      missing.push(key);
    } else {
      validatedConfig[key] = value;
    }
  }

  // Fail fast with a clear message
  if (missing.length > 0) {
    throw new Error(
      `\n❌ [AgentGate Config Error] Missing required environment variables:\n` +
      missing.map((v) => `   - ${v}`).join('\n') +
      `\nPlease update your local .env file.\n`
    );
  }

  return validatedConfig;
}

let validatedEnv: Record<EnvVarName, string> | null = null;

function getValidatedEnv(): Record<EnvVarName, string> {
  if (validatedEnv === null) {
    const nextEnv = validateEnv();
    validatedEnv = nextEnv;
    return nextEnv;
  }

  return validatedEnv;
}

// Export a strongly-typed, read-only configuration object
export const config = {
  get rpc() {
    const env = getValidatedEnv();
    return {
      standard: env.RPC_URL,
      arc: env.ARC_RPC_URL,
      world: env.WORLD_RPC_URL,
    };
  },
  get keys() {
    const env = getValidatedEnv();
    let pk = env.DEMO_PRIVATE_KEY;
    if (!pk.startsWith('0x')) {
      pk = '0x' + pk;
    }
    return {
      privateKey: pk,
      arcApi: env.ARC_API_KEY,
      worldApi: env.WORLD_API_KEY,
    };
  },
  get ens() {
    const env = getValidatedEnv();
    return {
      parent: env.ENS_PARENT,
    };
  },
};

/**
 * Returns viem clients (public/wallet) and ENS-specific clients from @ensdomains/ensjs,
 * wired to the RPC_URL and DEMO_PRIVATE_KEY from the environment via config.
 *
 * This is the implementation of the requirement:
 * "Create a viem/ethers provider wired to RPC_URL for ENS operations."
 *
 * - Auto-detects chain (Sepolia vs mainnet) from the RPC URL string.
 * - The wallet client is pre-configured with the account from the private key.
 * - Use ensPublicClient for reads (getOwner, getTextRecord, getResolver, ...).
 * - Use ensWalletClient for writes (setSubnodeOwner, setTextRecord, ...).
 */
function getChain(rpcUrl: string) {
  // Prefer explicit ENS_CHAIN for reliable detection (avoids brittle string matching on custom RPC URLs).
  // Falls back to RPC_URL heuristic for backward compatibility.
  const chainName = (process.env.ENS_CHAIN || '').toLowerCase();
  if (chainName === 'sepolia') return sepolia;
  if (chainName === 'mainnet') return mainnet;
  return rpcUrl.toLowerCase().includes('sepolia') ? sepolia : mainnet;
}

export function getEnsClients() {
  const rpcUrl = config.rpc.standard;
  const privateKey = config.keys.privateKey as `0x${string}`;

  const chain = getChain(rpcUrl) as any;
  const account = privateKeyToAccount(privateKey);

  // Raw viem clients
  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    chain,
    transport: http(rpcUrl),
    account,
  });

  // ENS-specific clients from @ensdomains/ensjs (preferred for registerSubname, text records, etc.)
  const ensPublicClient = createEnsPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  const ensWalletClient = createEnsWalletClient({
    chain,
    transport: http(rpcUrl),
    account,
  });

  return {
    publicClient: publicClient as any,
    walletClient: walletClient as any,
    ensPublicClient: ensPublicClient as any,
    ensWalletClient: ensWalletClient as any,
  };
}

export type Config = typeof config;

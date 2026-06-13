import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from the root directory
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

// Define the exact keys from your .env.example
const REQUIRED_ENV_VARS = [
  'RPC_URL',
  'DEMO_PRIVATE_KEY',
  'BUYER_PRIVATE_KEY',
  'SELLER_PRIVATE_KEY',
  'ARC_API_KEY',
  'ARC_RPC_URL',
  'WORLD_API_KEY',
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

const validatedEnv = validateEnv();

// Export a strongly-typed, read-only configuration object
export const config = {
  rpc: {
    standard: validatedEnv.RPC_URL,
    arc: validatedEnv.ARC_RPC_URL,
  },
  keys: {
    demoPrivate: validatedEnv.DEMO_PRIVATE_KEY,
    buyerPrivate: validatedEnv.BUYER_PRIVATE_KEY,
    sellerPrivate: validatedEnv.SELLER_PRIVATE_KEY,
    arcApi: validatedEnv.ARC_API_KEY,
    worldApi: validatedEnv.WORLD_API_KEY,
  },
  ens: {
    parent: validatedEnv.ENS_PARENT,
  },
} as const;

export type Config = typeof config;
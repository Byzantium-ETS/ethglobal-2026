import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from the root directory
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Define the exact keys from your .env.example
const REQUIRED_ENV_VARS = [
  'RPC_URL',
  'DEMO_PRIVATE_KEY',
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

let validatedEnv: Record<EnvVarName, string> | null = null;

function getValidatedEnv(): Record<EnvVarName, string> {
  if (!validatedEnv) {
    validatedEnv = validateEnv();
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
    };
  },
  get keys() {
    const env = getValidatedEnv();
    return {
      privateKey: env.DEMO_PRIVATE_KEY,
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

export type Config = typeof config;

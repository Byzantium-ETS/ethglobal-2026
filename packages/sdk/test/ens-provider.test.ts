import { describe, it, expect, beforeAll } from 'vitest';
import { getEnsClients } from '../src/config';
import { registerSubname, readTextRecords } from '../src/identity';

// Provide default env for non-network unit tests so they run in CI and provide coverage.
// Real integration tests can override with actual values.
beforeAll(() => {
  process.env.RPC_URL = process.env.RPC_URL || 'https://ethereum-sepolia.publicnode.com';
  process.env.DEMO_PRIVATE_KEY = process.env.DEMO_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000001';
  process.env.ENS_PARENT = process.env.ENS_PARENT || 'agentgate.eth';
  process.env.ENS_CHAIN = process.env.ENS_CHAIN || 'sepolia';
  // Set all required for config validation, even if not used by ENS provider
  process.env.ARC_API_KEY = process.env.ARC_API_KEY || 'dummy';
  process.env.ARC_RPC_URL = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network';
  process.env.WORLD_API_KEY = process.env.WORLD_API_KEY || 'dummy';
});

describe('ENS Provider (viem/ethers + ensjs clients wired to RPC_URL)', () => {
  it('should create the provider clients wired to the configured RPC_URL', () => {
    const clients = getEnsClients();

    expect(clients).toBeDefined();
    expect(clients.publicClient).toBeDefined();
    expect(clients.walletClient).toBeDefined();
    expect(clients.ensPublicClient).toBeDefined();
    expect(clients.ensWalletClient).toBeDefined();

    // The public/ens clients should report a chain (Sepolia in our dev setup).
    expect(clients.ensPublicClient.chain?.name).toBeDefined();
    expect(clients.ensPublicClient.chain?.name.toLowerCase()).toContain('sepolia');

    // Wallet account should be derived from DEMO_PRIVATE_KEY.
    expect(clients.ensWalletClient.account?.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it('identity functions obtain and use the wired ENS provider (no crash on access)', async () => {
    const parent = process.env.ENS_PARENT || 'agentgate.eth';
    const subname = 'test-provider-' + Date.now().toString(36);

    // These now internally call getEnsClients() and log usage of the provider.
    const registered = await registerSubname(parent, subname, '0x0000000000000000000000000000000000000001');
    expect(registered).toBe(`${subname}.${parent}`);

    const records = await readTextRecords(`${subname}.${parent}`);
    expect(records).toHaveProperty('description');
    expect(records).toHaveProperty('io.agentgate.x402-endpoint');
  });
});
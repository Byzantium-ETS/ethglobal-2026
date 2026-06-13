import { describe, it, expect } from 'vitest';
import { getEnsClients } from '../src/config';
import { registerSubname, readTextRecords } from '../src/identity';

// Only run when required env is present (matches pattern in deposit.test.ts).
// In CI (no .env), this describe is skipped so npm test still passes cleanly.
const hasRequiredEnv = !!(
  process.env.RPC_URL &&
  process.env.DEMO_PRIVATE_KEY &&
  process.env.ENS_PARENT
);

describe.skipIf(!hasRequiredEnv)('ENS Provider (viem/ethers + ensjs clients wired to RPC_URL)', () => {
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
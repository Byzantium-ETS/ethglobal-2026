import { beforeAll, describe, expect, it } from 'vitest';
import { parseAgentkitHeader, verifyAgentkitSignature } from '@worldcoin/agentkit';

let createAgentWallet: typeof import('../src/trust').createAgentWallet;
let verifyAgentWalletRegistration: typeof import('../src/trust').verifyAgentWalletRegistration;
let requestWorldProof: typeof import('../src/trust').requestWorldProof;

beforeAll(async () => {
  // Ensure config validation passes in local/CI runs without requiring private secrets.
  process.env.RPC_URL = process.env.RPC_URL || 'https://ethereum-sepolia.publicnode.com';
  process.env.DEMO_PRIVATE_KEY =
    process.env.DEMO_PRIVATE_KEY ||
    `0x${'59c6995e'.repeat(8)}`;
  process.env.ARC_API_KEY = process.env.ARC_API_KEY || 'dummy';
  process.env.ARC_RPC_URL = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network';
  process.env.WORLD_API_KEY = process.env.WORLD_API_KEY || 'dummy';
  process.env.WORLD_RPC_URL = process.env.WORLD_RPC_URL || 'https://worldchain-sepolia.g.alchemy.com/public';
  process.env.ENS_PARENT = process.env.ENS_PARENT || 'agentgate.eth';
  process.env.ENS_CHAIN = process.env.ENS_CHAIN || 'sepolia';

  const trust = await import('../src/trust');
  createAgentWallet = trust.createAgentWallet;
  verifyAgentWalletRegistration = trust.verifyAgentWalletRegistration;
  requestWorldProof = trust.requestWorldProof;
});

describe('trust module integration (real dependencies)', () => {
  it('creates an AgentKit client instance', async () => {
    const client = await createAgentWallet();
    expect(client).toBeDefined();
    expect(typeof client).toBe('object');
  });

  it('returns a registration status based on live AgentBook lookup', async () => {
    const address = '0x1111111111111111111111111111111111111111';
    const isRegistered = await verifyAgentWalletRegistration(address);
    expect(typeof isRegistered).toBe('boolean');
  });

  it('builds a signed and verifiable world proof payload', async () => {
    const result = await requestWorldProof('https://provider.example/call', 'integration-challenge');

    expect(result.success).toBe(true);
    expect(result.proof).toBeDefined();

    const payload = parseAgentkitHeader(result.proof!);
    expect(payload.domain).toBe('provider.example');
    expect(payload.uri).toBe('https://provider.example/call');
    expect(payload.statement).toBe('integration-challenge');
    expect(payload.chainId).toBe('eip155:8453');
    expect(payload.type).toBe('eip191');
    expect(typeof payload.nonce).toBe('string');
    expect(typeof payload.issuedAt).toBe('string');

    const verification = await verifyAgentkitSignature(payload);
    expect(verification.valid).toBe(true);
    expect(verification.address).toBe(payload.address);
  });
});

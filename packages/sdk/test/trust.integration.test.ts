import { beforeAll, describe, expect, it } from 'vitest';

let createAgentWallet: typeof import('../src/trust').createAgentWallet;
let registerAgentWallet: typeof import('../src/trust').registerAgentWallet;
let requestWorldProof: typeof import('../src/trust').requestWorldProof;

beforeAll(async () => {
  // Ensure config validation passes in local/CI runs without requiring private secrets.
  process.env.RPC_URL = process.env.RPC_URL || 'https://ethereum-sepolia.publicnode.com';
  process.env.DEMO_PRIVATE_KEY =
    process.env.DEMO_PRIVATE_KEY ||
    '0x59c6995e998f97a5a0044966f09453825f7f4f0f6eb1d3f8d0c96f2de0a6f3b4';
  process.env.ARC_API_KEY = process.env.ARC_API_KEY || 'dummy';
  process.env.ARC_RPC_URL = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network';
  process.env.WORLD_API_KEY = process.env.WORLD_API_KEY || 'dummy';
  process.env.ENS_PARENT = process.env.ENS_PARENT || 'agentgate.eth';
  process.env.ENS_CHAIN = process.env.ENS_CHAIN || 'sepolia';

  const trust = await import('../src/trust');
  createAgentWallet = trust.createAgentWallet;
  registerAgentWallet = trust.registerAgentWallet;
  requestWorldProof = trust.requestWorldProof;
});

describe('trust module integration (real dependencies)', () => {
  it('creates an AgentKit client instance', async () => {
    const client = await createAgentWallet();
    expect(client).toBeDefined();
    expect(typeof client).toBe('object');
  });

  it('returns demo-mode successful registration response', async () => {
    const address = '0x1111111111111111111111111111111111111111';
    const isRegistered = await registerAgentWallet(address);
    expect(isRegistered).toBe(true);
  });

  it('builds a decodable world proof payload', async () => {
    const result = await requestWorldProof('https://provider.example/call', 'integration-challenge');

    expect(result.success).toBe(true);
    expect(result.proof).toBeDefined();

    const decoded = JSON.parse(Buffer.from(result.proof!, 'base64').toString('utf-8'));
    expect(decoded.proofType).toBe('world-id-agent');
    expect(decoded.challenge).toBe('integration-challenge');
    expect(decoded.signature).toBe('0xMockSignatureForHackathon');
    expect(typeof decoded.timestamp).toBe('number');
  });
});

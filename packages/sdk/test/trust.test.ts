import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAgentkitClient: vi.fn(),
  privateKeyToAccount: vi.fn(),
}));

vi.mock('@worldcoin/agentkit', () => ({
  createAgentkitClient: mocks.createAgentkitClient,
}));

vi.mock('viem/accounts', () => ({
  privateKeyToAccount: mocks.privateKeyToAccount,
}));

vi.mock('../src/config', () => ({
  config: {
    keys: {
      privateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    },
  },
}));

const { createAgentWallet, registerAgentWallet, requestWorldProof } = await import('../src/trust');

describe('trust.createAgentWallet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an AgentKit client with an EIP-191 signer derived from config private key', async () => {
    const signMessage = vi.fn().mockResolvedValue('0xsigned');
    const account = {
      address: '0x1111111111111111111111111111111111111111',
      signMessage,
    };
    const client = { id: 'agent-client' };

    mocks.privateKeyToAccount.mockReturnValue(account);
    mocks.createAgentkitClient.mockResolvedValue(client);

    const result = await createAgentWallet();

    expect(result).toBe(client);
    expect(mocks.privateKeyToAccount).toHaveBeenCalledWith(
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    );
    expect(mocks.createAgentkitClient).toHaveBeenCalledWith(
      expect.objectContaining({
        signer: expect.objectContaining({
          address: account.address,
          chainId: 'eip155:8453',
          type: 'eip191',
        }),
      }),
    );

    const signer = mocks.createAgentkitClient.mock.calls[0][0].signer;
    await signer.signMessage('hello');
    expect(signMessage).toHaveBeenCalledWith({ message: 'hello' });
  });
});

describe('trust.registerAgentWallet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true for a wallet that is considered human-backed in demo mode', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await registerAgentWallet('0x1111111111111111111111111111111111111111');

    expect(result).toBe(true);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[AgentKit] Checking AgentBook status for 0x1111111111111111111111111111111111111111...',
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[AgentKit] Wallet 0x1111111111111111111111111111111111111111 is successfully human-backed.',
    );
  });
});

describe('trust.requestWorldProof', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a base64 encoded proof with the default challenge when none is provided', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await requestWorldProof('https://provider.example/call');

    expect(result.success).toBe(true);
    expect(result.proof).toBeDefined();

    const decoded = JSON.parse(Buffer.from(result.proof!, 'base64').toString('utf-8'));
    expect(decoded).toEqual(
      expect.objectContaining({
        proofType: 'world-id-agent',
        challenge: 'hackathon-challenge',
        signature: '0xMockSignatureForHackathon',
      }),
    );
    expect(typeof decoded.timestamp).toBe('number');
  });

  it('includes a custom challenge when provided', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await requestWorldProof('https://provider.example/call', 'custom-challenge');

    const decoded = JSON.parse(Buffer.from(result.proof!, 'base64').toString('utf-8'));
    expect(decoded.challenge).toBe('custom-challenge');
  });

  it('returns success false when proof generation fails', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const stringifySpy = vi.spyOn(JSON, 'stringify').mockImplementation(() => {
      throw new Error('serialize failed');
    });

    const result = await requestWorldProof('https://provider.example/call');

    expect(result).toEqual({ success: false });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[AgentKit] Failed to generate World Proof:',
      expect.any(Error),
    );

    stringifySpy.mockRestore();
  });
});

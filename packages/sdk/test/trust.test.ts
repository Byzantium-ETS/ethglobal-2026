import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAgentkitClient: vi.fn(),
  createAgentBookVerifier: vi.fn(),
  buildAgentkitSchema: vi.fn(),
  privateKeyToAccount: vi.fn(),
  isAddress: vi.fn(),
}));

vi.mock('@worldcoin/agentkit', () => ({
  createAgentkitClient: mocks.createAgentkitClient,
  createAgentBookVerifier: mocks.createAgentBookVerifier,
}));

vi.mock('@worldcoin/agentkit-core', () => ({
  buildAgentkitSchema: mocks.buildAgentkitSchema,
}));

vi.mock('viem/accounts', () => ({
  privateKeyToAccount: mocks.privateKeyToAccount,
}));

vi.mock('viem', () => ({
  isAddress: mocks.isAddress,
}));

vi.mock('../src/config', () => ({
  config: {
    rpc: {
      world: 'https://world-rpc.example',
    },
    keys: {
      privateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    },
  },
}));

const { createAgentWallet, verifyAgentWalletRegistration, requestWorldProof } = await import('../src/trust');

describe('trust.createAgentWallet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildAgentkitSchema.mockReturnValue({ type: 'object' });
    mocks.isAddress.mockReturnValue(true);
  });

  it('creates an AgentKit client with an EIP-191 signer derived from config private key', async () => {
    const signMessage = vi.fn().mockResolvedValue('0xsigned');
    const account = {
      address: '0x1111111111111111111111111111111111111111',
      signMessage,
    };
    const client = { id: 'agent-client', createHeader: vi.fn() };

    mocks.privateKeyToAccount.mockReturnValue(account);
    mocks.createAgentkitClient.mockReturnValue(client);

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

describe('trust.verifyAgentWalletRegistration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildAgentkitSchema.mockReturnValue({ type: 'object' });
  });

  it('returns true for a wallet that is present in AgentBook', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
    mocks.isAddress.mockReturnValue(true);
    const lookupHuman = vi.fn().mockResolvedValue('0xabc123');
    mocks.createAgentBookVerifier.mockReturnValue({ lookupHuman });

    const result = await verifyAgentWalletRegistration('0x1111111111111111111111111111111111111111');

    expect(result).toBe(true);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[AgentKit] Checking AgentBook status for 0x1111111111111111111111111111111111111111...',
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[AgentKit] Wallet 0x1111111111111111111111111111111111111111 is human-backed (humanId: 0xabc123).',
    );
  });

  it('returns false when wallet is not present in AgentBook', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
    mocks.isAddress.mockReturnValue(true);
    const lookupHuman = vi.fn().mockResolvedValue(null);
    mocks.createAgentBookVerifier.mockReturnValue({ lookupHuman });

    const result = await verifyAgentWalletRegistration('0x1111111111111111111111111111111111111111');

    expect(result).toBe(false);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[AgentKit] Wallet 0x1111111111111111111111111111111111111111 is not registered in AgentBook.',
    );
  });

  it('throws when address is invalid', async () => {
    mocks.isAddress.mockReturnValue(false);

    await expect(verifyAgentWalletRegistration('bad-address')).rejects.toThrow('[AgentKit] Invalid wallet address: bad-address');
    expect(mocks.createAgentBookVerifier).not.toHaveBeenCalled();
  });
});

describe('trust.requestWorldProof', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildAgentkitSchema.mockReturnValue({ type: 'object' });
    mocks.isAddress.mockReturnValue(true);
  });

  it('returns a signed agentkit header with the default statement when none is provided', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => { });
    const signMessage = vi.fn().mockResolvedValue('0xsigned');
    const createHeader = vi.fn().mockResolvedValue('encoded-header');
    mocks.privateKeyToAccount.mockReturnValue({
      address: '0x1111111111111111111111111111111111111111',
      signMessage,
    });
    mocks.createAgentkitClient.mockReturnValue({ createHeader });

    const result = await requestWorldProof('https://provider.example/call');

    expect(result).toEqual({ success: true, proof: 'encoded-header' });
    expect(createHeader).toHaveBeenCalledTimes(1);
    expect(createHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        info: expect.objectContaining({
          domain: 'provider.example',
          uri: 'https://provider.example/call',
          statement: 'Verify your agent is backed by a real human',
          version: '1',
          resources: ['https://provider.example/call'],
        }),
        supportedChains: [{ chainId: 'eip155:8453', type: 'eip191' }],
        schema: { type: 'object' },
      }),
    );

    const extension = createHeader.mock.calls[0][0];
    expect(typeof extension.info.nonce).toBe('string');
    expect(extension.info.nonce.length).toBe(32);
    expect(typeof extension.info.issuedAt).toBe('string');
    expect(typeof extension.info.expirationTime).toBe('string');
  });

  it('includes a custom statement when provided', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => { });
    const createHeader = vi.fn().mockResolvedValue('encoded-header');
    mocks.privateKeyToAccount.mockReturnValue({
      address: '0x1111111111111111111111111111111111111111',
      signMessage: vi.fn().mockResolvedValue('0xsigned'),
    });
    mocks.createAgentkitClient.mockReturnValue({ createHeader });

    const result = await requestWorldProof('https://provider.example/call', 'custom-challenge');

    expect(result.success).toBe(true);
    expect(createHeader.mock.calls[0][0].info.statement).toBe('custom-challenge');
  });

  it('returns success false when proof generation fails', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => { });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    const createHeader = vi.fn().mockRejectedValue(new Error('header failed'));
    mocks.privateKeyToAccount.mockReturnValue({
      address: '0x1111111111111111111111111111111111111111',
      signMessage: vi.fn().mockResolvedValue('0xsigned'),
    });
    mocks.createAgentkitClient.mockReturnValue({ createHeader });

    const result = await requestWorldProof('https://provider.example/call');

    expect(result).toEqual({ success: false });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[AgentKit] Failed to generate World Proof:',
      expect.any(Error),
    );
  });
});

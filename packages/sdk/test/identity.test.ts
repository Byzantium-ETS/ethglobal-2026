import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sepolia } from 'viem/chains';
import type { Account, Chain } from 'viem';

const mocks = vi.hoisted(() => ({
  addEnsContracts: vi.fn(),
  createEnsPublicClient: vi.fn(),
  createEnsWalletClient: vi.fn(),
  createSubname: vi.fn(),
  getSubnames: vi.fn(),
  createPublicClient: vi.fn(),
  http: vi.fn(),
  publicClient: {
    getChainId: vi.fn(),
    waitForTransactionReceipt: vi.fn(),
  },
  ensPublicClient: {
    getOwner: vi.fn(),
    getTextRecord: vi.fn(),
  },
}));

vi.mock('@ensdomains/ensjs', () => ({
  addEnsContracts: mocks.addEnsContracts,
  createEnsPublicClient: mocks.createEnsPublicClient,
  createEnsWalletClient: mocks.createEnsWalletClient,
}));

vi.mock('@ensdomains/ensjs/wallet', () => ({
  createSubname: mocks.createSubname,
}));

vi.mock('@ensdomains/ensjs/subgraph', () => ({
  getSubnames: mocks.getSubnames,
}));

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem');
  return {
    ...actual,
    createPublicClient: mocks.createPublicClient,
    http: mocks.http,
  };
});

const { discoverAgents, readAgentMetadata, readTextRecords, registerSubname } = await import('../src/identity');

const rpcUrl = 'https://rpc.test';
const signer = { address: '0x1111111111111111111111111111111111111111' } as Account;
const ownerAddress = '0x2222222222222222222222222222222222222222';
const otherAddress = '0x3333333333333333333333333333333333333333';

function setOwnership(existingSubnameOwner?: string | null, parentOwner = signer.address) {
  mocks.ensPublicClient.getOwner.mockImplementation(async ({ name }: { name: string }) => {
    if (name === 'agentgate.eth') {
      return {
        owner: parentOwner,
        ownershipLevel: 'registrar',
      };
    }

    if (name === 'my-agent.agentgate.eth' && existingSubnameOwner) {
      return {
        owner: existingSubnameOwner,
        ownershipLevel: 'registry',
      };
    }

    return null;
  });
}

describe('identity.registerSubname', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.http.mockImplementation((url?: string) => ({ url }));
    mocks.createPublicClient.mockReturnValue(mocks.publicClient);
    mocks.publicClient.getChainId.mockResolvedValue(sepolia.id);
    mocks.publicClient.waitForTransactionReceipt.mockResolvedValue({ status: 'success' });

    mocks.addEnsContracts.mockImplementation((chain: Chain) => ({
      ...chain,
      contracts: {},
      subgraphs: {},
    }));
    mocks.createEnsPublicClient.mockReturnValue(mocks.ensPublicClient);
    mocks.createEnsWalletClient.mockImplementation((clientConfig) => ({
      ...clientConfig,
      walletClient: true,
    }));
    mocks.createSubname.mockResolvedValue('0xabc123');

    setOwnership(null);
  });

  it('normalizes inputs and creates a registry subname on the detected ENS chain', async () => {
    const result = await registerSubname(' AgentGate.ETH. ', ' My-Agent ', ownerAddress, signer, { rpcUrl });

    expect(result).toEqual({
      name: 'my-agent.agentgate.eth',
      txHash: '0xabc123',
      status: 'created',
    });
    expect(mocks.publicClient.getChainId).toHaveBeenCalledTimes(1);
    expect(mocks.addEnsContracts).toHaveBeenCalledWith(expect.objectContaining({ id: sepolia.id }));
    expect(mocks.createEnsWalletClient).toHaveBeenCalledWith(expect.objectContaining({ account: signer }));
    expect(mocks.createSubname).toHaveBeenCalledWith(
      expect.objectContaining({ walletClient: true }),
      {
        name: 'my-agent.agentgate.eth',
        owner: ownerAddress,
        contract: 'registry',
      },
    );
    expect(mocks.publicClient.waitForTransactionReceipt).toHaveBeenCalledWith({ hash: '0xabc123' });
  });

  it('uses nameWrapper when the parent is wrapped', async () => {
    mocks.ensPublicClient.getOwner.mockImplementation(async ({ name }: { name: string }) => {
      if (name === 'agentgate.eth') {
        return {
          owner: signer.address,
          ownershipLevel: 'nameWrapper',
        };
      }
      return null;
    });

    await registerSubname('agentgate.eth', 'my-agent', ownerAddress, signer, { rpcUrl });

    expect(mocks.createSubname).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ contract: 'nameWrapper' }),
    );
  });

  it('does not send a transaction when the subname already belongs to the requested owner', async () => {
    setOwnership(ownerAddress);

    const result = await registerSubname('agentgate.eth', 'my-agent', ownerAddress, signer, { rpcUrl });

    expect(result).toEqual({
      name: 'my-agent.agentgate.eth',
      txHash: null,
      status: 'already-owned',
    });
    expect(mocks.createSubname).not.toHaveBeenCalled();
    expect(mocks.publicClient.waitForTransactionReceipt).not.toHaveBeenCalled();
  });

  it('throws when the subname is already owned by someone else', async () => {
    setOwnership(otherAddress);

    await expect(registerSubname('agentgate.eth', 'my-agent', ownerAddress, signer, { rpcUrl })).rejects.toThrow(
      'already exists and is owned',
    );
    expect(mocks.createSubname).not.toHaveBeenCalled();
  });

  it('throws when the signer does not control the parent', async () => {
    setOwnership(null, otherAddress);

    await expect(registerSubname('agentgate.eth', 'my-agent', ownerAddress, signer, { rpcUrl })).rejects.toThrow(
      'does not control parent',
    );
    expect(mocks.createSubname).not.toHaveBeenCalled();
  });

  it('throws when the parent does not exist on-chain', async () => {
    mocks.ensPublicClient.getOwner.mockResolvedValue(null);

    await expect(registerSubname('agentgate.eth', 'my-agent', ownerAddress, signer, { rpcUrl })).rejects.toThrow(
      'has no owner on-chain',
    );
    expect(mocks.createSubname).not.toHaveBeenCalled();
  });

  it('throws when the registration transaction reverts', async () => {
    mocks.publicClient.waitForTransactionReceipt.mockResolvedValue({ status: 'reverted' });

    await expect(registerSubname('agentgate.eth', 'my-agent', ownerAddress, signer, { rpcUrl })).rejects.toThrow(
      'transaction reverted',
    );
  });

  it('validates parent, label, owner address, and signer before sending a transaction', async () => {
    await expect(registerSubname('agentgate', 'my-agent', ownerAddress, signer, { rpcUrl })).rejects.toThrow(
      'must include a TLD',
    );
    await expect(registerSubname('agentgate.eth', 'bad.label', ownerAddress, signer, { rpcUrl })).rejects.toThrow(
      'must be a single label',
    );
    await expect(registerSubname('agentgate.eth', 'bad_label', ownerAddress, signer, { rpcUrl })).rejects.toThrow(
      'may only include letters',
    );
    await expect(registerSubname('agentgate.eth', 'my-agent', 'not-an-address' as any, signer, { rpcUrl })).rejects.toThrow(
      'not a valid EVM address',
    );
    await expect(registerSubname('agentgate.eth', 'my-agent', ownerAddress, {} as Account, { rpcUrl })).rejects.toThrow(
      'signer must be a valid',
    );
    expect(mocks.createSubname).not.toHaveBeenCalled();
  });

  it('throws clearly when the RPC chain is not configured as an ENS chain', async () => {
    mocks.publicClient.getChainId.mockResolvedValue(999999);

    await expect(registerSubname('agentgate.eth', 'my-agent', ownerAddress, signer, { rpcUrl })).rejects.toThrow(
      'Unsupported ENS chain id 999999',
    );
    expect(mocks.createSubname).not.toHaveBeenCalled();
  });

  it('uses an explicit chain without probing the RPC chain id', async () => {
    await registerSubname('agentgate.eth', 'my-agent', ownerAddress, signer, {
      rpcUrl,
      chain: sepolia,
    });

    expect(mocks.publicClient.getChainId).not.toHaveBeenCalled();
    expect(mocks.addEnsContracts).toHaveBeenCalledWith(expect.objectContaining({ id: sepolia.id }));
  });
});

describe('identity.readTextRecords', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.http.mockImplementation((url?: string) => ({ url }));
    mocks.createPublicClient.mockReturnValue(mocks.publicClient);
    mocks.publicClient.getChainId.mockResolvedValue(sepolia.id);
    mocks.addEnsContracts.mockImplementation((chain: Chain) => ({
      ...chain,
      contracts: {},
      subgraphs: {},
    }));
    mocks.createEnsPublicClient.mockReturnValue(mocks.ensPublicClient);

    mocks.ensPublicClient.getTextRecord.mockImplementation(async ({ key }: { key: string }) => {
      const records: Record<string, string | null> = {
        description: 'AgentGate demo provider',
        'io.agentgate.capabilities': '["summarize","search"]',
        'io.agentgate.x402-endpoint': 'https://provider.example/call',
        'io.agentgate.x402-price': '0.001',
        'io.agentgate.world-verified': 'true',
      };
      return records[key] ?? null;
    });
  });

  it('reads all AgentGate text records and returns a key/value object', async () => {
    const records = await readTextRecords(' My-Agent.AgentGate.ETH. ', { rpcUrl });

    expect(records).toEqual({
      description: 'AgentGate demo provider',
      'io.agentgate.capabilities': '["summarize","search"]',
      'io.agentgate.x402-endpoint': 'https://provider.example/call',
      'io.agentgate.x402-price': '0.001',
      'io.agentgate.world-verified': 'true',
    });
    expect(mocks.ensPublicClient.getTextRecord).toHaveBeenCalledTimes(5);
    expect(mocks.ensPublicClient.getTextRecord).toHaveBeenCalledWith({
      name: 'my-agent.agentgate.eth',
      key: 'description',
    });
  });

  it('omits missing or empty text records', async () => {
    mocks.ensPublicClient.getTextRecord.mockImplementation(async ({ key }: { key: string }) => {
      if (key === 'io.agentgate.x402-endpoint') return 'https://provider.example/call';
      if (key === 'io.agentgate.x402-price') return '';
      return null;
    });

    await expect(readTextRecords('', { rpcUrl })).rejects.toThrow('name is required');

    const records = await readTextRecords('my-agent.agentgate.eth', { rpcUrl });
    expect(records).toEqual({
      'io.agentgate.x402-endpoint': 'https://provider.example/call',
    });
  });
});

describe('identity.readAgentMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.http.mockImplementation((url?: string) => ({ url }));
    mocks.createPublicClient.mockReturnValue(mocks.publicClient);
    mocks.publicClient.getChainId.mockResolvedValue(sepolia.id);
    mocks.addEnsContracts.mockImplementation((chain: Chain) => ({
      ...chain,
      contracts: {},
      subgraphs: {},
    }));
    mocks.createEnsPublicClient.mockReturnValue(mocks.ensPublicClient);
    mocks.ensPublicClient.getTextRecord.mockImplementation(async ({ key }: { key: string }) => {
      const records: Record<string, string | null> = {
        description: 'AgentGate demo provider',
        'io.agentgate.capabilities': '["summarize","search"]',
        'io.agentgate.x402-endpoint': 'https://provider.example/call',
        'io.agentgate.x402-price': '0.001',
        'io.agentgate.world-verified': 'true',
      };
      return records[key] ?? null;
    });
  });

  it('returns structured metadata from AgentGate text records', async () => {
    const metadata = await readAgentMetadata(' My-Agent.AgentGate.ETH. ', { rpcUrl });

    expect(metadata).toEqual({
      name: 'my-agent.agentgate.eth',
      description: 'AgentGate demo provider',
      capabilities: ['summarize', 'search'],
      x402Endpoint: 'https://provider.example/call',
      x402Price: '0.001',
      worldVerified: true,
      records: {
        description: 'AgentGate demo provider',
        'io.agentgate.capabilities': '["summarize","search"]',
        'io.agentgate.x402-endpoint': 'https://provider.example/call',
        'io.agentgate.x402-price': '0.001',
        'io.agentgate.world-verified': 'true',
      },
    });
  });
});

describe('identity.discoverAgents', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.http.mockImplementation((url?: string) => ({ url }));
    mocks.createPublicClient.mockReturnValue(mocks.publicClient);
    mocks.publicClient.getChainId.mockResolvedValue(sepolia.id);
    mocks.addEnsContracts.mockImplementation((chain: Chain) => ({
      ...chain,
      contracts: {},
      subgraphs: {},
    }));
    mocks.createEnsPublicClient.mockReturnValue(mocks.ensPublicClient);
    mocks.getSubnames.mockResolvedValue([
      { name: 'alpha.agentgate.eth' },
      { name: 'beta.agentgate.eth' },
    ]);
    mocks.ensPublicClient.getTextRecord.mockImplementation(
      async ({ name, key }: { name: string; key: string }) => {
        const recordsByName: Record<string, Record<string, string | null>> = {
          'alpha.agentgate.eth': {
            description: 'Alpha agent',
            'io.agentgate.capabilities': '["summarize"]',
            'io.agentgate.x402-endpoint': 'https://alpha.example/call',
            'io.agentgate.x402-price': '0.001',
            'io.agentgate.world-verified': 'true',
          },
          'beta.agentgate.eth': {
            description: 'Beta agent',
            'io.agentgate.capabilities': 'search,translate',
            'io.agentgate.x402-endpoint': 'https://beta.example/call',
            'io.agentgate.x402-price': '0.002',
            'io.agentgate.world-verified': 'false',
          },
        };
        return recordsByName[name]?.[key] ?? null;
      },
    );
  });

  it('discovers subnames and returns structured agent metadata', async () => {
    const agents = await discoverAgents(' AgentGate.ETH. ', { rpcUrl, pageSize: 25 });

    expect(mocks.getSubnames).toHaveBeenCalledWith(expect.anything(), {
      name: 'agentgate.eth',
      pageSize: 25,
    });
    expect(agents).toEqual([
      expect.objectContaining({
        name: 'alpha.agentgate.eth',
        description: 'Alpha agent',
        capabilities: ['summarize'],
        x402Endpoint: 'https://alpha.example/call',
        x402Price: '0.001',
        worldVerified: true,
      }),
      expect.objectContaining({
        name: 'beta.agentgate.eth',
        description: 'Beta agent',
        capabilities: ['search', 'translate'],
        x402Endpoint: 'https://beta.example/call',
        x402Price: '0.002',
        worldVerified: false,
      }),
    ]);
  });
});

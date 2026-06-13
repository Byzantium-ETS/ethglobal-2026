import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { closeServer, readJson, serverUrl } from './lib/http';
import { loadFresh, requireActual } from './lib/module';

type AgentkitModule = typeof import('@worldcoin/agentkit');
type ServerModule = {
  app: import('express').Express;
};

const ANVIL_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

async function getLocalChainId(): Promise<number> {
  const rpcUrl = process.env.ANVIL_RPC_URL ?? 'http://127.0.0.1:8545';
  const client = createPublicClient({ transport: http(rpcUrl) });
  const chainId = await client.getChainId();
  assert.equal(chainId, 31337, `[world-smoke] expected local chain id 31337, got ${chainId}`);
  process.env.WORLD_RPC_URL = rpcUrl;
  return chainId;
}

function loadAppWithMockedAgentBook(actualAgentkit: AgentkitModule): ServerModule {
  const serverDir = path.resolve(process.cwd(), 'packages/server/dist');
  const indexPath = path.join(serverDir, 'index.js');
  const worldPath = path.join(serverDir, 'worldMiddleware.js');
  const x402Path = path.join(serverDir, 'x402Middleware.js');
  const trialPath = path.join(serverDir, 'trialStore.js');

  process.env.NODE_ENV = 'test';
  process.env.FREE_TRIAL_LIMIT = '1';

  return loadFresh<ServerModule>(
    indexPath,
    {
      '@worldcoin/agentkit': {
        ...actualAgentkit,
        createAgentBookVerifier: () => ({
          lookupHuman: async () => 'human-smoke',
        }),
      },
      './x402Middleware': {
        x402Middleware: (_req: any, res: any) => {
          res.status(402).json({ status: 'payment_required', challenge: true });
        },
      },
    },
    [indexPath, worldPath, x402Path, trialPath],
  );
}

async function createAgentkitHeader(actualAgentkit: AgentkitModule, resourceUri: string, chainId: number): Promise<string> {
  const account = privateKeyToAccount(ANVIL_PRIVATE_KEY);
  const client = actualAgentkit.createAgentkitClient({
    signer: {
      address: account.address,
      chainId: `eip155:${chainId}`,
      type: 'eip191',
      signMessage: (message) => account.signMessage({ message }),
    },
  });

  return client.createHeader({
    info: {
      domain: new URL(resourceUri).hostname,
      uri: resourceUri,
      statement: 'AgentGate local World trust smoke',
      version: '1',
      nonce: randomBytes(8).toString('hex'),
      issuedAt: new Date().toISOString(),
      expirationTime: new Date(Date.now() + 5 * 60_000).toISOString(),
      resources: [resourceUri],
    },
    supportedChains: [{ chainId: `eip155:${chainId}`, type: 'eip191' }],
    schema: actualAgentkit.buildAgentkitSchema(),
  });
}

async function main(): Promise<void> {
  const chainId = await getLocalChainId();
  const actualAgentkit = requireActual<AgentkitModule>('@worldcoin/agentkit');
  const { app } = loadAppWithMockedAgentBook(actualAgentkit);
  const server = app.listen(0);

  try {
    const callUrl = serverUrl(server, '/call');
    const header = await createAgentkitHeader(actualAgentkit, callUrl, chainId);

    const response = await readJson<any>(await fetch(callUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        agentkit: header,
      },
      body: JSON.stringify({ prompt: 'world smoke' }),
    }));

    assert.equal(response.status, 200);
    assert.equal(response.body.status, 'free_trial');
    assert.equal(response.body.identity, 'human-smoke');
    assert.equal(response.body.remaining, 0);

    console.log('[world-smoke] OK: real AgentKit header verified and free-trial counter decremented');
  } finally {
    await closeServer(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
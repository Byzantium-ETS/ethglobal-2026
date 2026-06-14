import assert from 'node:assert/strict';
import path from 'node:path';
import { createPublicClient, http } from 'viem';
import { PaymentsClient } from '../../packages/sdk/src/payments';
import { closeServer, readJson, serverUrl } from './lib/http';
import { loadFresh } from './lib/module';

type ServerModule = {
  app: import('express').Express;
};

const ANVIL_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

async function assertAnvil(): Promise<void> {
  const rpcUrl = process.env.ANVIL_RPC_URL ?? 'http://127.0.0.1:8545';
  const client = createPublicClient({ transport: http(rpcUrl) });
  const chainId = await client.getChainId();

  assert.equal(chainId, 31337, `[anvil-smoke] expected local chain id 31337, got ${chainId}`);
  console.log(`[anvil-smoke] connected to local Anvil at ${rpcUrl}`);
}

function loadApp(): ServerModule {
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
      './worldMiddleware': {
        worldMiddleware: (req: any, _res: any, next: () => void) => {
          req.worldIdentity = req.header('agentkit') === 'local-human' ? 'local-human' : null;
          next();
        },
      },
      './x402Middleware': {
        x402Middleware: (req: any, res: any, next: () => void) => {
          const token = req.header('payment-signature') ?? req.header('x-payment');
          if (!token) {
            res.status(402).json({ status: 'payment_required', challenge: true });
            return;
          }

          req.paymentMetadata = {
            scheme: 'exact',
            token,
            network: 'eip155:5042002',
          };
          next();
        },
      },
    },
    [indexPath, worldPath, x402Path, trialPath],
  );
}

async function main(): Promise<void> {
  await assertAnvil();

  const paymentClient = new PaymentsClient({ privateKey: ANVIL_PRIVATE_KEY });
  const paymentHeader = await paymentClient.payForCall('http://127.0.0.1:3000/call', '0.001');
  assert.ok(paymentHeader.length > 0, '[anvil-smoke] expected deterministic x402 payment header');

  const { app } = loadApp();
  const server = app.listen(0);

  try {
    const callUrl = serverUrl(server, '/call');

    const unpaid = await readJson(await fetch(callUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'unpaid smoke' }),
    }));
    assert.equal(unpaid.status, 402);
    assert.deepEqual(unpaid.body, { status: 'payment_required', challenge: true });

    const free = await readJson<any>(await fetch(callUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', agentkit: 'local-human' },
      body: JSON.stringify({ prompt: 'free smoke' }),
    }));
    assert.equal(free.status, 200);
    assert.equal(free.body.status, 'free_trial');
    assert.equal(free.body.remaining, 0);

    const paid = await readJson<any>(await fetch(callUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'payment-signature': paymentHeader,
      },
      body: JSON.stringify({ prompt: 'paid smoke' }),
    }));
    assert.equal(paid.status, 200);
    assert.equal(paid.body.status, 'paid');
    assert.equal(paid.body.payment.token, paymentHeader);

    console.log('[anvil-smoke] OK: deterministic unpaid, free-trial, and paid server paths passed');
  } finally {
    await closeServer(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
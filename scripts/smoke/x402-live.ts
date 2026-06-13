import assert from 'node:assert/strict';
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { parseUnits } from 'viem';
import { PaymentsClient } from '../../packages/sdk/src/payments';
import { closeServer, readJson, serverUrl } from './lib/http';
import { loadFresh } from './lib/module';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

type ServerModule = {
  startServer: (port?: number) => import('node:http').Server;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') throw new Error(`[x402-smoke] missing ${name}`);
  return value.trim();
}

function buyerPrivateKey(): `0x${string}` {
  const configured = process.env.BUYER_PRIVATE_KEY ?? process.env.DEMO_PRIVATE_KEY;
  if (!configured) throw new Error('[x402-smoke] missing BUYER_PRIVATE_KEY or DEMO_PRIVATE_KEY');
  return (configured.startsWith('0x') ? configured : `0x${configured}`) as `0x${string}`;
}

function loadServer(): ServerModule {
  const serverDir = path.resolve(process.cwd(), 'packages/server/dist');
  return loadFresh<ServerModule>(path.join(serverDir, 'index.js'), {}, [
    path.join(serverDir, 'index.js'),
    path.join(serverDir, 'sellerConfig.js'),
    path.join(serverDir, 'x402Middleware.js'),
  ]);
}

async function main(): Promise<void> {
  if (process.env.RUN_LIVE_X402_SMOKE !== 'true') {
    console.log('[x402-smoke] skipped: set RUN_LIVE_X402_SMOKE=true to spend live Gateway balance');
    return;
  }

  process.env.CIRCLE_API_KEY = process.env.CIRCLE_API_KEY ?? process.env.ARC_API_KEY;
  required('ARC_RPC_URL');
  required('SELLER_ADDRESS');
  required('CIRCLE_API_KEY');

  let server: import('node:http').Server | undefined;
  let callUrl = process.env.AGENTGATE_PROVIDER_URL;

  if (!callUrl) {
    const { startServer } = loadServer();
    server = startServer(0);
    callUrl = serverUrl(server, '/call');
  }

  try {
    const unpaid = await readJson(await fetch(callUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'x402 unpaid smoke' }),
    }));
    assert.equal(unpaid.status, 402, `[x402-smoke] expected unpaid call to return 402, got ${unpaid.status}`);

    const client = new PaymentsClient({
      privateKey: buyerPrivateKey(),
      rpcUrl: required('ARC_RPC_URL'),
    });
    const balances = await client.getBalances();
    const requiredAmount = BigInt(process.env.CALL_PRICE ?? '1000');
    assert.ok(
      balances.gateway.available >= requiredAmount,
      `[x402-smoke] Gateway balance ${balances.gateway.available} is below required ${requiredAmount}. Deposit at least ${parseUnits('0.001', 6)} atomic USDC before running.`,
    );

    const paidResponse = await client.pay(callUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'x402 paid smoke' }),
    });
    const paid = await readJson<any>(paidResponse);

    assert.equal(paid.status, 200);
    assert.equal(paid.body.status, 'paid');
    assert.ok(paid.body.payment, '[x402-smoke] expected payment metadata in paid response');

    console.log('[x402-smoke] OK: unpaid call returned 402 and funded paid call succeeded');
  } finally {
    if (server) await closeServer(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
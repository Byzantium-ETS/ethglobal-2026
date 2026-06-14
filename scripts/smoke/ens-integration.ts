import assert from 'node:assert/strict';
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { addEnsContracts, createEnsPublicClient } from '@ensdomains/ensjs';
import { createPublicClient, http, isAddress, type Address, type Chain } from 'viem';
import { holesky, sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readAgentMetadata, registerSubname, setAgentMetadata } from '../../packages/sdk/src/identity';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

const TESTNET_CHAINS: Record<number, Chain> = {
  [sepolia.id]: sepolia,
  [holesky.id]: holesky,
};

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') throw new Error(`[ens-smoke] missing ${name}`);
  return value.trim();
}

function normalizePrivateKey(value: string): `0x${string}` {
  return (value.startsWith('0x') ? value : `0x${value}`) as `0x${string}`;
}

async function detectTestnetChain(rpcUrl: string): Promise<Chain> {
  const publicClient = createPublicClient({ transport: http(rpcUrl) });
  const chainId = await publicClient.getChainId();
  const chain = TESTNET_CHAINS[chainId];
  if (!chain) {
    throw new Error(`[ens-smoke] expected Sepolia or Holesky testnet RPC, got chain id ${chainId}`);
  }
  return chain;
}

async function main(): Promise<void> {
  if (process.env.RUN_LIVE_ENS_SMOKE !== 'true') {
    console.log('[ens-smoke] skipped: set RUN_LIVE_ENS_SMOKE=true to register/write ENS records on testnet');
    return;
  }

  const rpcUrl = required('RPC_URL');
  const parentName = required('ENS_PARENT');
  const account = privateKeyToAccount(normalizePrivateKey(required('DEMO_PRIVATE_KEY')));
  const chain = addEnsContracts(await detectTestnetChain(rpcUrl));
  const resolverAddress = process.env.ENS_RESOLVER_ADDRESS?.trim() as Address | undefined;

  if (resolverAddress && !isAddress(resolverAddress)) {
    throw new Error(`[ens-smoke] ENS_RESOLVER_ADDRESS is not a valid EVM address: ${resolverAddress}`);
  }

  const ensPublicClient = createEnsPublicClient({ chain, transport: http(rpcUrl) });
  const parentOwner = await ensPublicClient.getOwner({ name: parentName });
  assert.ok(parentOwner?.owner, `[ens-smoke] parent ${parentName} has no owner on ${chain.name}`);
  console.log(`[ens-smoke] parent ${parentName} owner: ${parentOwner.owner}`);

  const label = process.env.ENS_SMOKE_LABEL ?? `agentgate-smoke-${Date.now().toString(36)}`;
  const registration = await registerSubname(parentName, label, account.address, account, {
    rpcUrl,
    chain,
    ...(resolverAddress ? { resolverAddress } : {}),
  });

  const endpoint = process.env.ENS_SMOKE_X402_ENDPOINT ?? 'http://localhost:3000/call';
  const price = process.env.ENS_SMOKE_X402_PRICE ?? '0.001';
  const metadataRecords = {
    description: 'AgentGate ENS integration smoke provider',
    'io.agentgate.capabilities': ['smoke-test', 'phase-3'],
    'io.agentgate.x402-endpoint': endpoint,
    'io.agentgate.x402-price': price,
    'io.agentgate.world-verified': true,
  } as const;

  const write = await setAgentMetadata(registration.name, metadataRecords, account, {
    rpcUrl,
    chain,
    ...(resolverAddress ? { resolverAddress } : {}),
  });

  const metadata = await readAgentMetadata(registration.name, { rpcUrl, chain });
  assert.equal(metadata.name, registration.name);
  assert.equal(metadata.description, metadataRecords.description);
  assert.deepEqual(metadata.capabilities, ['smoke-test', 'phase-3']);
  assert.equal(metadata.x402Endpoint, endpoint);
  assert.equal(metadata.x402Price, price);
  assert.equal(metadata.worldVerified, true);

  console.log(`[ens-smoke] OK: ${registration.name}`);
  console.log(`[ens-smoke] registration: ${registration.status} ${registration.txHash ?? '(already owned)'}`);
  console.log(`[ens-smoke] metadata tx: ${write.txHash}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
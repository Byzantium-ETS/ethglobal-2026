import { addEnsContracts, createEnsPublicClient, createEnsWalletClient } from '@ensdomains/ensjs';
import { createSubname } from '@ensdomains/ensjs/wallet';
import { createPublicClient, http, isAddress, type Account, type Address, type Chain, type Hash } from 'viem';
import { holesky, mainnet, sepolia } from 'viem/chains';
import { config } from './config';

const SUPPORTED_ENS_CHAINS: Record<number, Chain> = {
  [mainnet.id]: mainnet,
  [sepolia.id]: sepolia,
  [holesky.id]: holesky,
};

const AGENTGATE_TEXT_KEYS = [
  'description',
  'io.agentgate.capabilities',
  'io.agentgate.x402-endpoint',
  'io.agentgate.x402-price',
  'io.agentgate.world-verified',
] as const;

export interface RegisterSubnameOptions {
  /** RPC endpoint for the ENS network. Defaults to `RPC_URL` from config. */
  rpcUrl?: string;
  /** ENS-enabled viem chain. When omitted, the chain is detected from `rpcUrl`. */
  chain?: Chain;
  /** Resolver to attach to the created subname. Defaults to the public resolver for the chain. */
  resolverAddress?: Address;
}

export interface ReadTextRecordOptions {
  /** RPC endpoint for the ENS network. Defaults to `RPC_URL` from config. */
  rpcUrl?: string;
  /** ENS-enabled viem chain. When omitted, the chain is detected from `rpcUrl`. */
  chain?: Chain;
}

export interface RegisterSubnameResult {
  /** Fully qualified ENS subname, for example `my-agent.agentgate.eth`. */
  name: string;
  /** Transaction hash for new registrations; `null` when the subname already belonged to `ownerAddress`. */
  txHash: Hash | null;
  /** Whether the helper created the subname or returned an already-owned idempotent result. */
  status: 'created' | 'already-owned';
}

function normalizeParentName(parentName: string): string {
  const normalized = parentName.trim().toLowerCase().replace(/\.+$/, '');
  if (!normalized) throw new Error('[ENS Identity] parentName is required');
  if (!normalized.includes('.')) {
    throw new Error(`[ENS Identity] parentName "${parentName}" must include a TLD (example: agentgate.eth)`);
  }
  return normalized;
}

function normalizeLabel(label: string): string {
  const normalized = label.trim().toLowerCase();
  if (!normalized) throw new Error('[ENS Identity] label is required');
  if (normalized.includes('.')) {
    throw new Error(`[ENS Identity] label "${label}" must be a single label (no dots)`);
  }
  if (!/^[a-z0-9-]+$/.test(normalized)) {
    throw new Error(`[ENS Identity] label "${label}" may only include letters, numbers, and hyphens`);
  }
  return normalized;
}

async function resolveEnsChain(chain: Chain | undefined, rpcUrl: string): Promise<Chain> {
  if (chain) return chain;

  const probeClient = createPublicClient({ transport: http(rpcUrl) });
  const chainId = await probeClient.getChainId();
  const supportedChain = SUPPORTED_ENS_CHAINS[chainId];

  if (!supportedChain) {
    throw new Error(
      `[ENS Identity] Unsupported ENS chain id ${chainId}. ` +
      'Pass options.chain explicitly (supported defaults: mainnet, sepolia, holesky).',
    );
  }

  return supportedChain;
}

/**
 * Registers an ENS subname under a parent controlled by the signer.
 *
 * @param parentName - ENS parent name, for example `agentgate.eth`.
 * @param label - Single-label subname to create, for example `my-agent`.
 * @param ownerAddress - Address that should own the created subname.
 * @param signer - viem account that signs the transaction and controls `parentName`.
 * @param options - Optional ENS RPC, chain, and resolver overrides.
 * @returns The fully qualified ENS subname, transaction hash, and creation status.
 * If the subname already belongs to `ownerAddress`, no transaction is sent and `txHash` is `null`.
 * @throws When inputs are invalid, the signer does not control the parent, the name is taken, or the transaction reverts.
 */
export async function registerSubname(
  parentName: string,
  label: string,
  ownerAddress: Address,
  signer: Account,
  options: RegisterSubnameOptions = {},
): Promise<RegisterSubnameResult> {
  const normalizedParent = normalizeParentName(parentName);
  const normalizedLabel = normalizeLabel(label);
  const fullSubname = `${normalizedLabel}.${normalizedParent}`;

  if (!isAddress(ownerAddress)) {
    throw new Error(`[ENS Identity] ownerAddress "${ownerAddress}" is not a valid EVM address`);
  }
  if (!signer?.address || !isAddress(signer.address)) {
    throw new Error('[ENS Identity] signer must be a valid viem Account with an address');
  }

  const rpcUrl = options.rpcUrl ?? config.rpc.standard;
  if (!rpcUrl) throw new Error('[ENS Identity] Missing RPC URL. Set RPC_URL or pass options.rpcUrl.');

  const chain = addEnsContracts(await resolveEnsChain(options.chain, rpcUrl));
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const ensPublicClient = createEnsPublicClient({ chain, transport: http(rpcUrl) });
  const ensWalletClient = createEnsWalletClient({
    account: signer,
    chain,
    transport: http(rpcUrl),
  });

  const parentOwnership = await ensPublicClient.getOwner({ name: normalizedParent });
  if (!parentOwnership?.owner) {
    throw new Error(`[ENS Identity] Parent "${normalizedParent}" has no owner on-chain`);
  }
  if (parentOwnership.owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(
      `[ENS Identity] signer ${signer.address} does not control parent "${normalizedParent}" (owner: ${parentOwnership.owner})`,
    );
  }

  const existingOwnership = await ensPublicClient.getOwner({ name: fullSubname });
  if (existingOwnership?.owner) {
    const currentOwner = existingOwnership.owner.toLowerCase();
    if (currentOwner === ownerAddress.toLowerCase()) {
      return {
        name: fullSubname,
        txHash: null,
        status: 'already-owned',
      };
    }
    throw new Error(
      `[ENS Identity] Subname "${fullSubname}" already exists and is owned by ${existingOwnership.owner}`,
    );
  }

  const contract = parentOwnership.ownershipLevel === 'nameWrapper' ? 'nameWrapper' : 'registry';
  const txHash = await createSubname(ensWalletClient, {
    name: fullSubname,
    owner: ownerAddress,
    contract,
    ...(options.resolverAddress ? { resolverAddress: options.resolverAddress } : {}),
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== 'success') {
    throw new Error(`[ENS Identity] Subname registration transaction reverted: ${txHash}`);
  }

  return {
    name: fullSubname,
    txHash,
    status: 'created',
  };
}

/**
 * Reads AgentGate ENS text records for a provider name.
 *
 * @param name - ENS name whose AgentGate metadata should be resolved.
 * @param options - Optional ENS RPC and chain overrides.
 * @returns A key/value object containing only text records that exist and are non-empty.
 * @throws When the name is empty, the RPC is missing, or the RPC chain is unsupported.
 */
export async function readTextRecords(name: string, options: ReadTextRecordOptions = {}): Promise<Record<string, string>> {
  const normalizedName = name.trim().toLowerCase().replace(/\.+$/, '');
  if (!normalizedName) throw new Error('[ENS Identity] name is required');

  const rpcUrl = options.rpcUrl ?? config.rpc.standard;
  if (!rpcUrl) throw new Error('[ENS Identity] Missing RPC URL. Set RPC_URL or pass options.rpcUrl.');

  const chain = addEnsContracts(await resolveEnsChain(options.chain, rpcUrl));
  const ensPublicClient = createEnsPublicClient({ chain, transport: http(rpcUrl) });

  const values = await Promise.all(
    AGENTGATE_TEXT_KEYS.map(async (key) => ({
      key,
      value: await ensPublicClient.getTextRecord({ name: normalizedName, key }),
    })),
  );

  return values.reduce<Record<string, string>>((acc, item) => {
    if (item.value) acc[item.key] = item.value;
    return acc;
  }, {});
}

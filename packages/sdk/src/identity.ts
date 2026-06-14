import { addEnsContracts, createEnsPublicClient, createEnsWalletClient } from '@ensdomains/ensjs';
import { getSubnames } from '@ensdomains/ensjs/subgraph';
import { createSubname, setRecords } from '@ensdomains/ensjs/wallet';
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

export type AgentGateTextKey = typeof AGENTGATE_TEXT_KEYS[number];
export type AgentMetadataValue = string | boolean | readonly string[];
export type AgentMetadataRecords = Partial<Record<AgentGateTextKey, AgentMetadataValue>>;

export interface RegisterSubnameOptions {
  /** RPC endpoint for the ENS network. Defaults to `ENS_RPC_URL` from config. */
  rpcUrl?: string;
  /** ENS-enabled viem chain. When omitted, the chain is detected from `rpcUrl`. */
  chain?: Chain;
  /** Resolver to attach to the created subname. Defaults to the public resolver for the chain. */
  resolverAddress?: Address;
}

export interface ReadTextRecordOptions {
  /** RPC endpoint for the ENS network. Defaults to `ENS_RPC_URL` from config. */
  rpcUrl?: string;
  /** ENS-enabled viem chain. When omitted, the chain is detected from `rpcUrl`. */
  chain?: Chain;
}

export interface AgentMetadata {
  /** Normalized ENS name for the provider agent. */
  name: string;
  /** Human-readable agent description. */
  description?: string;
  /** Declared agent capabilities. */
  capabilities: string[];
  /** x402-protected endpoint URL for paid calls. */
  x402Endpoint?: string;
  /** x402 price string as stored in ENS. */
  x402Price?: string;
  /** Whether the provider claims World verification in ENS metadata. */
  worldVerified?: boolean;
  /** Raw AgentGate ENS text records used to build the structured metadata. */
  records: Partial<Record<AgentGateTextKey, string>>;
}

export interface DiscoverAgentsOptions extends ReadTextRecordOptions {
  /** Search string filter for subname labels. */
  searchString?: string;
  /** Include expired names in subgraph results. */
  allowExpired?: boolean;
  /** Include deleted names in subgraph results. */
  allowDeleted?: boolean;
  /** Maximum number of subnames to fetch. Defaults to the ENS SDK default. */
  pageSize?: number;
  /** Subgraph ordering field. */
  orderBy?: 'expiryDate' | 'name' | 'labelName' | 'createdAt';
  /** Subgraph ordering direction. */
  orderDirection?: 'asc' | 'desc';
}

export interface SetAgentMetadataOptions extends ReadTextRecordOptions {
  /** Resolver to write records to. Defaults to the resolver currently configured for `name`. */
  resolverAddress?: Address;
}

export interface RegisterSubnameResult {
  /** Fully qualified ENS subname, for example `my-agent.agentgate.eth`. */
  name: string;
  /** Transaction hash for new registrations; `null` when the subname already belonged to `ownerAddress`. */
  txHash: Hash | null;
  /** Whether the helper created the subname or returned an already-owned idempotent result. */
  status: 'created' | 'already-owned';
}

export interface SetAgentMetadataResult {
  /** Normalized ENS name whose metadata was written. */
  name: string;
  /** Transaction hash for the resolver text-record write. */
  txHash: Hash;
  /** Normalized text records sent to the resolver. */
  records: Partial<Record<AgentGateTextKey, string>>;
}

function normalizeEnsName(name: string): string {
  const normalizedName = name.trim().toLowerCase().replace(/\.+$/, '');
  if (!normalizedName) throw new Error('[ENS Identity] name is required');
  return normalizedName;
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

function parseCapabilities(rawCapabilities?: string): string[] {
  if (!rawCapabilities) return [];

  try {
    const parsed = JSON.parse(rawCapabilities);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
    }
  } catch {
    // Fall back to comma-separated values below.
  }

  return rawCapabilities
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBooleanRecord(rawValue?: string): boolean | undefined {
  if (!rawValue) return undefined;
  const normalizedValue = rawValue.trim().toLowerCase();
  if (normalizedValue === 'true') return true;
  if (normalizedValue === 'false') return false;
  return undefined;
}

function toAgentMetadata(name: string, records: Record<string, string>): AgentMetadata {
  return {
    name,
    description: records.description,
    capabilities: parseCapabilities(records['io.agentgate.capabilities']),
    x402Endpoint: records['io.agentgate.x402-endpoint'],
    x402Price: records['io.agentgate.x402-price'],
    worldVerified: parseBooleanRecord(records['io.agentgate.world-verified']),
    records,
  };
}

function omitUndefinedValues<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>;
}

function normalizeMetadataValue(value: AgentMetadataValue): string {
  if (Array.isArray(value)) return JSON.stringify(value);
  return String(value);
}

function normalizeMetadataRecords(records: AgentMetadataRecords): Partial<Record<AgentGateTextKey, string>> {
  const normalizedRecords: Partial<Record<AgentGateTextKey, string>> = {};

  for (const key of AGENTGATE_TEXT_KEYS) {
    const value = records[key];
    if (value === undefined) continue;
    normalizedRecords[key] = normalizeMetadataValue(value);
  }

  if (Object.keys(normalizedRecords).length === 0) {
    throw new Error('[ENS Identity] setAgentMetadata requires at least one AgentGate metadata record');
  }

  return normalizedRecords;
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
  if (!rpcUrl) throw new Error('[ENS Identity] Missing RPC URL. Set ENS_RPC_URL or pass options.rpcUrl.');

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
 * Writes AgentGate ENS text records for a provider name in one resolver transaction.
 *
 * @param name - ENS name whose AgentGate metadata should be updated.
 * @param records - Supported AgentGate text records to write.
 * @param signer - viem account that signs the resolver transaction.
 * @param options - Optional ENS RPC, chain, and resolver overrides.
 * @returns The normalized name, transaction hash, and normalized text records.
 * @throws When inputs are invalid, no supported metadata is provided, the name has no resolver, or the transaction reverts.
 */
export async function setAgentMetadata(
  name: string,
  records: AgentMetadataRecords,
  signer: Account,
  options: SetAgentMetadataOptions = {},
): Promise<SetAgentMetadataResult> {
  const normalizedName = normalizeEnsName(name);
  const normalizedRecords = normalizeMetadataRecords(records);

  if (!signer?.address || !isAddress(signer.address)) {
    throw new Error('[ENS Identity] signer must be a valid viem Account with an address');
  }

  const rpcUrl = options.rpcUrl ?? config.rpc.standard;
  if (!rpcUrl) throw new Error('[ENS Identity] Missing RPC URL. Set ENS_RPC_URL or pass options.rpcUrl.');

  const chain = addEnsContracts(await resolveEnsChain(options.chain, rpcUrl));
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const ensPublicClient = createEnsPublicClient({ chain, transport: http(rpcUrl) });
  const ensWalletClient = createEnsWalletClient({
    account: signer,
    chain,
    transport: http(rpcUrl),
  });

  const resolverAddress = options.resolverAddress ?? await ensPublicClient.getResolver({ name: normalizedName });
  if (!resolverAddress) {
    throw new Error(`[ENS Identity] Name "${normalizedName}" has no resolver; set a resolver before writing metadata`);
  }

  const txHash = await setRecords(ensWalletClient, {
    name: normalizedName,
    resolverAddress,
    texts: AGENTGATE_TEXT_KEYS
      .filter((key) => normalizedRecords[key] !== undefined)
      .map((key) => ({ key, value: normalizedRecords[key]! })),
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== 'success') {
    throw new Error(`[ENS Identity] metadata transaction reverted: ${txHash}`);
  }

  return {
    name: normalizedName,
    txHash,
    records: normalizedRecords,
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
  const normalizedName = normalizeEnsName(name);

  const rpcUrl = options.rpcUrl ?? config.rpc.standard;
  if (!rpcUrl) throw new Error('[ENS Identity] Missing RPC URL. Set ENS_RPC_URL or pass options.rpcUrl.');

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

/**
 * Resolves AgentGate ENS text records into structured provider metadata.
 *
 * @param name - ENS name whose AgentGate metadata should be resolved.
 * @param options - Optional ENS RPC and chain overrides.
 * @returns Structured provider metadata plus the raw AgentGate records.
 */
export async function readAgentMetadata(name: string, options: ReadTextRecordOptions = {}): Promise<AgentMetadata> {
  const normalizedName = normalizeEnsName(name);
  const records = await readTextRecords(normalizedName, options);
  return toAgentMetadata(normalizedName, records);
}

/**
 * Discovers provider agent subnames under an ENS parent and resolves their AgentGate metadata.
 *
 * @param parentName - ENS parent name, for example `agentgate.eth`.
 * @param options - Optional ENS RPC, chain, subgraph filtering, and pagination controls.
 * @returns Structured metadata for each discovered subname.
 */
export async function discoverAgents(
  parentName: string,
  options: DiscoverAgentsOptions = {},
): Promise<AgentMetadata[]> {
  const normalizedParent = normalizeParentName(parentName);
  const rpcUrl = options.rpcUrl ?? config.rpc.standard;
  if (!rpcUrl) throw new Error('[ENS Identity] Missing RPC URL. Set ENS_RPC_URL or pass options.rpcUrl.');

  const chain = addEnsContracts(await resolveEnsChain(options.chain, rpcUrl));
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const subnameQuery = {
    name: normalizedParent,
    ...omitUndefinedValues({
      searchString: options.searchString,
      allowExpired: options.allowExpired,
      allowDeleted: options.allowDeleted,
      orderBy: options.orderBy,
      orderDirection: options.orderDirection,
      pageSize: options.pageSize,
    }),
  };
  const subnames = await getSubnames(
    publicClient as any,
    subnameQuery,
  );

  const names = subnames
    .map((subname) => subname.name)
    .filter((subname): subname is string => typeof subname === 'string' && subname.length > 0);

  return Promise.all(names.map((name) => readAgentMetadata(name, options)));
}

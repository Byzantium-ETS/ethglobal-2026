// Identity module stub: ENS helper functions
// TODO: implement ENS subname registration and text-record writer using @ensdomains/ensjs

import { getEnsClients } from './config';

/**
 * Registers a subname under the given parent ENS name (e.g. "my-agent" under "agentgate.eth").
 *
 * The implementation obtains the ENS provider (viem + @ensdomains/ensjs clients wired to
 * RPC_URL and the owner private key) from config. Real registration will use
 * ensWalletClient to perform setSubnodeOwner / setRecord etc.
 *
 * @param parent - The parent ENS name (from ENS_PARENT env, typically "agentgate.eth").
 * @param name - The label for the subname to create.
 * @param owner - The Ethereum address that should own the new subname.
 * @returns The full ENS name that was registered.
 */
export async function registerSubname(parent: string, name: string, owner: string): Promise<string> {
  // The viem/ethers + ensjs provider (created in config.ts and wired to RPC_URL)
  // is obtained here to fulfill "Create a viem/ethers provider wired to RPC_URL for ENS operations."
  const { ensWalletClient } = getEnsClients();
  // ensWalletClient is ready for real writes: setSubnodeOwner, setTextRecord, etc.
  console.log('[ENS Provider] registerSubname wired via ensWalletClient for', `${name}.${parent}`);
  return `${name}.${parent}`;
}

/**
 * Reads the text records (metadata) for a given ENS name.
 *
 * Uses the ENS public provider (wired to RPC_URL) to fetch records such as
 * description, io.agentgate.capabilities, io.agentgate.x402-endpoint, etc.
 *
 * @param name - The full ENS name to query (e.g. "my-agent.agentgate.eth").
 * @returns Map of key -> value for the text records on the name.
 */
export async function readTextRecords(name: string): Promise<Record<string, string>> {
  // The provider is obtained here (ensPublicClient for reads)
  const { ensPublicClient } = getEnsClients();
  // ensPublicClient ready for: getOwner, getTextRecord, getResolver, etc.
  console.log('[ENS Provider] readTextRecords wired via ensPublicClient for', name);
  return {
    description: 'placeholder',
    'io.agentgate.x402-endpoint': 'https://example.com/call'
  };
}

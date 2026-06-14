import { randomBytes } from 'node:crypto';
import { AgentkitClient, createAgentkitClient, createAgentBookVerifier } from '@worldcoin/agentkit';
import { buildAgentkitSchema } from '@worldcoin/agentkit-core';
import { isAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from './config';

/**
 * Task 2C.1: AgentKit Package Setup
 * Creates the global AgentKit client instance.
 */
export async function createAgentWallet(): Promise<AgentkitClient> {
  const account = privateKeyToAccount(config.keys.privateKey as `0x${string}`);

  return createAgentkitClient({
    signer: {
      address: account.address,
      chainId: 'eip155:8453',
      type: 'eip191',
      // viem expects the message to be passed inside an object
      signMessage: message => account.signMessage({ message }),
    },
  });
}

/**
 * Task 2C.2: Agent Wallet Registration
 * Replaces the stub with the registration logic.
 */
export async function verifyAgentWalletRegistration(address: string): Promise<boolean> {
  if (!isAddress(address)) {
    throw new Error(`[AgentKit] Invalid wallet address: ${address}`);
  }

  console.log(`[AgentKit] Checking AgentBook status for ${address}...`);

  const worldRpcUrl = config.rpc.world;
  const agentBook = createAgentBookVerifier(worldRpcUrl ? { rpcUrl: worldRpcUrl } : undefined);
  const humanId = await agentBook.lookupHuman(address);

  if (humanId) {
    console.log(`[AgentKit] Wallet ${address} is human-backed (humanId: ${humanId}).`);
    return true;
  }

  console.log(`[AgentKit] Wallet ${address} is not registered in AgentBook.`);
  return false;
}

/**
 * Task 2C.3: Verification Proof Request
 * Returns a structured proof object that the server can validate.
 */
export async function requestWorldProof(
  endpoint: string,
  challengeData: string = 'Verify your agent is backed by a real human',
): Promise<{ success: boolean; proof?: string }> {
  try {
    console.log(`[AgentKit] Generating proof for endpoint: ${endpoint}`);

    const resource = new URL(endpoint).toString();
    const domain = new URL(resource).hostname;
    const issuedAt = new Date().toISOString();
    const expirationTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const extension = {
      info: {
        domain,
        uri: resource,
        statement: challengeData,
        version: '1',
        nonce: randomBytes(16).toString('hex'),
        issuedAt,
        expirationTime,
        resources: [resource],
      },
      supportedChains: [
        {
          chainId: 'eip155:8453',
          type: 'eip191' as const,
        },
      ],
      schema: buildAgentkitSchema(),
    };

    const client = await createAgentWallet();
    const proofHeader = await client.createHeader(extension);

    return { success: true, proof: proofHeader };
  } catch (error) {
    console.error('[AgentKit] Failed to generate World Proof:', error);
    return { success: false };
  }
}

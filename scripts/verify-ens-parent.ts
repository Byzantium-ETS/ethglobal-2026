/**
 * Task 2B.1 helper: Verify ENS Parent Name Setup (read-focused for now)
 *
 * Usage:
 *   npm run verify:ens
 *
 * This runs createEnsPublicClient from @ensdomains/ensjs against your ENS_RPC_URL.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createEnsPublicClient } from '@ensdomains/ensjs';
import { http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, sepolia } from 'viem/chains';

// Load .env manually
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const ensParent = process.env.ENS_PARENT || 'agentgate.eth';
  const rpcUrl = process.env.ENS_RPC_URL;
  const demoPrivateKey = process.env.DEMO_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000001';

  if (!rpcUrl || rpcUrl.includes('example')) {
    console.log('=== AgentGate ENS Parent Verification (Task 2B.1) ===\n');
    console.error('❌ ENS_RPC_URL is still the placeholder in .env');
    console.error('   Please set it to a real Sepolia RPC, e.g.:');
    console.error('   ENS_RPC_URL="https://ethereum-sepolia.publicnode.com"');
    process.exit(1);
  }

  console.log('=== AgentGate ENS Parent Verification (Task 2B.1) ===\n');
  console.log(`ENS_PARENT     : ${ensParent}`);
  console.log(`ENS_RPC_URL    : ${rpcUrl}`);

  try {
    const demoAddress = privateKeyToAccount(demoPrivateKey as `0x${string}`).address;
    console.log(`DEMO_ADDRESS   : ${demoAddress} (from key in .env)\n`);
  } catch {
    console.log('DEMO_ADDRESS   : (could not derive — using dummy for read test)\n');
  }

  // Detect chain
  // Prefer explicit ENS_CHAIN for reliable detection (avoids brittle string matching on custom RPC URLs).
  // Falls back to ENS_RPC_URL heuristic for backward compatibility.
  const chainName = (process.env.ENS_CHAIN || '').toLowerCase();
  const chain = chainName === 'sepolia' ? sepolia : (chainName === 'mainnet' ? mainnet : (rpcUrl.toLowerCase().includes('sepolia') ? sepolia : mainnet));

  const publicClient = createEnsPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  try {
    console.log('--- Parent Ownership (via @ensdomains/ensjs) ---');
    const ownerResult = await publicClient.getOwner({ name: ensParent });
    console.dir(ownerResult, { depth: 2 });

    console.log('\n--- Your existing subdomains ---');
    for (const label of ['buyer', 'seller']) {
      const fullName = `${label}.${ensParent}`;
      try {
        const subOwner = await publicClient.getOwner({ name: fullName });
        console.log(`${fullName}:`);
        console.dir(subOwner, { depth: 1 });
      } catch (err: any) {
        console.log(`${fullName}: could not fetch (${err.message?.slice(0,80)})`);
      }
    }

    console.log('\n--- Resolver ---');
    const resolverAddress = await publicClient.getResolver({ name: ensParent });
    console.log(`Resolver on ${ensParent}: ${resolverAddress || '(none set)'}`);

    console.log('\n✅ @ensdomains/ensjs successfully talked to your RPC and the Sepolia ENS contracts.');
    console.log('   This confirms the library works with your chosen network.');

    if (ownerResult && (ownerResult.owner || ownerResult.wrappedOwner)) {
      console.log('\n👉 Copy the owner address above. This is the wallet that bought agentgate.eth on testnet.');
      console.log('   You need its private key for DEMO_PRIVATE_KEY if you want to register new subnames from code.');
    }

  } catch (error: any) {
    console.error('\n❌ ENS query failed:');
    console.error(error?.message || error);
    console.log('\nCommon causes:');
    console.log('- Wrong ENS_RPC_URL (must be Sepolia Ethereum RPC, not Arc)');
    console.log('- No internet or the RPC endpoint is down');
    console.log('- The name was registered on mainnet instead of Sepolia');
    process.exit(1);
  }
}

main();

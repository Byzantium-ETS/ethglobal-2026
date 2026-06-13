import { describe, it, expect } from 'vitest';
import { PaymentsClient } from '../src/payments';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load env vars
dotenv.config({ path: resolve(__dirname, '../../../.env') });

const hasEnv = !!(process.env.DEMO_PRIVATE_KEY && process.env.ARC_RPC_URL);

describe.skipIf(!hasEnv)('PaymentsClient - Buyer Deposit Flow (Integration)', () => {
  it('should successfully fetch balances and initiate a deposit', async () => {
    const privateKey = process.env.DEMO_PRIVATE_KEY as `0x${string}`;
    const rpcUrl = process.env.ARC_RPC_URL;

    const client = new PaymentsClient({
      privateKey,
      rpcUrl,
    });

    expect(client.buyerAddress).toBeDefined();

    // Check balances
    const balances = await client.getBalances();
    expect(balances).toBeDefined();
    expect(balances.walletUsdcBalance).toBeDefined();
    expect(balances.gatewayUsdcBalance).toBeDefined();

    // Only run deposit if the wallet has some USDC balance to avoid failing on empty balance
    if (BigInt(balances.walletUsdcBalance) > 0n) {
      console.log('Initiating test deposit of 0.01 USDC...');
      const result = await client.deposit('0.01');
      expect(result).toBeDefined();
      expect(result.depositTxHash).toBeDefined();
      console.log(`Test deposit succeeded: ${result.depositTxHash}`);
    } else {
      console.warn('Skipping actual deposit transaction because wallet USDC balance is 0');
    }
  });
});

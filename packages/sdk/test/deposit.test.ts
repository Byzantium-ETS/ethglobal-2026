import { describe, it, expect } from 'vitest';
import { parseUnits } from 'viem';
import { PaymentsClient } from '../src/payments';
import { config } from '../src/config';

const hasEnv = !!((process.env.BUYER_PRIVATE_KEY || process.env.DEMO_PRIVATE_KEY) && process.env.ARC_RPC_URL);
const shouldRunDeposit = process.env.RUN_ONCHAIN_DEPOSIT === 'true';
const depositAmount = process.env.ONCHAIN_DEPOSIT_AMOUNT ?? '0.01';

function getBuyerPrivateKey(): `0x${string}` {
  const configuredKey = process.env.BUYER_PRIVATE_KEY ?? process.env.DEMO_PRIVATE_KEY;
  if (!configuredKey) throw new Error('BUYER_PRIVATE_KEY or DEMO_PRIVATE_KEY is required');

  const normalizedKey = configuredKey.startsWith('0x') ? configuredKey : `0x${configuredKey}`;
  return normalizedKey as `0x${string}`;
}

describe.skipIf(!hasEnv)('PaymentsClient - Buyer Deposit Flow (Integration)', () => {
  it('should fetch balances and optionally initiate a deposit', async () => {
    const privateKey = getBuyerPrivateKey();
    const rpcUrl = config.rpc.arc;

    const client = new PaymentsClient({
      privateKey,
      rpcUrl,
    });

    expect(client.buyerAddress).toBeDefined();

    // Check balances
    const balances = await client.getBalances();
    expect(balances).toBeDefined();
    expect(balances.wallet?.balance).toBeDefined();
    expect(balances.gateway?.available).toBeDefined();

    if (!shouldRunDeposit) {
      console.warn('Skipping deposit transaction because RUN_ONCHAIN_DEPOSIT is not true');
      return;
    }

    const requiredWalletBalance = parseUnits(depositAmount, 6);
    const walletBalance = BigInt(balances.wallet.balance);

    if (walletBalance < requiredWalletBalance) {
      throw new Error(
        `Wallet USDC balance ${walletBalance} is below requested deposit amount ${requiredWalletBalance}`,
      );
    }

    if (requiredWalletBalance > 0n) {
      console.log(`Initiating test deposit of ${depositAmount} USDC...`);
      const result = await client.deposit(depositAmount);
      expect(result).toBeDefined();
      expect(result.depositTxHash).toBeDefined();
      console.log(`Test deposit succeeded: ${result.depositTxHash}`);
    }
  }, 120_000);
});

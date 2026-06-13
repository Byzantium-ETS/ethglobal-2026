import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Arc testnet constants
const ARC_CHAIN = 'eip155:5042002';
const ARC_USDC = '0x3600000000000000000000000000000000000000';
const ARC_GATEWAY_CONTRACT = '0x0077777d7EBA4688BDeF3E311b846F25870A19B9';

// Default price: 1000 = 0.001 USDC (6 decimals)
const DEFAULT_CALL_PRICE = '1000';

export interface ChallengeAccept {
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: {
    name: string;
    version: string;
    verifyingContract: string;
  };
}

export interface PaymentChallenge {
  x402Version: number;
  resource: { id: string; name: string };
  accepts: ChallengeAccept[];
}

function getSellerAddress(): string {
  const addr = process.env.SELLER_ADDRESS;

  if (!addr || addr.trim() === '') {
    if (process.env.NODE_ENV === 'test') {
      console.warn('[SellerConfig] SELLER_ADDRESS not set — using zero address for test mode only');
      return '0x0000000000000000000000000000000000000000';
    }
    throw new Error(
      '[SellerConfig] SELLER_ADDRESS is required. ' +
      'Set it to the Ethereum address that should receive payments. ' +
      'Use NODE_ENV=test to bypass this check in local smoke tests.',
    );
  }

  if (!/^0x[0-9a-fA-F]{40}$/.test(addr.trim())) {
    throw new Error(
      `[SellerConfig] SELLER_ADDRESS "${addr}" is not a valid Ethereum address (expected 0x + 40 hex chars).`,
    );
  }

  return addr.trim();
}

// Validated once at startup — any misconfiguration crashes the process immediately
// rather than silently issuing 402 challenges that pay to the zero address.
const SELLER_ADDRESS = getSellerAddress();

export const sellerConfig = {
  get address() { return SELLER_ADDRESS; },
  get price() { return process.env.CALL_PRICE ?? DEFAULT_CALL_PRICE; },
  network: ARC_CHAIN,
  asset: ARC_USDC,
  gatewayContract: ARC_GATEWAY_CONTRACT,
};

export function buildPaymentChallenge(resourceId: string): PaymentChallenge {
  return {
    x402Version: 2,
    resource: { id: resourceId, name: resourceId },
    accepts: [
      {
        scheme: 'exact',
        network: sellerConfig.network,
        asset: sellerConfig.asset,
        amount: sellerConfig.price,
        payTo: sellerConfig.address,
        maxTimeoutSeconds: 60,
        extra: {
          name: 'GatewayWalletBatched',
          version: '1',
          verifyingContract: sellerConfig.gatewayContract,
        },
      },
    ],
  };
}

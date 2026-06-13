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
  if (!addr) {
    console.warn('[SellerConfig] SELLER_ADDRESS not set — using zero address placeholder');
    return '0x0000000000000000000000000000000000000000';
  }
  return addr;
}

export const sellerConfig = {
  get address() { return getSellerAddress(); },
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

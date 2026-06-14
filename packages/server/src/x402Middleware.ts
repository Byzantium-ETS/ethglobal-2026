import { Request, Response, NextFunction, RequestHandler } from 'express';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { BatchFacilitatorClient, GatewayEvmScheme } from '@circle-fin/x402-batching/server';
import { buildPaymentChallenge, sellerConfig } from './sellerConfig';

// Augment Express Request to carry payment metadata for the handler
declare global {
  namespace Express {
    interface Request {
      paymentMetadata?: {
        scheme: string;
        token: string;
        network: string;
      };
    }
  }
}

const DEFAULT_CIRCLE_GATEWAY_API_URL = 'https://gateway-api-testnet.circle.com';

function getCircleGatewayApiUrl(): string {
  return (process.env.CIRCLE_API_URL?.trim() || DEFAULT_CIRCLE_GATEWAY_API_URL).replace(/\/+$/, '');
}

function getCircleGatewayApiKey(): string | undefined {
  return process.env.CIRCLE_API_KEY?.trim() || process.env.ARC_API_KEY?.trim() || undefined;
}

function buildResourceServer(): x402ResourceServer {
  const apiKey = getCircleGatewayApiKey();
  const apiHeader: Record<string, string> = apiKey
    ? { Authorization: `Bearer ${apiKey}` }
    : {};

  const facilitatorClient = new BatchFacilitatorClient({
    url: getCircleGatewayApiUrl(),
    createAuthHeaders: async () => ({
      verify: apiHeader,
      settle: apiHeader,
      supported: apiHeader,
    }),
  });

  // GatewayEvmScheme extends ExactEvmScheme, supporting both onchain and nanopayments
  return new x402ResourceServer([facilitatorClient as any])
    .register('eip155:*', new GatewayEvmScheme() as any);
}

const _inner = paymentMiddleware(
  {
    '/call': {
      accepts: {
        scheme: 'exact',
        network: sellerConfig.network as `${string}:${string}`,
        payTo: () => sellerConfig.address,
        price: {
          asset: sellerConfig.asset,
          amount: sellerConfig.price,
          extra: {
            name: 'GatewayWalletBatched',
            version: '1',
            verifyingContract: sellerConfig.gatewayContract,
          },
        },
        maxTimeoutSeconds: 60,
      },
    },
  },
  buildResourceServer(),
);

/**
 * Validates the x402 payment on the incoming request via @x402/express.
 * Reads the `payment-signature` or `x-payment` header.
 * Returns HTTP 402 with a machine-readable challenge when payment is absent or invalid.
 * Settlement occurs after the handler writes its response.
 */
export const x402Middleware: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const paymentToken = req.header('payment-signature') || req.header('x-payment');

  if (!paymentToken) {
    res.status(402).json(buildPaymentChallenge(req.originalUrl || req.path || '/call'));
    return;
  }

  const patchedNext: NextFunction = (err?: any) => {
    if (!err) {
      req.paymentMetadata = {
        scheme: 'exact',
        token: paymentToken,
        network: sellerConfig.network,
      };
    }
    return next(err);
  };

  _inner(req, res, patchedNext);
};

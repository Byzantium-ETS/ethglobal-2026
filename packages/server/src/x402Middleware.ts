import { Request, Response, NextFunction } from 'express';
import { buildPaymentChallenge } from './sellerConfig';

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

/**
 * Validates the x402 payment authorization on the incoming request.
 * Accepts Authorization or X-402-Authorization headers with an "X402 <token>" value.
 * Returns HTTP 402 with a machine-readable challenge payload when payment is absent or invalid.
 */
export function x402Middleware(req: Request, res: Response, next: NextFunction): void {
  const auth = req.header('Authorization') || req.header('X-402-Authorization');

  if (!auth) {
    res.status(402).json({
      error: 'Payment required',
      ...buildPaymentChallenge(req.path),
    });
    return;
  }

  const isX402 = auth.startsWith('X402 ');
  const isBearer = auth.startsWith('Bearer ');

  if (!isX402 && !isBearer) {
    res.status(402).json({
      error: 'Invalid payment authorization format — expected "X402 <token>" or "Bearer <token>"',
      ...buildPaymentChallenge(req.path),
    });
    return;
  }

  const token = auth.replace(/^(X402|Bearer)\s+/, '');
  req.paymentMetadata = {
    scheme: isX402 ? 'x402' : 'bearer',
    token,
    network: 'eip155:5042002',
  };

  next();
}

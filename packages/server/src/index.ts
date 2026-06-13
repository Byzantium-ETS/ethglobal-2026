import express from 'express';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { worldMiddleware } from './worldMiddleware';
import { x402Middleware } from './x402Middleware';
import { evaluatePolicy, consumeTrial } from './trialStore';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const app = express();
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ name: 'AgentGate Provider', status: 'ok' });
});

/**
 * POST /call — trust-aware monetised endpoint.
 *
 * Middleware chain: World proof check → free-trial gate → x402 payment enforcement
 *
 * Response states:
 *   free_trial        — verified identity with remaining trial calls
 *   paid              — valid x402 payment authorisation
 *   payment_required  — 402 with challenge payload (no trial, no payment)
 */
app.post('/call', worldMiddleware, (req, res) => {
  const identity = req.worldIdentity ?? null;
  const endpoint = '/call';
  const decision = evaluatePolicy(identity, endpoint);

  if (decision.status === 'free_trial') {
    consumeTrial(identity!, endpoint);
    const remaining = decision.remaining - 1;
    console.log(`[/call] free_trial | identity=${identity} | remaining after this call=${remaining}`);
    res.json({
      status: 'free_trial',
      remaining,
      identity,
      message: 'Agent call processed (free trial)',
    });
    return;
  }

  // Trial exhausted or unverified — enforce x402
  x402Middleware(req, res, () => {
    console.log(`[/call] paid | identity=${identity ?? 'unverified'} | scheme=${req.paymentMetadata?.scheme}`);
    res.json({
      status: 'paid',
      tx: req.paymentMetadata?.token ?? null,
      payment: req.paymentMetadata,
      identity,
      message: 'Agent call processed (paid)',
    });
  });
});

function getPort(): number {
  return process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
}

export function startServer(port: number = getPort()) {
  return app.listen(port, () => {
    console.log(`AgentGate server listening on http://localhost:${port}`);
  });
}

if (require.main === module) {
  startServer();
}

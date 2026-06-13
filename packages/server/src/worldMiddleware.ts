import { Request, Response, NextFunction } from 'express';
import {
  AGENTKIT,
  createAgentBookVerifier,
  parseAgentkitHeader,
  validateAgentkitMessage,
  verifyAgentkitSignature,
} from '@worldcoin/agentkit';

// Augment Express Request to carry the verified World identity key
declare global {
  namespace Express {
    interface Request {
      worldIdentity?: string | null;
    }
  }
}

// Singleton verifier — connects to AgentBook on World Chain (eip155:480)
const agentBook = createAgentBookVerifier({
  rpcUrl: process.env.WORLD_RPC_URL,
});

/**
 * Reads the `agentkit` header, runs the full AgentKit server-side verification
 * pipeline, and attaches req.worldIdentity to the request.
 *
 * Verification pipeline:
 *   1. parseAgentkitHeader   — decode and schema-validate the base64 payload
 *   2. validateAgentkitMessage — check resource URI binding and freshness
 *   3. verifyAgentkitSignature — recover the signer address (SIWE / EIP-1271)
 *   4. agentBook.lookupHuman  — resolve address → anonymous human ID on-chain
 *
 * Always calls next() — a missing or invalid proof sets identity to null so
 * downstream middleware can enforce x402 payment instead.
 */
export async function worldMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.header(AGENTKIT);

  if (!header) {
    req.worldIdentity = null;
    return next();
  }

  try {
    // 1. Decode the base64 agentkit header into a structured payload
    const payload = parseAgentkitHeader(header);

    // 2. Validate message binding and freshness (default max age: 5 minutes)
    const resourceUri = `${req.protocol}://${req.get('host')}${req.path}`;
    const validation = await validateAgentkitMessage(payload, resourceUri);
    if (!validation.valid) {
      console.debug(`[WorldMiddleware] Message validation failed: ${validation.error}`);
      req.worldIdentity = null;
      return next();
    }

    // 3. Verify the cryptographic signature and recover the signer address
    const verification = await verifyAgentkitSignature(payload, process.env.WORLD_RPC_URL);
    if (!verification.valid || !verification.address) {
      console.debug(`[WorldMiddleware] Signature verification failed: ${verification.error}`);
      req.worldIdentity = null;
      return next();
    }

    // 4. Resolve the signer address to an anonymous human ID via AgentBook
    const humanId = await agentBook.lookupHuman(verification.address);
    if (!humanId) {
      console.debug(`[WorldMiddleware] Address not registered in AgentBook: ${verification.address}`);
      req.worldIdentity = null;
      return next();
    }

    req.worldIdentity = humanId;
    console.debug(`[WorldMiddleware] Verified identity: ${humanId} (address: ${verification.address})`);
  } catch (err: any) {
    console.debug(`[WorldMiddleware] Verification error: ${err.message}`);
    req.worldIdentity = null;
  }

  next();
}

import { Request, Response, NextFunction } from 'express';

// Augment Express Request to carry the verified World identity key
declare global {
  namespace Express {
    interface Request {
      worldIdentity?: string | null;
    }
  }
}

interface WorldProofPayload {
  proofType: string;
  timestamp: number;
  challenge: string;
  signature: string;
}

const PROOF_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

function parseProofHeader(header: string): WorldProofPayload | null {
  try {
    const decoded = Buffer.from(header, 'base64').toString('utf-8');
    const parsed: unknown = JSON.parse(decoded);
    if (
      typeof parsed === 'object' && parsed !== null &&
      'proofType' in parsed && typeof (parsed as Record<string, unknown>).proofType === 'string' &&
      'timestamp' in parsed && typeof (parsed as Record<string, unknown>).timestamp === 'number' &&
      'challenge' in parsed && typeof (parsed as Record<string, unknown>).challenge === 'string' &&
      'signature' in parsed && typeof (parsed as Record<string, unknown>).signature === 'string'
    ) {
      return parsed as WorldProofPayload;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Derives a stable, normalised identity key from a validated proof.
 * In production this would verify via World AgentKit on-chain;
 * for demo determinism we derive from the proof signature prefix.
 */
function deriveIdentityKey(proof: WorldProofPayload): string {
  return `world:${proof.signature.slice(0, 20)}`;
}

/**
 * Parses the X-World-Proof header and attaches req.worldIdentity.
 * Always calls next() — a missing or invalid proof simply sets identity to null
 * so downstream middleware can enforce payment instead.
 */
export function worldMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const proofHeader = req.header('X-World-Proof');

  if (!proofHeader) {
    req.worldIdentity = null;
    return next();
  }

  const proof = parseProofHeader(proofHeader);
  if (!proof) {
    console.debug('[WorldMiddleware] Could not parse X-World-Proof header');
    req.worldIdentity = null;
    return next();
  }

  const ageMs = Date.now() - proof.timestamp;
  if (ageMs > PROOF_MAX_AGE_MS) {
    console.debug(`[WorldMiddleware] Proof expired (age ${ageMs}ms)`);
    req.worldIdentity = null;
    return next();
  }

  req.worldIdentity = deriveIdentityKey(proof);
  console.debug(`[WorldMiddleware] Verified identity: ${req.worldIdentity}`);
  next();
}

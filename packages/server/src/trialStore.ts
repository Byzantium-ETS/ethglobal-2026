const DEFAULT_FREE_TRIAL_LIMIT = 5;

function getTrialLimit(): number {
  const raw = process.env.FREE_TRIAL_LIMIT;
  if (!raw) return DEFAULT_FREE_TRIAL_LIMIT;
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? DEFAULT_FREE_TRIAL_LIMIT : parsed;
}

// In-memory store: key = `${identityKey}:${endpoint}` → calls used
const trialCounts = new Map<string, number>();

function makeKey(identityKey: string, endpoint: string): string {
  return `${identityKey}:${endpoint}`;
}

export type PolicyDecision =
  | { status: 'free_trial'; remaining: number }
  | { status: 'payment_required' };

/**
 * Returns the policy decision for the given identity and endpoint.
 * Unverified callers (null identity) immediately require payment.
 */
export function evaluatePolicy(identityKey: string | null, endpoint: string): PolicyDecision {
  if (!identityKey) {
    return { status: 'payment_required' };
  }

  const used = trialCounts.get(makeKey(identityKey, endpoint)) ?? 0;
  const limit = getTrialLimit();

  if (used < limit) {
    return { status: 'free_trial', remaining: limit - used };
  }

  return { status: 'payment_required' };
}

/**
 * Increments the trial counter for the identity+endpoint pair.
 * Call this only when a free trial request is granted.
 */
export function consumeTrial(identityKey: string, endpoint: string): void {
  const key = makeKey(identityKey, endpoint);
  trialCounts.set(key, (trialCounts.get(key) ?? 0) + 1);
}

/** Returns raw usage stats — useful for debugging/testing. */
export function getTrialUsage(identityKey: string, endpoint: string): { used: number; limit: number } {
  return {
    used: trialCounts.get(makeKey(identityKey, endpoint)) ?? 0,
    limit: getTrialLimit(),
  };
}

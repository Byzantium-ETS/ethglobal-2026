# AgentGate — ETHGlobal Execution Plan

## Focus Sponsors (Primary Targets)
1. **Arc (Circle)** — micropayments and agent economy rails
2. **ENS** — agent identity + metadata discovery
3. **World** — human-backed trust signal for agents

## One-Sentence Product Thesis
**AgentGate** turns agent-to-agent calls into a trusted, discoverable, and monetizable protocol by combining **World verification (trust)** + **ENS identity (discovery/routing)** + **x402 on Arc (payment transport)**.

## Current Repo Reality (Starting Point)
The monorepo already has the right package boundaries but mostly stub implementations:

- `packages/sdk`
  - `identity.ts` has placeholder subname and text-record reads
  - `payments.ts` has placeholder deposit/authorization methods
  - `trust.ts` has placeholder world-proof and wallet registration methods
- `packages/server`
  - Express API with `/call`
  - `x402Middleware` currently checks for auth header and returns `402` if missing
- `demo`
  - Minimal placeholder script output

This plan assumes we keep the architecture and replace stubs with one polished, demo-ready path.

## Demo Narrative (What Judges Should See)
1. **Provider registers** `my-agent.agentgate.eth` and writes capabilities + price + endpoint metadata.
2. **Consumer discovers** provider via ENS metadata resolution.
3. **Consumer proves human backing** (World/AgentKit signal) and receives limited free calls.
4. **Trial expires** and the same endpoint flips to enforced x402 payment.
5. **Consumer pays in USDC via Arc flow** and receives successful paid response.

## Product Contract (Do Not Drift)
Keep these ENS text record keys stable:

- `io.agentgate.capabilities`
- `io.agentgate.x402-endpoint`
- `io.agentgate.x402-price`
- `io.agentgate.world-verified`

Keep payment header handling stable on server:

- `Authorization`
- `X-402-Authorization`

## Scope Boundaries (Hackathon-Safe)
**In scope**
- One provider + one consumer flow
- One paid endpoint (`POST /call`)
- Deterministic free-trial gate (per verified user / endpoint)
- ENS registration + read/discovery for at least one working name

**Out of scope (unless time remains)**
- Multi-provider marketplace UX
- Complex reputation systems
- Full onchain feedback or staking mechanics
- Generalized billing dashboards

## Implementation Plan (48 Hours)

### Phase 1 — Payment Path First (Friday, ~5h)
**Goal:** paid request loop works end-to-end even before trust/identity polish.

- Implement `payments` SDK wrapper around x402/Arc buyer primitives.
- Upgrade server x402 middleware from header presence check to auth validation path (or tight adapter around official flow).
- Add deterministic pricing config for `/call` and clear `402` challenge behavior.
- Validate one successful paid request from demo client to server.

### Phase 2 — ENS Identity + Discovery (Saturday AM, ~4h)
**Goal:** provider can be found and called through ENS metadata.

- Implement subname registration helper under configured `ENS_PARENT`.
- Implement metadata writer with required AgentGate text keys.
- Implement read/discovery helper used by consumer flow.
- Ensure demo uses ENS-derived endpoint rather than hardcoded URL.

### Phase 3 — World Trust Gate (Saturday PM, ~4h)
**Goal:** trust controls free-trial eligibility before payments.

- Integrate World AgentKit verification input to server request context.
- Add free-trial counter (small local store is acceptable for demo determinism).
- Enforce: verified users get N free calls; after N, x402 required.
- Surface clear response states: `trial_remaining`, then `payment_required`.

### Phase 4 — Unified Demo and UX (Saturday Night, ~4h)
**Goal:** one command-driven flow that is hard to break live.

- Wire demo script(s): `register -> discover -> call (free) -> call (paid)`.
- Keep logs concise and sponsor-mapped (ENS, World, Arc evidence lines).
- Add fallback local mode if one external dependency degrades.
- Add architecture diagram and tighten README runbook.

### Phase 5 — Submission Polish (Sunday, ~4h)
**Goal:** maximize judge clarity, reduce demo risk.

- Record demo video with deterministic sequence and pre-funded wallets.
- Add sponsor checklist section to README (where each requirement is shown).
- Final smoke run from clean install and env setup.

## Package-Level Definition of Done

### `@agentgate/sdk`
- `identity`: real ENS read/write/discovery path
- `payments`: real x402/Arc client methods for buyer-side calls
- `trust`: World verification helper integrated into request flow
- `index.ts`: exports stable, high-level APIs only

### `@agentgate/server`
- `/call` supports trial + paid transitions
- x402 middleware emits proper `402` and validates payment data
- Errors are explicit and demo-readable (no silent fallbacks)

### `agentgate-demo`
- Runnable script(s) proving complete product story
- No manual code edits required during live demo
- Clear output for each sponsor integration checkpoint

## Acceptance Criteria (Ship Gate)
- Agent discovery works via ENS name + metadata.
- Verified user receives configured free-trial calls.
- Trial exhaustion triggers payment requirement on same endpoint.
- Paid request succeeds through Arc/x402 flow in USDC.
- Demo clearly proves Arc + ENS + World are core to the same flow.

## Risks and Mitigations
| Risk | Likelihood | Impact | Mitigation |
|---|---:|---:|---|
| External SDK/API instability during event | Medium | High | Build deterministic fallback mode and preflight checks before demo |
| Cross-network confusion (ENS network vs Arc network) | Medium | High | Pin env vars, document chain IDs, avoid dynamic network switching in demo |
| Last-minute integration bugs across packages | Medium | Medium | Keep one golden path only; avoid extra endpoints/features |
| Time loss on non-judged polish | High | Medium | Prioritize acceptance criteria before UI niceties |

## Demo Ops Checklist
- Pre-fund demo wallets and verify balances
- Confirm all required env vars from `.env.example`
- Start server and run scripted demo once before recording
- Capture transaction / response evidence for sponsor claims
- Keep backup recording and fallback script ready

## Useful Resources

### Arc / Circle / x402
- Arc docs: https://docs.arc.io/
- Circle nanopayments: https://developers.circle.com/gateway/nanopayments.md
- x402 reference: https://github.com/x402-foundation/x402

### ENS
- ENS docs: https://docs.ens.domains/
- ENS deployments: https://docs.ens.domains/learn/deployments
- ENS SDK: https://github.com/ensdomains/ensjs

### World
- World AgentKit integration: https://docs.world.org/agents/agent-kit/integrate
- World AgentKit SDK reference: https://docs.world.org/agents/agent-kit/sdk-reference
- AgentBook: https://agentbook.world

## Quick Constants (Verify Before Final Submission)
- Arc testnet chain ID: `5042002`
- Arc RPC: `https://rpc.testnet.arc.network`
- Arc USDC: `0x3600000000000000000000000000000000000000`
- Arc GatewayWallet: `0x0077777d7EBA4688BDeF3E311b846F25870A19B9`
- World AgentBook: `0xA23aB2712eA7BBa896930544C7d6636a96b944dA`

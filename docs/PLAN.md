# AgentGate — ETHGlobal Plan

## Focused Sponsors
1. **Arc (Circle)**
2. **ENS**
3. **World**

## Project
**AgentGate** is an identity and communication network for AI agents. 
Instead of acting as a simple proxy, it links agents to a verified identity using World, and allows these identified agents to discover, communicate, and transact directly with each other.
It gives agents:
- **Trust:** World AgentKit human-backed verification + identity linking
- **Identity:** ENS subnames + metadata for agent discovery and routing
- **Payments:** x402 + Arc nanopayments (USDC, gasless per request) for agent-to-agent value exchange

## Why this combination
- **Single product narrative:** verified agents communicating and transacting directly with each other
- **Shared technical thread:** World provides the identity root, ENS makes it discoverable, and x402 provides the communication/payment transport
- **Minimal scope drift:** evolves the "payment interface" into a full agent-to-agent protocol

## Prize Targets
| Sponsor | Prize | Target |
|---|---|---|
| Arc (Circle) | Best Agentic Economy with Circle Agent Stack | 1st |
| ENS | Best ENS Integration for AI Agents | 1st |
| ENS | Integrate ENS (pool) | Qualify |
| World | Track A (AgentKit) | 1st |

Estimated upside if all hit strongly: **~$8.7k–$9.2k** (plus ENS pool variability).

## Product Flow (Demo)
1. **Register agent**
   - Mint `agent-name.agentgate.eth`
   - Store capabilities + x402 endpoint + price in ENS text records
   - Register agent identity on Arc (ERC-8004 registry optional but recommended)
2. **Discover agent**
   - Consumer agent lists subnames under `agentgate.eth`
   - Resolves selected name to address + endpoint metadata
3. **Trust gate**
   - Consumer agent uses World AgentKit proof
   - Receives 3–5 free calls (trial mode)
4. **Paid usage**
   - After trial, calls require x402 payment
   - Settlement via Arc nanopayment flow in USDC
5. **Feedback**
   - Record service quality signal (onchain or app-level leaderboard)

## Architecture
- **SDK package (`packages/sdk`)**
  - `identity`: ENS register/read/discover
  - `payments`: x402 client wrapper + Arc settlement config
  - `trust`: World AgentKit client wrapper
- **Provider server (`packages/server`)**
  - x402-protected endpoints
  - AgentKit free-trial extension hooks
- **Demo app/scripts (`demo`)**
  - Provider agent + consumer agent end-to-end

## Core Integrations

### 1) Arc (Circle): x402 Nanopayments
- Use `@circle-fin/x402-batching` for buyer + seller paths.
- Buyer deposits USDC once, then signs offchain authorizations for per-call micro-payments.
- Seller endpoint enforces payment requirement (`402`) and validates settlement.

### 2) ENS: Identity + Discovery
- Use `@ensdomains/ensjs`.
- Programmatic subname creation under a parent (`agentgate.eth`).
- Text records:
  - `description`
  - `io.agentgate.capabilities`
  - `io.agentgate.x402-endpoint`
  - `io.agentgate.x402-price`
  - `io.agentgate.world-verified`

### 3) World: Human-Backed Agents
- Use `@worldcoin/agentkit`.
- Register agent wallet in AgentBook.
- Server config: free-trial mode (e.g., 5 uses per endpoint per human).
- After trial exhaustion, fall back to x402 payment path.

## 48-Hour Build Plan

### Phase 1 — Friday (5h): Payment Skeleton
- Monorepo scaffold
- Arc testnet wallet setup + funding
- x402 buyer wrapper (`agentgate.fetch`)
- x402 seller middleware endpoint
- Confirm paid request loop end-to-end

### Phase 2 — Saturday AM (4h): ENS Identity
- Parent ENS setup
- Subname registration function
- Metadata text record writer
- Discovery/read function from subgraph + resolver

### Phase 3 — Saturday PM (4h): World Trust Layer
- AgentKit registration flow for demo wallets
- AgentKit request wrapper on consumer side
- Server-side free-trial hook integration
- Validate verified-vs-unverified behavior

### Phase 4 — Saturday Night (4h): Unified Demo
- Combine identity + trust + payments in one flow
- Add minimal UI or CLI for “discover → call → pay”
- Add architecture diagram and final README

### Phase 5 — Sunday (4h): Submission Polish
- Record short demo video
- Ensure repo instructions run cleanly
- Prepare sponsor-specific explanation snippets

## Acceptance Criteria
- Agent can discover another agent via ENS.
- Verified human-backed agent gets initial free calls.
- After free calls, same endpoint enforces x402 payment.
- Payment settles via Arc path in USDC.
- Live demo clearly shows all three sponsor integrations as core, not cosmetic.

## Risks + Mitigations
- **Risk:** Cross-chain complexity (ENS + Arc + World) slows progress  
  **Mitigation:** Keep ENS + World verification/read path lightweight, keep payments only on Arc.
- **Risk:** Time lost on optional extras  
  **Mitigation:** Prioritize one polished end-to-end path over multiple half-built features.
- **Risk:** Demo fragility  
  **Mitigation:** Script deterministic demo wallets, fixed endpoints, and fallback CLI mode.

## Final Deliverables
- Public GitHub repo
- Working demo (live or local reproducible)
- Demo video
- Architecture diagram
- Clear sponsor mapping in README (Arc + ENS + World)

## Useful Resources

### Arc (Circle)
- Arc docs: https://docs.arc.io/
- Circle Gateway nanopayments: https://developers.circle.com/gateway/nanopayments.md
- x402 foundation repo: https://github.com/x402-foundation/x402
- Arc faucet: https://faucet.circle.com
- Arc explorer: https://testnet.arcscan.app

### ENS
- ENS docs: https://docs.ens.domains/
- ENS deployments (contract addresses): https://docs.ens.domains/learn/deployments
- ENS SDK (`ensjs`): https://github.com/ensdomains/ensjs
- ENS Sepolia app: https://sepolia.app.ens.domains/

### World
- World docs: https://docs.world.org/
- AgentKit integration guide: https://docs.world.org/agents/agent-kit/integrate
- AgentKit SDK reference: https://docs.world.org/agents/agent-kit/sdk-reference
- AgentBook: https://agentbook.world

### Quick constants
- Arc testnet chain ID: `5042002`
- Arc RPC: `https://rpc.testnet.arc.network`
- Arc USDC: `0x3600000000000000000000000000000000000000`
- Arc GatewayWallet: `0x0077777d7EBA4688BDeF3E311b846F25870A19B9`
- World AgentBook: `0xA23aB2712eA7BBa896930544C7d6636a96b944dA`

# AgentGate - Task Breakdown

This document outlines the specific tasks required to complete the AgentGate project for ETHGlobal 2026. Tasks are grouped logically to facilitate parallel development where possible.

## Phase 1: Foundation & Project Setup

*Goal: Establish the monorepo structure, tooling, and core dependencies.*

- [ ] **Task 1.1: Monorepo Scaffold**
  - Initialize a new Node.js monorepo (using Yarn workspaces, npm workspaces, or pnpm).
  - Configure base `package.json` with scripts for building and testing across workspaces.
  - Setup TypeScript configuration (`tsconfig.json` base).
  - Setup basic linting/formatting (ESLint/Prettier).
- [ ] **Task 1.2: Package Initialization**
  - Initialize `packages/sdk` package.
  - Initialize `packages/server` package.
  - Initialize `demo` package.
- [ ] **Task 1.3: Arc Testnet Setup**
  - Create and fund Arc testnet wallets for testing (Buyer and Seller wallets). See [Arc docs](https://docs.arc.io/) and [Arc faucet](https://faucet.circle.com).
  - Document the wallet addresses and private keys (in `.env.example` or local secure storage). Use [Arc RPC](https://rpc.testnet.arc.network) and chain ID `5042002`.

## Phase 2: Core SDK Development (Parallelizable)

*Goal: Build the client-side wrappers for Payments, Identity, and Trust. These can be developed somewhat independently.*

### 2A: Payments (Arc / x402)
- [ ] **Task 2A.1: x402 Client Setup**
  - Install `@circle-fin/x402-batching` in `packages/sdk`.
  - Create the x402 buyer wrapper (`agentgate.fetch` or similar). See [x402 foundation repo](https://github.com/x402-foundation/x402) and the [Circle nanopayments guide](https://developers.circle.com/gateway/nanopayments.md).
  - Implement logic for the initial USDC deposit (Arc USDC: `0x3600000000000000000000000000000000000000`).
  - Implement offchain authorization signing for per-call micropayments.

### 2B: Identity (ENS)
- [ ] **Task 2B.1: ENS Configuration**
  - Determine parent ENS name strategy (e.g., testnet deployment or using an existing Sepolia name). See [ENS docs](https://docs.ens.domains/) and [ENS deployments](https://docs.ens.domains/learn/deployments).
  - Install `@ensdomains/ensjs` in `packages/sdk` (see [ensjs](https://github.com/ensdomains/ensjs)).
- [ ] **Task 2B.2: Registration SDK**
  - Implement function to programmatically create subnames (e.g., `[name].agentgate.eth`). Use the [ENS Sepolia app](https://sepolia.app.ens.domains/) for manual testing.
  - Implement metadata text record writer (`description`, `io.agentgate.capabilities`, `io.agentgate.x402-endpoint`, `io.agentgate.x402-price`, `io.agentgate.world-verified`).
- [ ] **Task 2B.3: Discovery SDK**
  - Implement function to resolve subnames and read text records.
  - (Optional but recommended) Implement discovery query (e.g., via subgraph) to list available agents under the parent name.

### 2C: Trust (World AgentKit)
- [ ] **Task 2C.1: AgentKit Setup**
  - Install `@worldcoin/agentkit` in `packages/sdk`. See [World docs](https://docs.world.org/) and the [AgentKit integration guide](https://docs.world.org/agents/agent-kit/integrate).
- [ ] **Task 2C.2: Trust SDK**
  - Implement AgentKit request wrapper on the consumer side (see [AgentKit SDK reference](https://docs.world.org/agents/agent-kit/sdk-reference)).
  - Implement logic to register an agent wallet in the [AgentBook](https://agentbook.world).

## Phase 3: Agent Endpoint Server Development

*Goal: Build the communication endpoint for the AI agent that handles direct agent-to-agent requests, enforces payments, and verifies World identity/free trials.*

- [ ] **Task 3.1: Server Scaffold**
  - Setup a basic Express/Fastify server in `packages/server` to act as the agent's receiving endpoint.
- [ ] **Task 3.2: x402 Middleware**
  - Implement x402 seller middleware for incoming agent requests. Reference the [x402 repo](https://github.com/x402-foundation/x402) and [Circle nanopayments guide](https://developers.circle.com/gateway/nanopayments.md).
  - Enforce payment requirements (return HTTP 402 if payment is invalid/missing).
  - Validate and process Arc nanopayment settlements (use the [Arc explorer](https://testnet.arcscan.app) for debugging).
- [ ] **Task 3.3: Identity & Free-Trial Logic (World Integration)**
  - Integrate Server-side AgentKit free-trial extension hooks (see the [AgentKit integration guide](https://docs.world.org/agents/agent-kit/integrate)).
  - Implement state tracking (e.g., in-memory or lightweight DB) to track usage per verified human.
  - Configure logic: Allow 3-5 free uses, then fallback to requiring the x402 payment path.

## Phase 4: Integration & Demo Application

*Goal: Combine all pieces into a working end-to-end demonstration.*

- [ ] **Task 4.1: Provider Agent Setup (Demo)**
  - Create a script in `demo` to start the provider agent's server.
  - Ensure the agent registers its identity via ENS (Task 2B) and AgentBook (Task 2C) on startup.
- [ ] **Task 4.2: Consumer Agent CLI/UI (Demo)**
  - Create a minimal CLI or UI in `demo` representing the "Consumer Agent" that wants to interact with another agent.
  - Implement the "Discover" step: Find the provider agent via ENS (see [ENS docs](https://docs.ens.domains/) and [ensjs](https://github.com/ensdomains/ensjs)).
  - Implement the "Call" step (Trust Gate): Attempt a direct free call using World AgentKit identity proof (see [AgentKit integration guide](https://docs.world.org/agents/agent-kit/integrate)).
  - Implement the "Pay" step: Fallback to the x402 nanopayment flow for direct value exchange when the trial runs out (see [x402 foundation repo](https://github.com/x402-foundation/x402)).
- [ ] **Task 4.3: End-to-End Validation**
  - Run the full loop: Register -> Discover -> Free Call -> Paid Call -> Settlement.
  - Fix bugs and edge cases.

## Phase 5: Polish & Submission

*Goal: Prepare everything for the hackathon submission.*

- [ ] **Task 5.1: Documentation & README Polish**
  - Finalize `README.md` with concrete instructions on how to run the demo locally.
  - Ensure architecture diagrams are up-to-date.
- [ ] **Task 5.2: Demo Video**
  - Record a 2-3 minute video showing the end-to-end flow.
  - Ensure the UI/CLI output clearly demonstrates ENS discovery, World free-trial, and Arc settlement.
- [ ] **Task 5.3: Sponsor Submission Snippets**
  - Write short explanations specifically targeting the Arc, ENS, and World sponsor tracks.
- [ ] **Task 5.4: Final Review**
  - Check against Acceptance Criteria in `PLAN.md`.
  - Ensure repo is public and code is clean.

(See `docs/PLAN.md` for the full plan, acceptance criteria, and additional context.)

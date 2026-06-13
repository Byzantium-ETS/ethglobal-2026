# AgentGate — Task Breakdown

Granular, actionable tasks for the ETHGlobal 2026 build. See `docs/PLAN.md` for strategy, acceptance criteria, and resources.

---

## Phase 1: Foundation & Wallet Setup

*Goal: Monorepo scaffold + funded Arc testnet wallets ready for integration work.*

- [x] **Task 1.1: Monorepo Scaffold**
  - npm workspaces (`packages/*`, `demo`), root `tsconfig.json`, ESLint/Prettier config.
  - Root scripts: `build`, `lint`, `test`, `format`.

- [x] **Task 1.2: Package Initialization**
  - `packages/sdk` — stub modules (`identity.ts`, `payments.ts`, `trust.ts`), re-exported via `index.ts`.
  - `packages/server` — Express server with `GET /`, `POST /call`, x402 middleware stub.
  - `demo` — placeholder entrypoint referencing SDK.

- [ ] **Task 1.3: Arc Testnet Wallets** *(in progress)*
  - Create two wallets: **Buyer** (consumer agent) and **Seller** (provider agent).
  - Fund both with testnet ETH + USDC via [Arc faucet](https://faucet.circle.com).
  - Add wallet addresses and private key placeholders to `.env.example`.
  - Verify balances via [Arc explorer](https://testnet.arcscan.app) or RPC call.

- [ ] **Task 1.4: Environment Config Module**
  - Create a shared config loader (e.g., `packages/sdk/src/config.ts` or root-level) using `dotenv`.
  - Load and validate: `RPC_URL`, `ARC_RPC_URL`, `DEMO_PRIVATE_KEY`, `ARC_API_KEY`, `WORLD_API_KEY`, `ENS_PARENT`.
  - Fail fast with clear error messages on missing required vars.
  - Wire into both SDK and server packages.

---

## Phase 2: Core SDK Development

*Goal: Replace stubs with real integration code. Tracks 2A/2B/2C are parallelizable.*

### 2A: Payments — x402 + Arc

- [ ] **Task 2A.1: x402 Buyer Client**
  - Research the correct x402 client package (check [`x402` repo](https://github.com/x402-foundation/x402) for the canonical TS client — may be `x402` or `@x402/client`, not `@circle-fin/x402-batching`).
  - Install the package in `packages/sdk`.
  - Replace `PaymentsClient` stub with a wrapper that creates an x402-enabled fetch/client bound to the buyer wallet and Arc RPC.

- [ ] **Task 2A.2: Buyer Deposit Flow**
  - Implement USDC deposit (or approval) to the x402 payment channel / GatewayWallet (`0x0077777d7EBA4688BDeF3E311b846F25870A19B9`).
  - Use Arc USDC token at `0x3600000000000000000000000000000000000000`.
  - Expose a `deposit(amount)` method returning a tx hash.

- [ ] **Task 2A.3: Per-Call Payment Authorization**
  - Implement offchain micropayment signing per the x402 protocol.
  - Expose a method (e.g., `payForCall(endpoint, price)`) that returns the correct `X-402-Authorization` header value.
  - Write a minimal test script that signs an authorization and logs the header.

### 2B: Identity — ENS

- [ ] **Task 2B.1: ENS Parent Name Setup**
  - Decide testnet strategy: register `agentgate.eth` on Sepolia or use an existing test name.
  - Confirm `@ensdomains/ensjs` (already installed `^3.3.0`) works with chosen network.
  - Create a viem/ethers provider wired to `RPC_URL` for ENS operations.

- [ ] **Task 2B.2: Subname Registration**
  - Replace `registerSubname()` stub in `identity.ts` with real `ensjs` subname creation.
  - Accept: parent name, label, owner address, signer.
  - Return the created subname string and tx hash.

- [ ] **Task 2B.3: Metadata Writer**
  - Implement `setAgentMetadata(name, records, signer)` that writes text records:
    - `description`, `io.agentgate.capabilities`, `io.agentgate.x402-endpoint`, `io.agentgate.x402-price`, `io.agentgate.world-verified`.
  - Batch writes in a single transaction where possible.

- [ ] **Task 2B.4: Discovery / Resolver**
  - Replace `readTextRecords()` stub with real ENS text record resolution.
  - Add `discoverAgents(parent)` that lists known subnames (via subgraph or enumeration).
  - Return structured metadata objects, not raw strings.

### 2C: Trust — World AgentKit

- [ ] **Task 2C.1: AgentKit Package Setup**
  - Install `@worldcoin/agentkit` in `packages/sdk`.
  - Create AgentKit client instance with env-provided `WORLD_API_KEY`.

- [ ] **Task 2C.2: Agent Wallet Registration**
  - Replace `registerAgentWallet()` stub with real AgentBook registration call.
  - Accept wallet address, return registration status.
  - Handle already-registered case gracefully.

- [ ] **Task 2C.3: Verification Proof Request**
  - Replace `requestWorldProof()` stub with real AgentKit proof request flow.
  - Return a structured proof object that the server can validate.
  - Include the proof in outgoing request headers (e.g., `X-World-Proof`).

---

## Phase 3: Server — Payment Gate + Trust Gate

*Goal: Server enforces the full trust → trial → payment flow on `POST /call`.*

- [ ] **Task 3.1: x402 Seller Middleware**
  - Replace the header-presence stub in `x402Middleware.ts` with real x402 payment validation.
  - Install seller-side x402 package if separate from buyer (check [x402 repo](https://github.com/x402-foundation/x402)).
  - On missing/invalid payment: return HTTP `402` with a proper x402 challenge body (price, token, payee address).
  - On valid payment: attach payment metadata to `req` and call `next()`.

- [ ] **Task 3.2: Seller Wallet + Pricing Config**
  - Load seller wallet from env (`SELLER_PRIVATE_KEY` or similar).
  - Define pricing config for `/call` (e.g., `{ price: "0.001", token: "USDC", network: "arc-testnet" }`).
  - Expose pricing info on a `GET /price` or include in 402 challenge response.

- [ ] **Task 3.3: World Proof Verification**
  - Add middleware or route-level logic to extract and verify `X-World-Proof` header using AgentKit server-side SDK.
  - On valid proof: attach verified identity (e.g., wallet address or agent ID) to request context.
  - On missing proof: skip (allow anonymous paid access) or reject depending on config.

- [ ] **Task 3.4: Free-Trial Counter**
  - Implement in-memory store keyed by verified identity (from Task 3.3).
  - Track call count per identity per endpoint.
  - Config: `FREE_TRIAL_LIMIT` (default 5).
  - Logic: if verified + under limit → allow free; if verified + over limit → require x402; if unverified → require x402.

- [ ] **Task 3.5: Unified Request Flow**
  - Wire middleware chain on `POST /call`: World proof check → trial counter → x402 gate.
  - Return clear response states:
    - `{ status: "free_trial", remaining: N }` for trial calls.
    - `{ status: "paid", tx: "..." }` for paid calls.
    - HTTP 402 with challenge body when payment is required but missing.
  - Add a real agent response payload (even if trivial, e.g., echo or mock AI response).

---

## Phase 4: Demo — End-to-End Flow

*Goal: Scripted demo that proves the full product story with no manual code edits.*

- [ ] **Task 4.1: Provider Startup Script**
  - Create `demo/src/provider.ts`: starts server, registers ENS subname + metadata, registers wallet in AgentBook.
  - Log each step clearly with sponsor attribution (e.g., `[ENS] Registered my-agent.agentgate.eth`).
  - Handle errors gracefully (e.g., "already registered" is not fatal).

- [ ] **Task 4.2: Consumer Discovery Script**
  - Create `demo/src/consumer.ts` step 1: discover provider agent via ENS.
  - Resolve endpoint URL and pricing from ENS text records.
  - Log discovered metadata.

- [ ] **Task 4.3: Consumer Free-Call Flow**
  - In `consumer.ts` step 2: present World proof and make free trial calls.
  - Log trial remaining count from each response.
  - Show the transition point where trial is exhausted.

- [ ] **Task 4.4: Consumer Paid-Call Flow**
  - In `consumer.ts` step 3: after trial exhaustion, make a paid call using x402.
  - Sign payment authorization, attach header, call endpoint.
  - Log payment confirmation and response.

- [ ] **Task 4.5: Full Demo Runner**
  - Create `demo/src/run.ts` or npm script that orchestrates: start provider → run consumer flow.
  - Add `npm --workspace agentgate-demo run demo` script.
  - Ensure deterministic output suitable for recording.
  - Add a local fallback mode if external services are degraded.

---

## Phase 5: Polish & Submission

*Goal: Maximize judge clarity, minimize demo risk.*

- [ ] **Task 5.1: README Finalization**
  - Rewrite Getting Started with exact commands: install → env setup → build → run demo.
  - Add sponsor integration table mapping each prize to specific code paths.
  - Update architecture diagram if flow changed.

- [ ] **Task 5.2: Demo Video**
  - Record 2–3 minute video showing the end-to-end flow.
  - Narrate each step with sponsor call-outs (ENS discovery, World verification, Arc payment).
  - Use pre-funded wallets with verified balances.

- [ ] **Task 5.3: Sponsor Submission Writeups**
  - Arc: emphasize x402 nanopayments, USDC settlement, gasless UX.
  - ENS: emphasize programmatic subname registration, metadata-driven discovery.
  - World: emphasize human-backed trust, free-trial gating, AgentKit integration.

- [ ] **Task 5.4: Pre-Submission Checklist**
  - Verify all acceptance criteria from `PLAN.md`.
  - Clean install + build from scratch succeeds.
  - All env vars documented in `.env.example`.
  - No secrets committed (audit `.gitignore`).
  - Repo is public and README links work.

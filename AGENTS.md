# Copilot Instructions for AgentGate

## Build, test, and lint commands

Run commands from the repository root unless noted.

### Install
- `npm install`

### Build
- All workspaces: `npm run build`
- SDK only: `npm --workspace @agentgate/sdk run build`
- Server only: `npm --workspace @agentgate/server run build`
- Demo only: `npm --workspace agentgate-demo run build`

### Run
- Server (after build): `npm --workspace @agentgate/server run start`
- Demo (after build): `npm --workspace agentgate-demo run start`

### Lint
- Repo-wide: `npm run lint`

### Test
- Repo-wide: `npm run test`
- Single package:
  - `npm --workspace @agentgate/sdk run test`
  - `npm --workspace @agentgate/server run test`
  - `npm --workspace agentgate-demo run test`

> Current status: test scripts are placeholders (`"no tests"`), so there is no single-test-file command yet.

## High-level architecture

This is an npm-workspaces monorepo with three active packages:

1. `packages/sdk` (`@agentgate/sdk`)
   - Public SDK entrypoint: `src/index.ts`
   - Three modules map to the core product pillars:
     - `identity.ts` (ENS registration/read patterns)
     - `payments.ts` (x402 + Arc payment client surface)
     - `trust.ts` (World AgentKit proof/registration surface)
   - Exports are intentionally high-level and currently scaffolded as stubs.

2. `packages/server` (`@agentgate/server`)
   - Express provider service.
   - `src/x402Middleware.ts` is the payment gate used by protected routes.
   - `src/index.ts` wires `POST /call` through x402 middleware and returns a stubbed response.

3. `demo` (`agentgate-demo`)
   - Minimal integration entrypoint for local demo flow.
   - Intended to exercise SDK + server end-to-end as implementation matures.

The product flow described in `README.md` and `docs/PLAN.md` is:
- register agent identity (ENS),
- verify human backing (World),
- allow free-trial usage,
- then enforce x402 payments settled on Arc.

## External SDK references and agent-oriented docs

Use these as source-of-truth when implementing integrations:

- **Arc (Circle)**
  - Arc docs: https://docs.arc.io/
  - Arc chain reference: https://docs.arc.io/arc-chain.md
  - Arc contract addresses: https://docs.arc.io/arc/references/contract-addresses.md
  - Circle Gateway nanopayments (SDK usage + flow): https://developers.circle.com/gateway/nanopayments.md
  - Buyer quickstart: https://developers.circle.com/gateway/nanopayments/quickstarts/buyer.md
  - Seller quickstart: https://developers.circle.com/gateway/nanopayments/quickstarts/seller.md
  - Agent-friendly doc index (`llms.txt`): https://docs.arc.io/llms.txt

- **ENS**
  - ENS docs: https://docs.ens.domains/
  - ENS deployments: https://docs.ens.domains/learn/deployments
  - ENS SDK (`ensjs`) repo: https://github.com/ensdomains/ensjs
  - ENS SDK package: https://www.npmjs.com/package/@ensdomains/ensjs

- **World AgentKit**
  - AgentKit integration guide: https://docs.world.org/agents/agent-kit/integrate
  - AgentKit SDK reference: https://docs.world.org/agents/agent-kit/sdk-reference
  - AgentKit package: https://www.npmjs.com/package/@worldcoin/agentkit
  - AgentKit CLI package: https://www.npmjs.com/package/@worldcoin/agentkit-cli
  - AgentBook: https://agentbook.world

- **x402**
  - x402 foundation site: https://www.x402.org/
  - Canonical x402 repo (TS/Python SDKs): https://github.com/x402-foundation/x402

## Key conventions in this repository

- **Workspace-first workflow:** Use npm workspace commands (`npm --workspace ...`) rather than running tools directly inside package folders.
- **TypeScript outputs to `dist/` in every package:** each package `tsconfig.json` sets `rootDir: src` and `outDir: dist`.
- **Lint/test scripts are non-blocking right now:** root lint/test scripts include `|| true`, and package tests are placeholders. Do not assume quality gates are enforced by scripts yet.
- **SDK module boundaries are semantic, not utility-based:** keep new logic in `identity`, `payments`, or `trust` according to Arc/ENS/World ownership, and re-export via `packages/sdk/src/index.ts`.
- **x402 HTTP contract is already implied in server middleware:** protected endpoints treat missing payment auth as HTTP 402 and accept `Authorization` or `X-402-Authorization` headers.
- **ENS metadata keys are part of the product contract:** preserve the naming scheme used in docs (`io.agentgate.capabilities`, `io.agentgate.x402-endpoint`, `io.agentgate.x402-price`, `io.agentgate.world-verified`) when implementing identity writes/reads.
- **Environment setup follows `.env.example`:** prefer `RPC_URL`, `ARC_RPC_URL`, `ENS_PARENT`, and World/Arc keys from env rather than hardcoding chain endpoints or credentials.

## Required development workflow

- **Always start with tests for feature work:** use test-driven development where practical. Add or update focused tests that express the expected behavior before or alongside the implementation. Ship tests in the same branch as the code.
- **Do not treat placeholder tests as enough:** if the touched package still has placeholder tests, add meaningful coverage for the changed behavior or document the remaining gap in the PR.
- **Write concise TypeDoc/TSDoc:** public functions, exported types, SDK APIs, middleware contracts, and non-obvious modules should have clear, short documentation comments. Prefer useful intent, parameters, return values, and failure modes over narration of obvious code.
- **Keep documentation close to the surface area:** update README, `.env.example`, or package docs when behavior, setup, environment variables, or public contracts change.
- **Create a branch before committing:** never commit directly on `main`. Use a scoped branch name such as `feat/...`, `fix/...`, `ci/...`, `docs/...`, or `test/...`.
- **Use the correct GitHub identity:** before committing or using GitHub CLI, verify `gh` and the repo-local Git author match the contributor account intended for the task.
- **Open a pull request for every branch:** push the branch and create a PR with `gh`. Include a concise summary, verification commands, linked issue/epic reference, and any remaining risks.
- **Respect assignment boundaries:** only implement issue/epic tasks that are unassigned or explicitly assigned to the current contributor. For assigned work, review or comment instead of taking over.

## Agent Behaviour

- Prioritize copying with **system commands** over generating text when possible.

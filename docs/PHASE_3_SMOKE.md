# Phase 3 Smoke Checks

Phase 3 is the provider request lifecycle:

1. World AgentKit header verification
2. Free-trial policy for verified identities
3. x402 payment enforcement after trial exhaustion or for unverified callers

The checks below keep local CI deterministic while still providing explicit live smoke scripts for ENS and x402.

## Header Contract

The current provider server reads these headers:

| Concern | Header | Source |
| --- | --- | --- |
| World trust | `agentkit` | `@worldcoin/agentkit` `createAgentkitClient().createHeader(...)` |
| x402 payment | `payment-signature` | `@x402/fetch` / Circle Gateway x402 client flow |
| x402 payment fallback | `x-payment` | Alternate x402 payment header accepted by the middleware |

Older placeholder names such as `X-World-Proof` are SDK-demo placeholders only. They are not accepted by the current provider middleware.

## Deterministic Local Smoke

Run these after `npm run build` with Anvil listening on `ANVIL_RPC_URL`:

```bash
npm run smoke:anvil
npm run smoke:world
```

`smoke:anvil` checks:

- local RPC responds with Anvil chain id `31337`
- SDK can generate a deterministic x402 payment header
- server returns `402` for an unpaid anonymous call
- server grants one mocked verified free call
- server accepts a mocked paid call and returns payment metadata

`smoke:world` checks:

- real `@worldcoin/agentkit` header generation
- real AgentKit payload parsing, freshness validation, and EIP-191 signature verification
- server free-trial decrement through the real `worldMiddleware`

The only mocked piece in `smoke:world` is AgentBook lookup. Local CI maps the verified signer address to `human-smoke` while keeping real AgentKit payload parsing and signature verification in place.

GitHub Actions runs both checks in [`.github/workflows/phase-3-smoke.yml`](../.github/workflows/phase-3-smoke.yml) by installing Foundry, starting Anvil, building the workspaces, and executing the scripts.

## Live ENS Smoke

The ENS smoke script is intentionally gated because it writes testnet ENS records.

```bash
RUN_LIVE_ENS_SMOKE=true npm run smoke:ens
```

Required env:

- `ENS_RPC_URL`: Sepolia or Holesky RPC URL
- `DEMO_PRIVATE_KEY`: parent-owner key for the testnet ENS parent
- `ENS_PARENT`: parent name, for example `agentgate.eth`

Optional env:

- `ENS_RESOLVER_ADDRESS`: resolver to attach when registering the subname
- `ENS_SMOKE_LABEL`: fixed label instead of the default timestamp label
- `ENS_SMOKE_X402_ENDPOINT`: endpoint written to `io.agentgate.x402-endpoint`
- `ENS_SMOKE_X402_PRICE`: price written to `io.agentgate.x402-price`

The script resolves the parent owner, registers a subname, writes AgentGate metadata with `setAgentMetadata`, then reads the metadata back with `readAgentMetadata`.

## Live x402 Smoke

The x402 smoke script is also gated because it spends funded Gateway balance.

```bash
RUN_LIVE_X402_SMOKE=true npm run smoke:x402
```

Required env:

- `ARC_RPC_URL`
- `CIRCLE_API_KEY` or `ARC_API_KEY`
- `SELLER_ADDRESS`
- `BUYER_PRIVATE_KEY` or `DEMO_PRIVATE_KEY`

Optional env:

- `AGENTGATE_PROVIDER_URL`: existing `/call` endpoint. If omitted, the script starts the local provider server after build.
- `CALL_PRICE`: atomic USDC amount, default `1000` (`0.001` USDC)

The script first calls `/call` without payment and expects HTTP `402`. It then checks the buyer Gateway balance and uses `PaymentsClient.pay(...)` to perform the paid request.

## Config Checks

Default CI runs:

```bash
npm run check:env
npm run check:secrets
```

`check:env` fails when code reads an env var that is absent from [`.env.example`](../.env.example).

`check:secrets` scans tracked files for committed `.env` files, private-key-looking hex values, private key block markers, and non-placeholder secret assignments. Known public test keys used by Anvil/Hardhat fixtures are allowed.

## Demo Runner

The demo entrypoint is:

```bash
npm --workspace agentgate-demo run start
```

It performs provider setup probing, optional ENS discovery, free calls through SDK `fetchWithWorldTrust(...)` (AgentKit client flow), and an optional paid call with `RUN_DEMO_PAID_CALL=true`.

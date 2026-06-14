# Onchain Integration Workflow

Use the `Onchain Integration` GitHub Actions workflow for funded-wallet checks that need private keys, Arc RPC access, or live Gateway state. The default pull request CI must stay secret-free and should not run this workflow automatically.

## Why This Is Manual

The onchain workflow can use funded wallets and may send a real USDC Gateway deposit transaction. It is intentionally triggered only with `workflow_dispatch` so normal pull requests cannot spend funds or expose private-key material to untrusted code.

## Required Actions Secrets

Configure these repository secrets before running the workflow:

- `ENS_RPC_URL`
- `ARC_RPC_URL`
- `ARC_API_KEY`
- `WORLD_API_KEY`
- `DEMO_PRIVATE_KEY` or `BUYER_PRIVATE_KEY`
- `ENS_PARENT`

Optional secrets:

- `BUYER_ADDRESS`
- `SELLER_ADDRESS`

## Recommended Actions Variables

Non-sensitive values can be stored as repository variables:

- `BUYER_ADDRESS`
- `SELLER_ADDRESS`
- `ENS_PARENT`

## Running The Workflow

In GitHub Actions, choose `Onchain Integration` and click `Run workflow`.

Inputs:

- `run_deposit`: `false` by default. When false, the workflow builds the SDK and checks wallet/Gateway balances without sending a deposit transaction.
- `deposit_amount`: USDC amount to deposit when `run_deposit` is true. Defaults to `0.01`.

## Local Equivalent

To run the same test locally after configuring `.env`:

```bash
npm run test:onchain
```

To allow the test to send a real deposit transaction:

```bash
RUN_ONCHAIN_DEPOSIT=true ONCHAIN_DEPOSIT_AMOUNT=0.01 npm run test:onchain
```

## Safety Rules

- Do not add private-key secrets to the default PR CI workflow.
- Do not enable real deposits by default.
- Keep `RUN_ONCHAIN_DEPOSIT=false` unless the wallet is funded intentionally and the transaction is expected.
- Treat logs as public. Never print private keys or raw secret values.

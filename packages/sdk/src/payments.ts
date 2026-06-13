// Payments client: x402-enabled buyer helper
// Implements a minimal wrapper around Circle's GatewayClient + x402 fetch wrapper

import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { BatchEvmScheme, CompositeEvmScheme } from "@circle-fin/x402-batching/client";
import { GatewayClient, type SupportedChainName } from "@circle-fin/x402-batching/client";
import { privateKeyToAccount } from "viem/accounts";

export interface PaymentsClientOptions {
  privateKey: `0x${string}`;
  rpcUrl?: string;
  chain?: SupportedChainName;
  fetchImpl?: typeof fetch;
}

export class PaymentsClient {
  public readonly gateway: GatewayClient;
  public readonly buyerAddress: `0x${string}`;
  public readonly chain: SupportedChainName;

  private readonly fetchWithPayment: ReturnType<typeof wrapFetchWithPayment>;

  constructor(opts: PaymentsClientOptions) {
    if (!opts?.privateKey) throw new Error("PaymentsClient requires a privateKey in options");

    const chain = opts.chain ?? ("arcTestnet" as SupportedChainName);
    const signer = privateKeyToAccount(opts.privateKey as `0x${string}`);

    // Create an x402 client and register a composite scheme that supports
    // both Gateway batched payments and standard onchain exact payments.
    const client = new x402Client();
    client.register(
      "eip155:*",
      new CompositeEvmScheme(new BatchEvmScheme(signer as any), new ExactEvmScheme(signer as any)) as any,
    );

    // Wrap fetch so callers can use pay(url, init) and the wrapper will handle 402 flows
    this.fetchWithPayment = wrapFetchWithPayment(opts.fetchImpl ?? (globalThis.fetch as typeof fetch), client as any);

    // Create GatewayClient for deposits / balance checks
    this.gateway = new GatewayClient({
      chain,
      privateKey: opts.privateKey,
      ...(opts.rpcUrl ? { rpcUrl: opts.rpcUrl } : {}),
    });

    this.buyerAddress = this.gateway.address as `0x${string}`;
    this.chain = chain;
  }

  // High-level pay method: performs an x402-enabled request and returns the final Response
  async pay(input: string, init?: RequestInit): Promise<Response> {
    return this.fetchWithPayment(input, init);
  }

  // Convenience: deposit decimal USDC string into Gateway (one-time onchain tx)
  async deposit(amount: string) {
    return this.gateway.deposit(amount);
  }

  // Get balances (wallet + gateway)
  async getBalances() {
    return this.gateway.getBalances();
  }
}

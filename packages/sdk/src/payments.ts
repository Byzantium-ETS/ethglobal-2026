// Payments client: x402-enabled buyer helper
// Implements a minimal wrapper around Circle's GatewayClient + x402 fetch wrapper

import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { encodePaymentSignatureHeader } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { BatchEvmScheme, CompositeEvmScheme } from "@circle-fin/x402-batching/client";
import { GatewayClient, type SupportedChainName } from "@circle-fin/x402-batching/client";
import { privateKeyToAccount } from "viem/accounts";

import { parseUnits } from "viem";

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
  public readonly internalClient: x402Client;

  private readonly fetchWithPayment: ReturnType<typeof wrapFetchWithPayment>;

  constructor(opts: PaymentsClientOptions) {
    if (!opts?.privateKey) throw new Error("PaymentsClient requires a privateKey in options");

    const chain = opts.chain ?? ("arcTestnet" as SupportedChainName);
    const signer = privateKeyToAccount(opts.privateKey as `0x${string}`);

    // Create an x402 client and register a composite scheme that supports
    // both Gateway batched payments and standard onchain exact payments.
    this.internalClient = new x402Client();
    this.internalClient.register(
      "eip155:*",
      new CompositeEvmScheme(new BatchEvmScheme(signer as any), new ExactEvmScheme(signer as any)) as any,
    );

    // Wrap fetch so callers can use pay(url, init) and the wrapper will handle 402 flows
    this.fetchWithPayment = wrapFetchWithPayment(opts.fetchImpl ?? (globalThis.fetch as typeof fetch), this.internalClient as any);

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

  // Manual payment header generation for a specific call (without handling 402 automatically)
  async payForCall(endpoint: string, price: string, token: string = "USDC"): Promise<string> {
    const baseAmount = parseUnits(price, 6).toString(); // Convert 0.001 to 1000 (USDC has 6 decimals)

    const paymentRequired: any = {
      x402Version: 2,
      resource: { id: endpoint, name: endpoint },
      accepts: [{
        scheme: "exact",
        network: "eip155:5042002",
        asset: "0x3600000000000000000000000000000000000000",
        amount: baseAmount,
        payTo: "0x0000000000000000000000000000000000000000", // Placeholder
        maxTimeoutSeconds: 60,
        extra: {
          name: "GatewayWalletBatched",
          version: "1",
          verifyingContract: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9"
        }
      }]
    };

    const payload = await this.internalClient.createPaymentPayload(paymentRequired);
    return encodePaymentSignatureHeader(payload as any);
  }
}

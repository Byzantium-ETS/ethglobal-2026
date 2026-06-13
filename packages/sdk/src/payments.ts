// Payments module stub
// TODO: implement x402 buyer wrapper and payment helpers

export class PaymentsClient {
  constructor(opts?: { rpcUrl?: string }) {}

  async deposit(amountUsdCents: number): Promise<string> {
    // placeholder
    return `deposit:${amountUsdCents}`;
  }

  async authorizeMicropayment(amountCents: number): Promise<string> {
    return `auth:${amountCents}`;
  }
}

import { describe, it, expect, beforeEach } from 'vitest';
import { PaymentsClient } from '../src/payments';

describe('PaymentsClient - Per-Call Payment Authorization', () => {
  const testPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // standard hardhat key 1
  let client: PaymentsClient;

  beforeEach(() => {
    client = new PaymentsClient({
      privateKey: testPrivateKey,
    });
  });

  it('should initialize correctly with a private key', () => {
    expect(client.buyerAddress).toBeDefined();
    expect(client.buyerAddress.startsWith('0x')).toBe(true);
    expect(client.chain).toBe('arcTestnet');
  });

  it('should generate a valid base64-encoded X-402-Authorization header via payForCall', async () => {
    const endpoint = 'http://localhost:3000/call';
    const price = '0.001'; // 0.001 USDC
    const token = 'USDC';

    const authHeader = await client.payForCall(endpoint, price, token);
    expect(authHeader).toBeDefined();
    expect(typeof authHeader).toBe('string');
    expect(authHeader.length).toBeGreaterThan(0);

    // Decode the header to verify protocol properties
    const decodedRaw = Buffer.from(authHeader, 'base64').toString('utf-8');
    const decoded = JSON.parse(decodedRaw);
    expect(decoded.x402Version).toBe(2);
    expect(decoded.resource).toBeDefined();
    expect(decoded.resource?.id).toBe(endpoint);
    expect(decoded.accepted).toBeDefined();
    expect(decoded.accepted.scheme).toBe('exact');
    expect(decoded.accepted.amount).toBe('1000'); // 0.001 USDC * 10^6
    expect(decoded.accepted.network).toBe('eip155:5042002'); // arcTestnet chain ID
  });
});

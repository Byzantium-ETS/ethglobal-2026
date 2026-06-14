import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { URL } from 'node:url';

type JsonResponse<T = unknown> = {
  status: number;
  body: T;
  text: string;
};

type DemoCallRequest = {
  providerUrl?: string;
  prompt?: string;
  mode?: string;
  agentkitHeader?: string;
  paymentHeader?: string;
};

type AgentMetadata = {
  name: string;
  description?: string;
  capabilities: string[];
  x402Endpoint?: string;
  x402Price?: string;
  worldVerified?: boolean;
  records: Record<string, string>;
};

type DiscoverySdk = {
  discoverAgents?: (parentName: string, options: { rpcUrl: string }) => Promise<AgentMetadata[]>;
};

type TrustSdk = {
  requestWorldProof: (endpoint: string, challengeData?: string) => Promise<{ success: boolean; proof?: string }>;
};

type PaymentSdk = {
  PaymentsClient: new (options: { privateKey: `0x${string}`; rpcUrl: string; fetchImpl?: typeof fetch }) => {
    pay(input: string, init?: RequestInit): Promise<Response>;
  };
};

type DemoAuthMetadata = {
  mode: string;
  worldProof: 'provided' | 'generated' | 'missing' | 'not_requested';
  payment: 'provided' | 'sdk' | 'missing' | 'not_requested';
  errors: string[];
};

type DemoCallResult = {
  ok: boolean;
  providerUrl: string;
  status: number;
  body: unknown;
  text: string;
  auth: DemoAuthMetadata;
};

const mimeTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : undefined;
}

function defaultProviderUrl(): string {
  return env('AGENTGATE_PROVIDER_URL') ?? 'http://127.0.0.1:3000/call';
}

function getDemoPort(): number {
  const raw = env('DEMO_PORT');
  return raw ? parseInt(raw, 10) : 5173;
}

function normalizedPrivateKey(value: string): `0x${string}` {
  return (value.startsWith('0x') ? value : `0x${value}`) as `0x${string}`;
}

function publicRoot(): string {
  return path.resolve(__dirname, '../public');
}

function parseJson(text: string): unknown {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function writeJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readRequestJson<T>(req: http.IncomingMessage): Promise<T> {
  const text = await readBody(req);
  return (text ? JSON.parse(text) : {}) as T;
}

function validatedProviderUrl(raw: string | undefined): string {
  const candidate = raw && raw.trim() !== '' ? raw.trim() : defaultProviderUrl();
  const parsed = new URL(candidate);

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Provider URL must use http or https');
  }

  return parsed.toString();
}

function providerRoot(providerUrl: string): string {
  return new URL('/', providerUrl).toString();
}

async function readJson<T = unknown>(response: Response): Promise<JsonResponse<T>> {
  const text = await response.text();
  return {
    status: response.status,
    body: parseJson(text) as T,
    text,
  };
}

function newAuthMetadata(mode: string): DemoAuthMetadata {
  return {
    mode,
    worldProof: mode === 'world' ? 'missing' : 'not_requested',
    payment: mode === 'paid' ? 'missing' : 'not_requested',
    errors: [],
  };
}

async function resolveWorldHeader(callUrl: string, payload: DemoCallRequest, auth: DemoAuthMetadata): Promise<string | undefined> {
  const configuredHeader = payload.agentkitHeader ?? env('DEMO_AGENTKIT_HEADER') ?? env('AGENTKIT_HEADER');
  if (configuredHeader) {
    auth.worldProof = 'provided';
    return configuredHeader;
  }

  try {
    const sdk = await import('@agentgate/sdk') as unknown as TrustSdk;
    const statement = env('DEMO_AGENTKIT_STATEMENT') ?? 'AgentGate demo free call';
    const proof = await sdk.requestWorldProof(callUrl, statement);
    if (proof.success && proof.proof) {
      auth.worldProof = 'generated';
      return proof.proof;
    }

    auth.errors.push('World proof generation returned no proof.');
  } catch (error) {
    auth.errors.push(`World proof generation failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return undefined;
}

function buildCallBody(payload: DemoCallRequest): string {
  return JSON.stringify({
    prompt: payload.prompt ?? 'AgentGate demo call',
    mode: payload.mode ?? 'challenge',
  });
}

async function runPaidSdkCall(
  callUrl: string,
  payload: DemoCallRequest,
  auth: DemoAuthMetadata,
  fetchImpl: typeof fetch,
): Promise<JsonResponse> {
  const privateKey = env('BUYER_PRIVATE_KEY') ?? env('DEMO_PRIVATE_KEY');
  const arcRpcUrl = env('ARC_RPC_URL');

  if (!privateKey || !arcRpcUrl) {
    auth.errors.push('Paid call requires BUYER_PRIVATE_KEY or DEMO_PRIVATE_KEY plus ARC_RPC_URL.');
    throw new Error('Missing paid-call wallet configuration');
  }

  const sdk = await import('@agentgate/sdk') as unknown as PaymentSdk;
  const client = new sdk.PaymentsClient({
    privateKey: normalizedPrivateKey(privateKey),
    rpcUrl: arcRpcUrl,
    fetchImpl,
  });

  auth.payment = 'sdk';
  return readJson(await client.pay(callUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: buildCallBody(payload),
  }));
}

/**
 * Runs one provider call for the browser demo.
 *
 * The demo server owns sensitive work: it can attach AgentKit proof headers
 * and x402 payment authorization without exposing keys to the browser.
 */
export async function runDemoCall(payload: DemoCallRequest, fetchImpl: typeof fetch = fetch): Promise<DemoCallResult> {
  const callUrl = validatedProviderUrl(payload.providerUrl);
  const mode = payload.mode ?? 'challenge';
  const auth = newAuthMetadata(mode);

  if (mode === 'paid' && !payload.paymentHeader) {
    try {
      const paid = await runPaidSdkCall(callUrl, payload, auth, fetchImpl);
      return {
        ok: paid.status >= 200 && paid.status < 400,
        providerUrl: callUrl,
        status: paid.status,
        body: paid.body,
        text: paid.text,
        auth,
      };
    } catch (error) {
      auth.errors.push(`Paid SDK call failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };

  if (mode === 'world') {
    const header = await resolveWorldHeader(callUrl, payload, auth);
    if (header) headers.agentkit = header;
  }

  if (mode === 'paid' && payload.paymentHeader) {
    headers['x-payment'] = payload.paymentHeader;
    auth.payment = 'provided';
  }

  const response = await readJson(await fetchImpl(callUrl, {
    method: 'POST',
    headers,
    body: buildCallBody(payload),
  }));

  return {
    ok: response.status >= 200 && response.status < 400,
    providerUrl: callUrl,
    status: response.status,
    body: response.body,
    text: response.text,
    auth,
  };
}

async function proxyHealth(reqUrl: URL, res: http.ServerResponse): Promise<void> {
  try {
    const provider = validatedProviderUrl(reqUrl.searchParams.get('providerUrl') ?? undefined);
    const response = await readJson(await fetch(providerRoot(provider)));

    writeJson(res, 200, {
      ok: response.status >= 200 && response.status < 500,
      providerUrl: provider,
      rootUrl: providerRoot(provider),
      status: response.status,
      body: response.body,
    });
  } catch (error) {
    writeJson(res, 502, {
      ok: false,
      status: 502,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function proxyCall(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    const payload = await readRequestJson<DemoCallRequest>(req);
    writeJson(res, 200, await runDemoCall(payload));
  } catch (error) {
    writeJson(res, 502, {
      ok: false,
      providerUrl: defaultProviderUrl(),
      status: 502,
      body: { status: 'provider_unavailable' },
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function staticFilePath(reqUrl: URL): string | null {
  const root = publicRoot();
  const requestedPath = decodeURIComponent(reqUrl.pathname === '/' ? '/index.html' : reqUrl.pathname);
  const filePath = path.normalize(path.join(root, requestedPath));
  const relative = path.relative(root, filePath);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }

  return filePath;
}

function serveStatic(reqUrl: URL, res: http.ServerResponse): void {
  const filePath = staticFilePath(reqUrl);

  if (!filePath) {
    writeJson(res, 403, { error: 'Forbidden' });
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      writeJson(res, 404, { error: 'Not found' });
      return;
    }

    const contentType = mimeTypes[path.extname(filePath)] ?? 'application/octet-stream';
    res.writeHead(200, {
      'content-type': contentType,
      'cache-control': 'no-store',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

async function routeRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const reqUrl = new URL(req.url ?? '/', 'http://127.0.0.1');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (reqUrl.pathname === '/api/health' && req.method === 'GET') {
    await proxyHealth(reqUrl, res);
    return;
  }

  if (reqUrl.pathname === '/api/call' && req.method === 'POST') {
    await proxyCall(req, res);
    return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    serveStatic(reqUrl, res);
    return;
  }

  writeJson(res, 405, { error: 'Method not allowed' });
}

/**
 * Creates the static demo server and same-origin proxy used by the browser UI.
 *
 * The proxy keeps the frontend simple while avoiding CORS changes in the
 * unfinished provider backend.
 */
export function createDemoServer(): http.Server {
  return http.createServer((req, res) => {
    routeRequest(req, res).catch((error) => {
      writeJson(res, 500, {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  });
}

/**
 * Starts the AgentGate demo UI server on DEMO_PORT, defaulting to 5173.
 */
export function startDemoServer(port: number = getDemoPort()): http.Server {
  const server = createDemoServer();
  return server.listen(port, '127.0.0.1', () => {
    console.log(`AgentGate demo UI listening on http://127.0.0.1:${port}`);
    console.log(`Proxying provider calls to ${defaultProviderUrl()} by default`);
  });
}

async function checkProviderCli(providerUrl: string): Promise<void> {
  const rootUrl = providerRoot(providerUrl);
  const response = await readJson(await fetch(rootUrl));
  console.log(`[demo] provider ${rootUrl} -> ${response.status}`);
  console.log(response.body);
}

async function discoverProvider(providerUrl: string): Promise<AgentMetadata> {
  const ensParent = env('ENS_PARENT');
  const rpcUrl = env('RPC_URL');

  if (env('RUN_DEMO_DISCOVERY') === 'true' && ensParent && rpcUrl) {
    const sdk = await import('@agentgate/sdk') as unknown as DiscoverySdk;

    if (typeof sdk.discoverAgents === 'function') {
      const agents = await sdk.discoverAgents(ensParent, { rpcUrl });
      const selected = agents.find((agent: AgentMetadata) => agent.x402Endpoint) ?? agents[0];
      if (selected) {
        console.log(`[demo] discovered ${agents.length} ENS agent(s); selected ${selected.name}`);
        return selected;
      }
    } else {
      console.log('[demo] ENS discovery unavailable in the current built SDK; using provider URL from env/default');
    }
  }

  console.log('[demo] ENS discovery skipped; using provider URL from env/default');
  return {
    name: env('DEMO_AGENT_NAME') ?? 'local.agentgate.eth',
    description: 'Local AgentGate provider',
    capabilities: ['demo', 'phase-3'],
    x402Endpoint: providerUrl,
    x402Price: env('DEMO_X402_PRICE') ?? '0.001',
    worldVerified: false,
    records: {},
  };
}

async function runFreeCalls(callUrl: string): Promise<void> {
  const configuredHeader = env('DEMO_AGENTKIT_HEADER') ?? env('AGENTKIT_HEADER');
  const shouldRunFreeCalls = configuredHeader || env('RUN_DEMO_FREE_CALLS') === 'true';
  const attempts = Number(env('DEMO_FREE_CALLS') ?? '2');
  const statement = env('DEMO_AGENTKIT_STATEMENT') ?? 'AgentGate demo free call';

  if (!shouldRunFreeCalls) {
    console.log('[demo] free calls skipped: set RUN_DEMO_FREE_CALLS=true to generate AgentKit headers with the SDK');
    return;
  }

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const sdk = configuredHeader ? null : await import('@agentgate/sdk') as unknown as TrustSdk;
    const proof = configuredHeader ? { success: true, proof: configuredHeader } : await sdk!.requestWorldProof(callUrl, statement);
    if (!proof.success || !proof.proof) {
      throw new Error('[demo] failed to generate AgentKit header for free call');
    }

    const response = await readJson(await fetch(callUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        agentkit: proof.proof,
      },
      body: JSON.stringify({ prompt: `free demo call ${attempt}` }),
    }));
    console.log(`[demo] free call ${attempt} -> ${response.status}`);
    console.log(response.body);
  }
}

async function runPaidCall(callUrl: string): Promise<void> {
  const privateKey = env('BUYER_PRIVATE_KEY') ?? env('DEMO_PRIVATE_KEY');
  const arcRpcUrl = env('ARC_RPC_URL');

  if (env('RUN_DEMO_PAID_CALL') !== 'true') {
    const unpaid = await readJson(await fetch(callUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'unpaid demo probe' }),
    }));
    console.log(`[demo] unpaid probe -> ${unpaid.status}`);
    console.log(unpaid.body);
    console.log('[demo] paid call skipped: set RUN_DEMO_PAID_CALL=true with BUYER_PRIVATE_KEY and ARC_RPC_URL');
    return;
  }

  if (!privateKey || !arcRpcUrl) {
    throw new Error('[demo] RUN_DEMO_PAID_CALL=true requires BUYER_PRIVATE_KEY or DEMO_PRIVATE_KEY plus ARC_RPC_URL');
  }

  const sdk = await import('@agentgate/sdk') as unknown as PaymentSdk;
  const client = new sdk.PaymentsClient({
    privateKey: normalizedPrivateKey(privateKey),
    rpcUrl: arcRpcUrl,
  });
  const response = await client.pay(callUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: 'paid demo call' }),
  });
  const paid = await readJson(response);
  console.log(`[demo] paid call -> ${paid.status}`);
  console.log(paid.body);
}

async function runCliDemo(): Promise<void> {
  const providerUrl = defaultProviderUrl();

  console.log('[demo] AgentGate Phase 3 runner');
  await checkProviderCli(providerUrl);

  const provider = await discoverProvider(providerUrl);
  const callUrl = provider.x402Endpoint ?? providerUrl;
  console.log(`[demo] call endpoint ${callUrl}`);

  await runFreeCalls(callUrl);
  await runPaidCall(callUrl);
}

if (require.main === module) {
  if (env('DEMO_MODE') === 'cli') {
    runCliDemo().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  } else {
    startDemoServer();
  }
}

import express from 'express';
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { addEnsContracts, createEnsPublicClient } from '@ensdomains/ensjs';
import { createPublicClient, formatUnits, http } from 'viem';
import { holesky, mainnet, sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import {
  discoverAgents,
  PaymentsClient,
  readAgentMetadata,
  requestWorldProof,
  setAgentMetadata,
  verifyAgentWalletRegistration,
} from '@agentgate/sdk';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

const DEFAULT_PROVIDER_URL = 'http://127.0.0.1:3000/call';
const DEFAULT_WORLD_RPC_URL = 'https://worldchain-sepolia.g.alchemy.com/public';
const DEFAULT_ARC_PRICE = '1000';

const TICKET_EVENT = {
  name: 'AgentGate Live 2026',
  venue: 'ETHGlobal Showcase Hall',
  date: 'Finals Night',
  section: 'General Admission',
  maxPerVerifiedHuman: 2,
  maxWithoutWorld: 0,
  priceAtomicUsdc: DEFAULT_ARC_PRICE,
  currency: 'USDC',
};

type StepState = 'ready' | 'pass' | 'warn' | 'fail';

type StepResult = {
  state: StepState;
  title: string;
  summary: string;
  details?: unknown;
};

type EnvStatus = {
  name: string;
  present: boolean;
};

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : undefined;
}

function required(name: string): string {
  const value = env(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function normalizePrivateKey(value: string): `0x${string}` {
  return (value.startsWith('0x') ? value : `0x${value}`) as `0x${string}`;
}

function getProviderUrl(): string {
  return env('AGENTGATE_PROVIDER_URL') ?? DEFAULT_PROVIDER_URL;
}

function getBuyerPrivateKey(): `0x${string}` {
  return normalizePrivateKey(env('BUYER_PRIVATE_KEY') ?? required('DEMO_PRIVATE_KEY'));
}

function getEnsChain(chainId: number) {
  if (chainId === sepolia.id) return sepolia;
  if (chainId === holesky.id) return holesky;
  if (chainId === mainnet.id) return mainnet;
  throw new Error(`Unsupported ENS chain id ${chainId}`);
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function getEnsChainContext() {
  const rpcUrl = required('RPC_URL');
  const publicClient = createPublicClient({ transport: http(rpcUrl) });
  const chainId = await publicClient.getChainId();
  const baseChain = getEnsChain(chainId);
  const chainName = baseChain.name;
  const chain = addEnsContracts(baseChain);
  const ensPublicClient = createEnsPublicClient({ chain, transport: http(rpcUrl) });
  return { rpcUrl, chain, chainId, chainName, ensPublicClient };
}

function toStep(title: string, state: StepState, summary: string, details?: unknown): StepResult {
  return { title, state, summary, details };
}

function errorStep(title: string, error: unknown): StepResult {
  const message = error instanceof Error ? error.message : String(error);
  return toStep(title, 'fail', message);
}

function envStatus(): EnvStatus[] {
  return [
    'RPC_URL',
    'DEMO_PRIVATE_KEY',
    'ENS_PARENT',
    'ARC_RPC_URL',
    'BUYER_PRIVATE_KEY',
    'SELLER_ADDRESS',
    'CIRCLE_API_KEY',
    'ARC_API_KEY',
    'WORLD_RPC_URL',
    'AGENTGATE_PROVIDER_URL',
    'RUN_LIVE_ENS_SMOKE',
    'RUN_DEMO_FREE_CALLS',
    'RUN_DEMO_PAID_CALL',
  ].map((name) => ({ name, present: Boolean(env(name)) }));
}

function ticketQuantity(input: unknown): number {
  const parsed = Number(input ?? 1);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 6) {
    throw new Error('Ticket quantity must be an integer from 1 to 6');
  }
  return parsed;
}

function ticketLimitStep(quantity: number, worldStep: StepResult): StepResult {
  const registered = Boolean((worldStep.details as { registered?: boolean } | undefined)?.registered);
  const limit = registered ? TICKET_EVENT.maxPerVerifiedHuman : TICKET_EVENT.maxWithoutWorld;
  const allowed = quantity <= limit;
  let summary = 'Wallet is not AgentBook-registered, so this primary-sale rule allows 0 tickets.';

  if (allowed) {
    summary = `Approved for ${quantity} ticket(s); verified humans can buy up to ${limit}.`;
  } else if (registered) {
    summary = `Requested ${quantity}, but verified humans are capped at ${limit}.`;
  }

  return toStep(
    'Anti-scalper ticket rule',
    allowed ? 'pass' : 'warn',
    summary,
    {
      requested: quantity,
      maxAllowed: limit,
      registeredHumanBackedWallet: registered,
      rule: 'one registered human-backed wallet, max two tickets',
    },
  );
}

async function checkEns(): Promise<StepResult> {
  try {
    const ensParent = required('ENS_PARENT');
    const { rpcUrl, chainId, chainName, ensPublicClient } = await getEnsChainContext();
    const owner = await ensPublicClient.getOwner({ name: ensParent });
    const resolver = await ensPublicClient.getResolver({ name: ensParent });

    return toStep(
      'ENS parent',
      owner?.owner ? 'pass' : 'warn',
      owner?.owner
        ? `${ensParent} resolves on ${chainName}`
        : `${ensParent} has no owner on ${chainName}; live registration will not run`,
      {
        chain: chainName,
        chainId,
        parent: ensParent,
        owner: owner?.owner ?? null,
        resolver: resolver ?? null,
        rpcConfigured: Boolean(rpcUrl),
      },
    );
  } catch (error) {
    return errorStep('ENS parent', error);
  }
}

async function discoverEnsAgents(): Promise<StepResult> {
  try {
    const parent = required('ENS_PARENT');
    const { rpcUrl, chain } = await getEnsChainContext();
    const agents = await discoverAgents(parent, { rpcUrl, chain, pageSize: 25 });

    return toStep(
      'ENS discovery',
      agents.length > 0 ? 'pass' : 'warn',
      agents.length > 0 ? `Discovered ${agents.length} agent(s)` : `No AgentGate subnames found under ${parent}`,
      { agents },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return toStep('ENS discovery', 'warn', `ENS subgraph discovery unavailable: ${message}`);
  }
}

async function readConfiguredAgent(): Promise<StepResult> {
  try {
    const name = env('DEMO_AGENT_NAME');
    if (!name) return toStep('ENS metadata', 'warn', 'DEMO_AGENT_NAME is not set');

    const { rpcUrl, chain } = await getEnsChainContext();
    const metadata = await readAgentMetadata(name, { rpcUrl, chain });
    return toStep('ENS metadata', metadata.x402Endpoint ? 'pass' : 'warn', `Read metadata for ${metadata.name}`, metadata);
  } catch (error) {
    return errorStep('ENS metadata', error);
  }
}

async function writeEnsMetadata(): Promise<StepResult> {
  try {
    if (env('RUN_LIVE_ENS_SMOKE') !== 'true') {
      return toStep('ENS write', 'warn', 'Skipped: set RUN_LIVE_ENS_SMOKE=true to write testnet ENS metadata');
    }

    const name = required('DEMO_AGENT_NAME');
    const account = privateKeyToAccount(normalizePrivateKey(required('DEMO_PRIVATE_KEY')));
    const { rpcUrl, chain } = await getEnsChainContext();
    const endpoint = getProviderUrl();
    const records = {
      description: 'AgentGate visual demo provider',
      'io.agentgate.capabilities': ['visual-demo', 'phase-3'],
      'io.agentgate.x402-endpoint': endpoint,
      'io.agentgate.x402-price': env('DEMO_X402_PRICE') ?? '0.001',
      'io.agentgate.world-verified': true,
    } as const;

    const result = await setAgentMetadata(name, records, account, { rpcUrl, chain });
    return toStep('ENS write', 'pass', `Wrote AgentGate metadata for ${result.name}`, result);
  } catch (error) {
    return errorStep('ENS write', error);
  }
}

async function checkWorld(): Promise<StepResult> {
  try {
    process.env.WORLD_RPC_URL = env('WORLD_RPC_URL') ?? DEFAULT_WORLD_RPC_URL;
    const account = privateKeyToAccount(normalizePrivateKey(required('DEMO_PRIVATE_KEY')));
    const registered = await verifyAgentWalletRegistration(account.address);

    return toStep(
      'World AgentKit',
      registered ? 'pass' : 'warn',
      registered ? 'Configured wallet is registered in AgentBook' : 'Configured wallet is not registered in AgentBook',
      { address: account.address, registered },
    );
  } catch (error) {
    return errorStep('World AgentKit', error);
  }
}

async function generateWorldProof(): Promise<StepResult> {
  try {
    process.env.WORLD_RPC_URL = env('WORLD_RPC_URL') ?? DEFAULT_WORLD_RPC_URL;
    const providerUrl = getProviderUrl();
    const proof = await requestWorldProof(providerUrl, env('DEMO_AGENTKIT_STATEMENT') ?? 'AgentGate visual demo');
    if (!proof.success || !proof.proof) throw new Error('AgentKit proof generation returned no proof');

    return toStep('AgentKit proof', 'pass', 'Generated server-compatible agentkit header', {
      headerName: 'agentkit',
      headerLength: proof.proof.length,
    });
  } catch (error) {
    return errorStep('AgentKit proof', error);
  }
}

async function checkGateway(): Promise<StepResult> {
  try {
    const client = new PaymentsClient({ privateKey: getBuyerPrivateKey(), rpcUrl: required('ARC_RPC_URL') });
    const balances = await client.getBalances();
    const requiredAmount = BigInt(env('CALL_PRICE') ?? DEFAULT_ARC_PRICE);
    const available = balances.gateway.available;

    return toStep(
      'Arc Gateway',
      available >= requiredAmount ? 'pass' : 'warn',
      available >= requiredAmount
        ? 'Buyer Gateway balance can fund one x402 call'
        : `Gateway balance is ${available}; one call requires ${requiredAmount} atomic USDC`,
      {
        buyer: client.buyerAddress,
        walletUsdc: balances.wallet.formatted,
        gatewayAvailable: formatUnits(available, 6),
        requiredAtomic: requiredAmount.toString(),
      },
    );
  } catch (error) {
    return errorStep('Arc Gateway', error);
  }
}

async function callProviderFree(): Promise<StepResult> {
  try {
    if (env('RUN_DEMO_FREE_CALLS') !== 'true') {
      return toStep('Free call', 'warn', 'Skipped: set RUN_DEMO_FREE_CALLS=true to send a real AgentKit header');
    }

    const url = getProviderUrl();
    const proof = await requestWorldProof(url, env('DEMO_AGENTKIT_STATEMENT') ?? 'AgentGate visual demo');
    if (!proof.success || !proof.proof) throw new Error('Unable to generate AgentKit header');

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', agentkit: proof.proof },
      body: JSON.stringify({ prompt: 'visual free call' }),
    });
    const body = await readJson(response);

    return toStep('Free call', response.ok ? 'pass' : 'warn', `Provider returned HTTP ${response.status}`, body);
  } catch (error) {
    return errorStep('Free call', error);
  }
}

async function probeProviderUnpaid(): Promise<StepResult> {
  try {
    const response = await fetch(getProviderUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'visual unpaid probe' }),
    });
    const body = await readJson(response);
    return toStep('x402 challenge', response.status === 402 ? 'pass' : 'warn', `Provider returned HTTP ${response.status}`, body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return toStep('x402 challenge', 'warn', `Provider unavailable or not reachable: ${message}`);
  }
}

async function callProviderPaid(): Promise<StepResult> {
  try {
    if (env('RUN_DEMO_PAID_CALL') !== 'true') {
      return toStep('Paid x402 call', 'warn', 'Skipped: set RUN_DEMO_PAID_CALL=true to spend Gateway balance');
    }

    const client = new PaymentsClient({ privateKey: getBuyerPrivateKey(), rpcUrl: required('ARC_RPC_URL') });
    const response = await client.pay(getProviderUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'visual paid call' }),
    });
    const body = await readJson(response);
    return toStep('Paid x402 call', response.ok ? 'pass' : 'fail', `Provider returned HTTP ${response.status}`, body);
  } catch (error) {
    return errorStep('Paid x402 call', error);
  }
}

async function checkTicketEligibility(quantity: number): Promise<StepResult[]> {
  const ensStep = await checkEns();
  const metadataStep = await readConfiguredAgent();
  const worldStep = await checkWorld();
  const limitStep = ticketLimitStep(quantity, worldStep);
  const proofStep = await generateWorldProof();
  const gatewayStep = await checkGateway();
  const challengeStep = await probeProviderUnpaid();

  return [ensStep, metadataStep, worldStep, limitStep, proofStep, gatewayStep, challengeStep];
}

async function runTicketCheckout(quantity: number): Promise<StepResult[]> {
  const results = await checkTicketEligibility(quantity);
  const limitStep = results.find((result) => result.title === 'Anti-scalper ticket rule');

  if (limitStep?.state !== 'pass') {
    return [
      ...results,
      toStep('Checkout', 'warn', 'Checkout stopped by the ticket-limit policy before payment.'),
    ];
  }

  return [...results, await callProviderFree(), await callProviderPaid()];
}

async function runAll(): Promise<StepResult[]> {
  const checks = [
    checkEns,
    discoverEnsAgents,
    readConfiguredAgent,
    writeEnsMetadata,
    checkWorld,
    generateWorldProof,
    checkGateway,
    probeProviderUnpaid,
    callProviderFree,
    callProviderPaid,
  ];

  const results: StepResult[] = [];
  for (const check of checks) {
    results.push(await check());
  }
  return results;
}

const app = express();
app.disable('x-powered-by');
app.use(express.json());

app.get('/', (_req, res) => {
  res.type('html').send(renderPage());
});

app.get('/api/status', (_req, res) => {
  res.json({
    providerUrl: getProviderUrl(),
    ticketEvent: TICKET_EVENT,
    env: envStatus(),
    destructiveFlags: {
      ensWrite: env('RUN_LIVE_ENS_SMOKE') === 'true',
      freeCall: env('RUN_DEMO_FREE_CALLS') === 'true',
      paidCall: env('RUN_DEMO_PAID_CALL') === 'true',
    },
  });
});

app.post('/api/tickets/check', async (req, res) => {
  res.json({ results: await checkTicketEligibility(ticketQuantity(req.body?.quantity)) });
});

app.post('/api/tickets/checkout', async (req, res) => {
  res.json({ results: await runTicketCheckout(ticketQuantity(req.body?.quantity)) });
});

app.post('/api/run', async (_req, res) => {
  res.json({ results: await runAll() });
});

app.post('/api/ens', async (_req, res) => {
  res.json({ results: [await checkEns(), await discoverEnsAgents(), await readConfiguredAgent(), await writeEnsMetadata()] });
});

app.post('/api/world', async (_req, res) => {
  res.json({ results: [await checkWorld(), await generateWorldProof(), await callProviderFree()] });
});

app.post('/api/x402', async (_req, res) => {
  res.json({ results: [await checkGateway(), await probeProviderUnpaid(), await callProviderPaid()] });
});

function renderPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AgentGate Tickets</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #101316; color: #eef3f5; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #101316; }
    main { width: min(1180px, calc(100vw - 32px)); margin: 0 auto; padding: 28px 0 40px; }
    header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 24px; }
    h1 { margin: 0; font-size: 30px; letter-spacing: 0; }
    p { color: #a7b3b8; line-height: 1.5; }
    button { border: 1px solid #3c4a50; background: #1f2a30; color: #eef3f5; border-radius: 6px; padding: 10px 14px; cursor: pointer; font-weight: 650; }
    button:hover { background: #2a3840; }
    button.primary { background: #d6ff62; border-color: #d6ff62; color: #111; }
    .toolbar { display: flex; gap: 10px; flex-wrap: wrap; }
    .grid { display: grid; grid-template-columns: 340px 1fr; gap: 18px; align-items: start; }
    .panel { border: 1px solid #29353a; background: #151b1f; border-radius: 8px; padding: 16px; }
    .panel h2 { margin: 0 0 12px; font-size: 16px; letter-spacing: 0; }
    .env-list { display: grid; gap: 8px; }
    .env-row { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; }
    .pill { border-radius: 999px; padding: 2px 8px; font-size: 12px; font-weight: 700; }
    .yes { background: #1f5138; color: #b6ffd7; }
    .no { background: #533034; color: #ffc5ca; }
    .steps { display: grid; gap: 12px; }
    .step { border: 1px solid #29353a; border-left-width: 5px; background: #12181b; border-radius: 8px; padding: 14px; }
    .step.pass { border-left-color: #58d68d; }
    .step.warn { border-left-color: #f4c542; }
    .step.fail { border-left-color: #ff6b6b; }
    .step.ready { border-left-color: #5dade2; }
    .step-title { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 6px; }
    .step-title strong { font-size: 15px; }
    .state { text-transform: uppercase; font-size: 12px; font-weight: 800; color: #101316; background: #ccd5d8; border-radius: 4px; padding: 2px 7px; }
    .step.pass .state { background: #58d68d; }
    .step.warn .state { background: #f4c542; }
    .step.fail .state { background: #ff6b6b; }
    pre { margin: 10px 0 0; padding: 12px; border-radius: 6px; background: #0b0f12; color: #d8e2e6; max-height: 280px; overflow: auto; font-size: 12px; }
    .note { border-left: 4px solid #f4c542; padding: 10px 12px; background: #211f16; border-radius: 6px; color: #f7e4a3; }
    .event { display: grid; grid-template-columns: 1fr auto; gap: 14px; align-items: start; margin-bottom: 16px; padding: 16px; border: 1px solid #344249; border-radius: 8px; background: #10171b; }
    .event h2 { font-size: 24px; margin-bottom: 6px; }
    .ticket-form { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 12px 0 0; }
    input[type="number"] { width: 76px; border: 1px solid #3c4a50; border-radius: 6px; background: #0b0f12; color: #eef3f5; padding: 10px; font: inherit; }
    .price { text-align: right; font-weight: 800; color: #d6ff62; }
    @media (max-width: 840px) { .grid { grid-template-columns: 1fr; } header { flex-direction: column; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>AgentGate Tickets</h1>
        <p>Primary ticketing demo for a real-world anti-scalper flow: discover the provider, verify a human-backed wallet, enforce a ticket cap, then require x402 payment on Arc.</p>
      </div>
      <div class="toolbar">
        <button class="primary" id="checkTickets">Check Ticket Limit</button>
        <button id="checkoutTickets">Checkout</button>
        <button data-run="/api/run">Diagnostics</button>
      </div>
    </header>
    <div class="grid">
      <aside class="panel">
        <h2>Runtime</h2>
        <p id="provider"></p>
        <div class="note">This demo does not link or unlink World ID. It checks the configured wallet's AgentBook status and keeps all secrets in Node.</div>
        <h2 style="margin-top:18px">Environment</h2>
        <div id="env" class="env-list"></div>
      </aside>
      <section class="panel">
        <div class="event">
          <div>
            <h2 id="eventName">AgentGate Live 2026</h2>
            <p id="eventMeta">Loading event rules...</p>
            <div class="ticket-form">
              <label for="quantity">Tickets</label>
              <input id="quantity" type="number" min="1" max="6" value="2">
              <button class="primary" id="checkTicketsInline">Verify Identity & Limit</button>
              <button id="checkoutTicketsInline">Reserve with x402</button>
            </div>
          </div>
          <div class="price" id="eventPrice">0.001 USDC</div>
        </div>
        <h2>Interaction Trace</h2>
        <div id="steps" class="steps">
          <article class="step ready"><div class="step-title"><strong>Ready</strong><span class="state">ready</span></div><p>Choose a run target.</p></article>
        </div>
      </section>
    </div>
  </main>
  <script>
    const steps = document.querySelector('#steps');
    const env = document.querySelector('#env');
    const provider = document.querySelector('#provider');
    const quantity = document.querySelector('#quantity');
    const eventName = document.querySelector('#eventName');
    const eventMeta = document.querySelector('#eventMeta');
    const eventPrice = document.querySelector('#eventPrice');

    function escapeHtml(value) {
      return String(value).replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
    }

    function renderDetails(details) {
      if (details === undefined) return '';
      return '<pre>' + escapeHtml(JSON.stringify(details, null, 2)) + '</pre>';
    }

    function renderSteps(results) {
      steps.innerHTML = results.map(result => '<article class="step ' + result.state + '"><div class="step-title"><strong>' + escapeHtml(result.title) + '</strong><span class="state">' + escapeHtml(result.state) + '</span></div><p>' + escapeHtml(result.summary) + '</p>' + renderDetails(result.details) + '</article>').join('');
    }

    async function loadStatus() {
      const data = await fetch('/api/status').then(r => r.json());
      provider.textContent = 'Provider: ' + data.providerUrl;
      eventName.textContent = data.ticketEvent.name;
      eventMeta.textContent = data.ticketEvent.venue + ' · ' + data.ticketEvent.date + ' · max ' + data.ticketEvent.maxPerVerifiedHuman + ' per verified human-backed wallet';
      eventPrice.textContent = (Number(data.ticketEvent.priceAtomicUsdc) / 1000000).toFixed(3) + ' ' + data.ticketEvent.currency;
      env.innerHTML = data.env.map(item => '<div class="env-row"><span>' + escapeHtml(item.name) + '</span><span class="pill ' + (item.present ? 'yes' : 'no') + '">' + (item.present ? 'set' : 'missing') + '</span></div>').join('');
    }

    function selectedQuantity() {
      return Number(quantity.value || '1');
    }

    async function run(url, body) {
      renderSteps([{ title: 'Running', state: 'ready', summary: 'Waiting for testnet responses...' }]);
      const data = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body || {}),
      }).then(r => r.json());
      renderSteps(data.results);
    }

    document.querySelectorAll('[data-run]').forEach(button => button.addEventListener('click', () => run(button.dataset.run)));
    document.querySelector('#checkTickets').addEventListener('click', () => run('/api/tickets/check', { quantity: selectedQuantity() }));
    document.querySelector('#checkTicketsInline').addEventListener('click', () => run('/api/tickets/check', { quantity: selectedQuantity() }));
    document.querySelector('#checkoutTickets').addEventListener('click', () => run('/api/tickets/checkout', { quantity: selectedQuantity() }));
    document.querySelector('#checkoutTicketsInline').addEventListener('click', () => run('/api/tickets/checkout', { quantity: selectedQuantity() }));
    loadStatus();
  </script>
</body>
</html>`;
}

const port = Number(env('DEMO_PORT') ?? '5173');
app.listen(port, () => {
  console.log(`AgentGate visual demo listening on http://127.0.0.1:${port}`);
});
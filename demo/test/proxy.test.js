const assert = require('node:assert/strict');
const test = require('node:test');

const { runDemoCall } = require('../dist/index.js');

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('runDemoCall forwards challenge requests without auth headers', async () => {
  let observed;
  const result = await runDemoCall(
    {
      providerUrl: 'http://127.0.0.1:3000/call',
      prompt: 'show the x402 challenge',
      mode: 'challenge',
    },
    async (_url, init) => {
      observed = init;
      return jsonResponse(402, { status: 'payment_required' });
    },
  );

  assert.equal(result.status, 402);
  assert.equal(result.auth.worldProof, 'not_requested');
  assert.equal(result.auth.payment, 'not_requested');
  assert.equal(observed.headers.agentkit, undefined);
  assert.equal(observed.headers['x-payment'], undefined);
});

test('runDemoCall attaches a configured AgentKit header for World trial calls', async () => {
  let observed;
  const result = await runDemoCall(
    {
      providerUrl: 'http://127.0.0.1:3000/call',
      prompt: 'run a free trial call',
      mode: 'world',
      agentkitHeader: 'agentkit-demo-proof',
    },
    async (_url, init) => {
      observed = init;
      return jsonResponse(200, { status: 'free_trial', remaining: 2 });
    },
  );

  assert.equal(result.status, 200);
  assert.equal(result.auth.worldProof, 'provided');
  assert.equal(observed.headers.agentkit, 'agentkit-demo-proof');
});

test('runDemoCall attaches a provided x402 payment header for paid calls', async () => {
  let observed;
  const result = await runDemoCall(
    {
      providerUrl: 'http://127.0.0.1:3000/call',
      prompt: 'make a paid x402 call',
      mode: 'paid',
      paymentHeader: 'x402-demo-payment',
    },
    async (_url, init) => {
      observed = init;
      return jsonResponse(200, { status: 'paid', tx: 'x402-demo-payment' });
    },
  );

  assert.equal(result.status, 200);
  assert.equal(result.auth.payment, 'provided');
  assert.equal(observed.headers['x-payment'], 'x402-demo-payment');
});

test('runDemoCall rejects non-http provider URLs', async () => {
  await assert.rejects(
    () => runDemoCall({ providerUrl: 'file:///tmp/provider', mode: 'challenge' }, async () => jsonResponse(200, {})),
    /http or https/,
  );
});

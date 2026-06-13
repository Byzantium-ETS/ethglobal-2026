const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { loadFresh, request } = require('./helpers');

const indexPath = path.resolve(__dirname, '../dist/index.js');

function loadApp(state) {
  return loadFresh(
    indexPath,
    {
      './worldMiddleware': {
        worldMiddleware: (req, _res, next) => {
          req.worldIdentity = state.worldIdentity;
          next();
        },
      },
      './x402Middleware': {
        x402Middleware: (req, res, next) => {
          state.x402Calls += 1;
          if (state.x402Mode === 'authorize') {
            req.paymentMetadata = {
              scheme: 'exact',
              token: state.paymentToken,
              network: 'eip155:5042002',
            };
            next();
            return;
          }

          res.status(402).json({
            status: 'payment_required',
            challenge: true,
          });
        },
      },
    },
    [
      indexPath,
      path.resolve(__dirname, '../dist/worldMiddleware.js'),
      path.resolve(__dirname, '../dist/x402Middleware.js'),
    ],
  );
}

test('the app serves the health endpoint', async () => {
  process.env.NODE_ENV = 'test';
  const state = {
    worldIdentity: 'human-1',
    x402Mode: 'authorize',
    x402Calls: 0,
    paymentToken: 'token-1',
  };

  const { app } = loadApp(state);
  const server = app.listen(0);

  try {
    const response = await request(server);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), {
      name: 'AgentGate Provider',
      status: 'ok',
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('the app grants a free-trial call for a verified identity', async () => {
  process.env.NODE_ENV = 'test';
  process.env.FREE_TRIAL_LIMIT = '5';

  const state = {
    worldIdentity: 'human-free',
    x402Mode: 'authorize',
    x402Calls: 0,
    paymentToken: 'token-free',
  };

  const { app } = loadApp(state);
  const server = app.listen(0);

  try {
    const response = await request(server, {
      method: 'POST',
      path: '/call',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), {
      status: 'free_trial',
      remaining: 4,
      identity: 'human-free',
      message: 'Agent call processed (free trial)',
    });
    assert.equal(state.x402Calls, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('the app falls back to paid authorization when trials are exhausted', async () => {
  process.env.NODE_ENV = 'test';
  process.env.FREE_TRIAL_LIMIT = '0';

  const state = {
    worldIdentity: 'human-paid',
    x402Mode: 'authorize',
    x402Calls: 0,
    paymentToken: 'token-paid',
  };

  const { app } = loadApp(state);
  const server = app.listen(0);

  try {
    const response = await request(server, {
      method: 'POST',
      path: '/call',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), {
      status: 'paid',
      tx: 'token-paid',
      payment: {
        scheme: 'exact',
        token: 'token-paid',
        network: 'eip155:5042002',
      },
      identity: 'human-paid',
      message: 'Agent call processed (paid)',
    });
    assert.equal(state.x402Calls, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

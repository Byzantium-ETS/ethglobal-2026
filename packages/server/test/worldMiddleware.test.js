const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { loadFresh } = require('./helpers');

const modulePath = path.resolve(__dirname, '../dist/worldMiddleware.js');

const state = {
  parseCalls: [],
  validationArgs: null,
  signatureArgs: null,
  lookupCalls: [],
  validateResult: { valid: true },
  verifyResult: { valid: true, address: '0xabc123' },
  lookupResult: 'human-1',
};

const worldMiddlewareModule = loadFresh(
  modulePath,
  {
    '@worldcoin/agentkit': {
      AGENTKIT: 'agentkit',
      createAgentBookVerifier: () => ({
        lookupHuman: async (address) => {
          state.lookupCalls.push(address);
          return state.lookupResult;
        },
      }),
      parseAgentkitHeader: (header) => {
        state.parseCalls.push(header);
        return { header };
      },
      validateAgentkitMessage: async (payload, resourceUri) => {
        state.validationArgs = { payload, resourceUri };
        return state.validateResult;
      },
      verifyAgentkitSignature: async (payload, rpcUrl) => {
        state.signatureArgs = { payload, rpcUrl };
        return state.verifyResult;
      },
    },
  },
  [modulePath],
);

function makeReq(headerValue) {
  return {
    protocol: 'https',
    path: '/call',
    header: (name) => (name === 'agentkit' ? headerValue : undefined),
    get: (name) => (name === 'host' ? 'example.com' : undefined),
  };
}

function makeNextRecorder() {
  const calls = [];
  return {
    next: (err) => {
      calls.push(err);
    },
    calls,
  };
}

test('worldMiddleware sets null identity when the header is missing', async () => {
  state.parseCalls = [];
  state.validationArgs = null;
  state.signatureArgs = null;
  state.lookupCalls = [];
  state.validateResult = { valid: true };
  state.verifyResult = { valid: true, address: '0xabc123' };
  state.lookupResult = 'human-1';

  const req = makeReq(undefined);
  const recorder = makeNextRecorder();

  await worldMiddlewareModule.worldMiddleware(req, {}, recorder.next);

  assert.equal(req.worldIdentity, null);
  assert.deepEqual(recorder.calls, [undefined]);
  assert.deepEqual(state.parseCalls, []);
});

test('worldMiddleware verifies the header and resolves a human identity', async () => {
  state.parseCalls = [];
  state.validationArgs = null;
  state.signatureArgs = null;
  state.lookupCalls = [];
  state.validateResult = { valid: true };
  state.verifyResult = { valid: true, address: '0xabc123' };
  state.lookupResult = 'human-42';
  process.env.WORLD_RPC_URL = 'https://world-rpc.example';

  const req = makeReq('encoded-agentkit-header');
  const recorder = makeNextRecorder();

  await worldMiddlewareModule.worldMiddleware(req, {}, recorder.next);

  assert.equal(req.worldIdentity, 'human-42');
  assert.deepEqual(recorder.calls, [undefined]);
  assert.deepEqual(state.parseCalls, ['encoded-agentkit-header']);
  assert.deepEqual(state.validationArgs, {
    payload: { header: 'encoded-agentkit-header' },
    resourceUri: 'https://example.com/call',
  });
  assert.deepEqual(state.signatureArgs, {
    payload: { header: 'encoded-agentkit-header' },
    rpcUrl: 'https://world-rpc.example',
  });
  assert.deepEqual(state.lookupCalls, ['0xabc123']);
});

test('worldMiddleware clears identity when validation fails', async () => {
  state.parseCalls = [];
  state.validationArgs = null;
  state.signatureArgs = null;
  state.lookupCalls = [];
  state.validateResult = { valid: false, error: 'stale' };

  const req = makeReq('bad-header');
  const recorder = makeNextRecorder();

  await worldMiddlewareModule.worldMiddleware(req, {}, recorder.next);

  assert.equal(req.worldIdentity, null);
  assert.deepEqual(recorder.calls, [undefined]);
  assert.deepEqual(state.signatureArgs, null);
  assert.deepEqual(state.lookupCalls, []);
});

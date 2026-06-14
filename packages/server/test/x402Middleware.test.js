const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { loadFresh } = require('./helpers');

const x402ModulePath = path.resolve(__dirname, '../dist/x402Middleware.js');
const sellerConfigPath = path.resolve(__dirname, '../dist/sellerConfig.js');

function loadModule(state) {
  return loadFresh(
    x402ModulePath,
    {
      '@x402/express': {
        paymentMiddleware: (config, resourceServer) => {
          state.paymentMiddlewareConfig = config;
          state.resourceServer = resourceServer;
          return (req, _res, next) => {
            state.innerCalls += 1;
            if (state.innerBehavior === 'error') {
              next(new Error('boom'));
              return;
            }
            next();
          };
        },
        x402ResourceServer: class FakeResourceServer {
          constructor(clients) {
            state.facilitatorClients = clients;
          }

          register(scheme, gatewayScheme) {
            state.registerArgs = { scheme, gatewayScheme };
            return { scheme, gatewayScheme };
          }
        },
      },
      '@circle-fin/x402-batching/server': {
        BatchFacilitatorClient: function FakeBatchFacilitatorClient(options) {
          state.facilitatorOptions = options;
        },
        GatewayEvmScheme: function FakeGatewayEvmScheme() {
          return { scheme: 'exact' };
        },
      },
    },
    [x402ModulePath, sellerConfigPath],
  );
}

function makeReq(headers) {
  return {
    originalUrl: '/call',
    path: '/call',
    header: (name) => headers[name.toLowerCase()],
  };
}

function makeRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function makeRecorder() {
  const calls = [];
  return {
    next: (err) => calls.push(err),
    calls,
  };
}

test('x402Middleware attaches payment metadata from the signature header', async () => {
  process.env.NODE_ENV = 'test';
  process.env.SELLER_ADDRESS = '0x1111111111111111111111111111111111111111';
  process.env.CALL_PRICE = '2500';
  process.env.CIRCLE_API_KEY = 'circle-secret';
  delete process.env.CIRCLE_API_URL;

  const state = {
    innerBehavior: 'success',
    innerCalls: 0,
    facilitatorClients: null,
    facilitatorOptions: null,
    registerArgs: null,
    paymentMiddlewareConfig: null,
    resourceServer: null,
  };

  const x402Module = loadModule(state);
  const sellerConfig = require(sellerConfigPath);
  const req = makeReq({ 'payment-signature': 'sig-123' });
  const recorder = makeRecorder();

  await x402Module.x402Middleware(req, {}, recorder.next);

  assert.deepEqual(recorder.calls, [undefined]);
  assert.deepEqual(req.paymentMetadata, {
    scheme: 'exact',
    token: 'sig-123',
    network: sellerConfig.sellerConfig.network,
  });
  assert.equal(state.innerCalls, 1);
  assert.deepEqual(state.facilitatorClients.length, 1);
  assert.deepEqual(state.registerArgs.scheme, 'eip155:*');
  assert.deepEqual(await state.facilitatorOptions.createAuthHeaders(), {
    verify: { Authorization: 'Bearer circle-secret' },
    settle: { Authorization: 'Bearer circle-secret' },
    supported: { Authorization: 'Bearer circle-secret' },
  });
  assert.equal(state.facilitatorOptions.url, 'https://gateway-api-testnet.circle.com');
  assert.equal(state.paymentMiddlewareConfig['/call'].accepts.price.amount, '2500');
});

test('x402Middleware uses the configured Circle Gateway URL when provided', async () => {
  process.env.NODE_ENV = 'test';
  process.env.SELLER_ADDRESS = '0x1111111111111111111111111111111111111111';
  process.env.CIRCLE_API_URL = 'https://gateway-api.custom.example/';

  const state = {
    innerBehavior: 'success',
    innerCalls: 0,
    facilitatorClients: null,
    facilitatorOptions: null,
    registerArgs: null,
    paymentMiddlewareConfig: null,
    resourceServer: null,
  };

  const x402Module = loadModule(state);
  const req = makeReq({ 'payment-signature': 'sig-123' });
  const recorder = makeRecorder();

  await x402Module.x402Middleware(req, {}, recorder.next);

  assert.deepEqual(recorder.calls, [undefined]);
  assert.equal(state.facilitatorOptions.url, 'https://gateway-api.custom.example');
});

test('x402Middleware returns a 402 challenge when payment headers are missing', async () => {
  process.env.NODE_ENV = 'test';
  process.env.SELLER_ADDRESS = '0x1111111111111111111111111111111111111111';
  process.env.CALL_PRICE = '2500';
  delete process.env.CIRCLE_API_URL;

  const state = {
    innerBehavior: 'success',
    innerCalls: 0,
    facilitatorClients: null,
    facilitatorOptions: null,
    registerArgs: null,
    paymentMiddlewareConfig: null,
    resourceServer: null,
  };

  const x402Module = loadModule(state);
  const sellerConfig = require(sellerConfigPath);
  const req = makeReq({});
  const res = makeRes();
  const recorder = makeRecorder();

  await x402Module.x402Middleware(req, res, recorder.next);

  assert.equal(res.statusCode, 402);
  assert.deepEqual(res.body, sellerConfig.buildPaymentChallenge('/call'));
  assert.deepEqual(recorder.calls, []);
  assert.equal(state.innerCalls, 0);
  assert.equal(req.paymentMetadata, undefined);
});

test('x402Middleware forwards errors without attaching payment metadata', async () => {
  process.env.NODE_ENV = 'test';
  process.env.SELLER_ADDRESS = '0x1111111111111111111111111111111111111111';
  delete process.env.CIRCLE_API_URL;

  const state = {
    innerBehavior: 'error',
    innerCalls: 0,
    facilitatorClients: null,
    facilitatorOptions: null,
    registerArgs: null,
    paymentMiddlewareConfig: null,
    resourceServer: null,
  };

  const x402Module = loadModule(state);
  const req = makeReq({ 'x-payment': 'fallback-token' });
  const recorder = makeRecorder();

  await x402Module.x402Middleware(req, {}, recorder.next);

  assert.equal(state.innerCalls, 1);
  assert.equal(recorder.calls.length, 1);
  assert.match(recorder.calls[0].message, /boom/);
  assert.equal(req.paymentMetadata, undefined);
});

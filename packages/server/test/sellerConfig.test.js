const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const modulePath = path.resolve(__dirname, '../dist/sellerConfig.js');

function loadSellerConfig(env = {}) {
  const script = `
    const mod = require(${JSON.stringify(modulePath)});
    const out = {
      address: mod.sellerConfig.address,
      price: mod.sellerConfig.price,
      network: mod.sellerConfig.network,
      asset: mod.sellerConfig.asset,
      gatewayContract: mod.sellerConfig.gatewayContract,
      challenge: mod.buildPaymentChallenge('/call'),
    };
    process.stdout.write(JSON.stringify(out));
  `;

  return spawnSync(process.execPath, ['-e', script], {
    cwd: path.resolve(__dirname, '../..'),
    env: {
      ...process.env,
      ...env,
    },
    encoding: 'utf8',
  });
}

test('sellerConfig uses the test-mode fallback address', () => {
  const result = loadSellerConfig({
    NODE_ENV: 'test',
    SELLER_ADDRESS: '',
  });

  assert.equal(result.status, 0);

  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.address, '0x0000000000000000000000000000000000000000');
  assert.equal(parsed.price, '1000');
  assert.equal(parsed.challenge.accepts[0].payTo, parsed.address);
});

test('sellerConfig reads the configured address and price', () => {
  const result = loadSellerConfig({
    NODE_ENV: 'production',
    SELLER_ADDRESS: '0x1111111111111111111111111111111111111111',
    CALL_PRICE: '2500',
  });

  assert.equal(result.status, 0);

  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.address, '0x1111111111111111111111111111111111111111');
  assert.equal(parsed.price, '2500');
  assert.equal(parsed.challenge.accepts[0].amount, '2500');
  assert.equal(parsed.challenge.accepts[0].payTo, parsed.address);
});

test('sellerConfig rejects an invalid seller address', () => {
  const result = loadSellerConfig({
    NODE_ENV: 'production',
    SELLER_ADDRESS: 'not-an-address',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not a valid Ethereum address/);
});

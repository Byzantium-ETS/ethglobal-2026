const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const trialStore = require(path.resolve(__dirname, '../dist/trialStore.js'));

test('trialStore defaults to five free calls', () => {
  delete process.env.FREE_TRIAL_LIMIT;

  const identity = 'identity-default';
  const endpoint = '/call-default';

  assert.deepEqual(trialStore.evaluatePolicy(identity, endpoint), {
    status: 'free_trial',
    remaining: 5,
  });

  trialStore.consumeTrial(identity, endpoint);

  assert.deepEqual(trialStore.getTrialUsage(identity, endpoint), {
    used: 1,
    limit: 5,
  });
  assert.deepEqual(trialStore.evaluatePolicy(identity, endpoint), {
    status: 'free_trial',
    remaining: 4,
  });
});

test('trialStore respects a custom free-trial limit', () => {
  process.env.FREE_TRIAL_LIMIT = '2';

  const identity = 'identity-custom';
  const endpoint = '/call-custom';

  assert.deepEqual(trialStore.evaluatePolicy(identity, endpoint), {
    status: 'free_trial',
    remaining: 2,
  });

  trialStore.consumeTrial(identity, endpoint);
  assert.deepEqual(trialStore.evaluatePolicy(identity, endpoint), {
    status: 'free_trial',
    remaining: 1,
  });

  trialStore.consumeTrial(identity, endpoint);
  assert.deepEqual(trialStore.evaluatePolicy(identity, endpoint), {
    status: 'payment_required',
  });
});

test('trialStore requires payment for unverified callers', () => {
  process.env.FREE_TRIAL_LIMIT = '9';

  assert.deepEqual(trialStore.evaluatePolicy(null, '/call-unverified'), {
    status: 'payment_required',
  });
});

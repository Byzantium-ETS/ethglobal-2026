const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const demoRoot = path.resolve(__dirname, '..');
const publicRoot = path.join(demoRoot, 'public');

function readPublicFile(name) {
  return fs.readFileSync(path.join(publicRoot, name), 'utf8');
}

test('demo frontend exposes the guided AgentGate workflow', () => {
  const html = readPublicFile('index.html');
  const styles = readPublicFile('styles.css');
  const app = readPublicFile('app.js');

  assert.match(html, /Agent discovery with verifiable/);
  assert.match(html, /decentralized trust registry/);
  assert.match(html, /assets\/agentgate-logo\.png/);
  assert.match(html, /data-testid="page-landing"/);
  assert.match(html, /data-testid="page-connect"/);
  assert.match(html, /data-testid="page-register"/);
  assert.match(html, /data-testid="page-console"/);
  assert.match(html, /data-testid="connect-button"/);
  assert.match(html, /data-testid="register-button"/);
  assert.match(html, /data-testid="provider-url"/);
  assert.match(html, /data-testid="call-button"/);
  assert.match(styles, /--accent-500:\s*#0b72d0/);
  assert.match(app, /showPage\('register'\)/);
  assert.match(app, /showPage\('console'\)/);
  assert.match(app, /\/api\/call/);
  assert.match(app, /provider_unavailable/);
  assert.ok(fs.existsSync(path.join(publicRoot, 'assets', 'agentgate-logo.png')));
});

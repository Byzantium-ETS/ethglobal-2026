import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

const ENV_EXAMPLE_PATH = '.env.example';
const SOURCE_EXTENSIONS = new Set(['.cjs', '.js', '.jsx', '.mjs', '.ts', '.tsx']);

function trackedFiles(): string[] {
  const output = execFileSync('git', ['ls-files', '-z'], { encoding: 'buffer' });
  return output.toString('utf8').split('\0').filter(Boolean);
}

function envExampleKeys(): Set<string> {
  const contents = readFileSync(ENV_EXAMPLE_PATH, 'utf8');
  const keys = new Set<string>();

  for (const line of contents.split(/\r?\n/)) {
    const match = /^\s*([A-Z][A-Z0-9_]*)\s*=/.exec(line);
    if (match) keys.add(match[1]);
  }

  return keys;
}

function codeEnvKeys(files: string[]): Set<string> {
  const keys = new Set<string>();
  const dotAccess = /process\.env\.([A-Z][A-Z0-9_]*)/g;
  const bracketAccess = /process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g;
  const envHelperAccess = /\benv\(['"]([A-Z][A-Z0-9_]*)['"]\)/g;

  for (const file of files) {
    if (!SOURCE_EXTENSIONS.has(extname(file))) continue;
    if (file.startsWith('node_modules/') || file.includes('/dist/')) continue;

    const contents = readFileSync(file, 'utf8');
    for (const match of contents.matchAll(dotAccess)) keys.add(match[1]);
    for (const match of contents.matchAll(bracketAccess)) keys.add(match[1]);
    for (const match of contents.matchAll(envHelperAccess)) keys.add(match[1]);
  }

  return keys;
}

const exampleKeys = envExampleKeys();
const usedKeys = codeEnvKeys(trackedFiles());
const missing = [...usedKeys].filter((key) => !exampleKeys.has(key)).sort((left, right) => left.localeCompare(right));

if (missing.length > 0) {
  console.error('[env-parity] .env.example is missing variables used by code:');
  for (const key of missing) console.error(`  - ${key}`);
  process.exit(1);
}

console.log(`[env-parity] OK: ${usedKeys.size} code env vars are documented in ${ENV_EXAMPLE_PATH}`);
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

type Finding = {
  file: string;
  line: number;
  reason: string;
};

const KNOWN_TEST_PRIVATE_KEYS = new Set([
  '0x0000000000000000000000000000000000000000000000000000000000000001',
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
]);

function trackedFiles(): string[] {
  const output = execFileSync('git', ['ls-files', '-z'], { encoding: 'buffer' });
  return output.toString('utf8').split('\0').filter(Boolean);
}

function isAllowedPlaceholder(value: string): boolean {
  const normalized = value.trim().replace(/^['"]|['"]$/g, '');
  if (!normalized) return true;
  if (normalized.includes('${{ secrets.') || normalized.includes('${{ vars.')) return true;
  if (normalized.includes('process.env.')) return true;
  if (normalized.includes('...')) return true;
  if (/^(dummy|example|placeholder|replace-me|test|your-.+)$/i.test(normalized)) return true;
  if (/^<.+>$/.test(normalized)) return true;
  if (KNOWN_TEST_PRIVATE_KEYS.has(normalized.toLowerCase())) return true;
  return false;
}

function scanFile(file: string, findings: Finding[]): void {
  if (file.startsWith('node_modules/') || file.includes('/dist/')) return;

  const contents = readFileSync(file, 'utf8');
  const lines = contents.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;

    if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(line)) {
      findings.push({ file, line: lineNumber, reason: 'private key block marker' });
    }

    for (const match of line.matchAll(/0x[0-9a-fA-F]{64}/g)) {
      const value = match[0].toLowerCase();
      if (!KNOWN_TEST_PRIVATE_KEYS.has(value)) {
        findings.push({ file, line: lineNumber, reason: '64-byte hex private-key-looking value' });
      }
    }

    const assignment = /^\s*[A-Z0-9_]*(?:API_KEY|PRIVATE_KEY|SECRET|TOKEN)\s*[:=]\s*([^#\n]+)/.exec(line);
    if (assignment && !isAllowedPlaceholder(assignment[1])) {
      findings.push({ file, line: lineNumber, reason: 'non-placeholder secret assignment' });
    }
  }
}

const files = trackedFiles();
const findings: Finding[] = [];

for (const file of files) {
  if (/^\.env(?:\.|$)/.test(file) && file !== '.env.example') {
    findings.push({ file, line: 1, reason: 'environment file is tracked' });
    continue;
  }

  scanFile(file, findings);
}

if (findings.length > 0) {
  console.error('[secret-scan] Potential committed secrets found:');
  for (const finding of findings) {
    console.error(`  - ${finding.file}:${finding.line} ${finding.reason}`);
  }
  process.exit(1);
}

console.log(`[secret-scan] OK: scanned ${files.length} tracked files`);
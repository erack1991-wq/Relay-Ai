import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const script = path.resolve('scripts/validate-provider-config.mjs');

function run(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, file], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function fixture(contents) {
  const directory = await mkdtemp(path.join(tmpdir(), 'relay-provider-config-'));
  const file = path.join(directory, '.dev.vars');
  await writeFile(file, contents);
  return file;
}

test('provider config accepts one non-empty entry per required provider', async () => {
  const file = await fixture([
    'OPENAI_API_KEY=openai',
    'STRIPE_SECRET_KEY=stripe',
    'STRIPE_PRICE_ID=price',
    'STRIPE_WEBHOOK_SECRET=whsec',
    'TWILIO_ACCOUNT_SID=account',
    'TWILIO_AUTH_TOKEN=token',
    'TWILIO_PHONE_NUMBER=+15555555555',
    'PUBLIC_BASE_URL=https://relay.test',
  ].join('\n'));
  const result = await run(file);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /shape is valid/);
});

test('provider config rejects duplicate and missing entries', async () => {
  const file = await fixture([
    'OPENAI_API_KEY=first',
    'OPENAI_API_KEY=second',
    'STRIPE_SECRET_KEY=stripe',
  ].join('\n'));
  const result = await run(file);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /OPENAI_API_KEY: duplicate entries/);
  assert.match(result.stderr, /TWILIO_ACCOUNT_SID: missing/);
});

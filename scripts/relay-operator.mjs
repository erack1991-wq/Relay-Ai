import { spawn } from 'node:child_process';
import fs from 'node:fs';

function publicUrl() {
  try {
    const line = fs.readFileSync('.dev.vars', 'utf8').split(/\r?\n/).find((entry) => entry.startsWith('PUBLIC_BASE_URL='));
    return line?.slice('PUBLIC_BASE_URL='.length).trim().replace(/^"|"$/g, '') || '';
  } catch {
    return '';
  }
}

function run(command) {
  return new Promise((resolve) => {
    const executable = process.platform === 'win32' && command[0] === 'npm' ? 'npm.cmd' : command[0];
    const child = process.platform === 'win32'
      ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', [executable, ...command.slice(1)].join(' ')], { stdio: 'inherit', shell: false })
      : spawn(executable, command.slice(1), { stdio: 'inherit', shell: false });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

const results = [];
console.log('Relay Operator V1 — safe autonomous engineering loop');
console.log('Policy: inspect, verify, and prepare reversible work; stop for secrets, money, destructive actions, and irreversible releases.');

for (const [label, command] of [
  ['provider configuration', ['npm', 'run', 'validate:providers']],
  ['full verification', ['npm', 'run', 'verify']],
]) {
  console.log(`\n=== ${label} ===`);
  results.push({ label, code: await run(command) });
}

const base = process.argv[2] || process.env.RELAY_HEALTH_URL || publicUrl();
if (base) {
  const target = base.endsWith('/api/health') ? base : `${base.replace(/\/$/, '')}/api/health`;
  console.log('\n=== readiness ===');
  try {
    const response = await fetch(target, { headers: { accept: 'application/json' } });
    const body = await response.json();
    console.log(JSON.stringify({ http: response.status, readyForPilot: body.readyForPilot, providerVerification: body.providerVerification, pilotBlockers: body.pilotBlockers }, null, 2));
    results.push({ label: 'readiness', code: response.ok && body.readyForPilot ? 0 : 1, blockers: body.pilotBlockers || [] });
  } catch (error) {
    results.push({ label: 'readiness', code: 1, blockers: [{ label: 'Health endpoint unavailable', nextAction: error instanceof Error ? error.message : String(error) }] });
  }
}

const failed = results.filter((result) => result.code !== 0);
console.log('\n=== operator decision ===');
if (!failed.length) {
  console.log('SAFE TO PREPARE: verification and readiness passed. Human approval is still required for production release.');
} else {
  console.log(`BLOCKED: ${failed.length} check(s) need attention.`);
  for (const result of failed) {
    for (const blocker of result.blockers || []) console.log(`- ${blocker.label}: ${blocker.nextAction || blocker.status || 'inspect the failed check'}`);
  }
}
process.exitCode = failed.length ? 1 : 0;

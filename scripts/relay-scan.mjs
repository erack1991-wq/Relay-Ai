import { spawn } from 'node:child_process';
import fs from 'node:fs';

function configuredPublicUrl() {
  try {
    const line = fs.readFileSync('.dev.vars', 'utf8').split(/\r?\n/).find((entry) => entry.startsWith('PUBLIC_BASE_URL='));
    return line?.slice('PUBLIC_BASE_URL='.length).trim().replace(/^"|"$/g, '') || '';
  } catch {
    return '';
  }
}

const baseUrl = process.argv[2] || process.env.RELAY_HEALTH_URL || configuredPublicUrl();
const healthUrl = baseUrl ? (baseUrl.endsWith('/api/health') ? baseUrl : `${baseUrl.replace(/\/$/, '')}/api/health`) : '';
const steps = [
  ['Security audit', ['npm', 'audit', '--omit=dev', '--audit-level=high']],
  ['Full verification', ['npm', 'run', 'verify']],
];

function run(label, command) {
  return new Promise((resolve) => {
    console.log(`\n=== ${label} ===`);
    const executable = process.platform === 'win32' && command[0] === 'npm' ? 'npm.cmd' : command[0];
    const child = process.platform === 'win32'
      ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', [executable, ...command.slice(1)].join(' ')], { stdio: 'inherit', shell: false })
      : spawn(executable, command.slice(1), { stdio: 'inherit', shell: false });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

let failed = false;
for (const [label, command] of steps) {
  if ((await run(label, command)) !== 0) failed = true;
}

if (healthUrl) {
  console.log('\n=== Live readiness ===');
  try {
    const response = await fetch(healthUrl, { headers: { accept: 'application/json' } });
    const body = await response.json();
    console.log(JSON.stringify({ http: response.status, readyForPilot: body.readyForPilot, databaseReachable: body.databaseReachable, providerVerification: body.providerVerification, pilotBlockers: body.pilotBlockers }, null, 2));
    if (!response.ok || !body.readyForPilot) failed = true;
  } catch (error) {
    console.error(`Live readiness check failed: ${error instanceof Error ? error.message : String(error)}`);
    failed = true;
  }
}

process.exitCode = failed ? 1 : 0;

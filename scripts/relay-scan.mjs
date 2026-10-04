import { spawn } from 'node:child_process';

const healthUrl = process.argv[2] || process.env.RELAY_HEALTH_URL;
const steps = [
  ['Security audit', ['npm', 'audit', '--omit=dev', '--audit-level=high']],
  ['Full verification', ['npm', 'run', 'verify']],
];

function run(label, command) {
  return new Promise((resolve) => {
    console.log(`\n=== ${label} ===`);
    const executable = process.platform === 'win32' && command[0] === 'npm' ? 'npm.cmd' : command[0];
    const child = spawn(executable, command.slice(1), { stdio: 'inherit', shell: false });
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

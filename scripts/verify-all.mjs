import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const steps = [
  ['Provider configuration contract', ['npm', 'run', 'validate:providers', '--', '.dev.vars.example']],
  ['Application verification', ['npm', 'run', 'verify']],
  ['Browser smoke tests', ['npm', 'run', 'test:e2e']],
];

const backup = path.resolve('backups', 'relay-local.sqlite');
if (fs.existsSync(backup) || process.env.RELAY_REQUIRE_BACKUP === '1') {
  steps.push(['Backup and restore verification', ['npm', 'run', 'backup:verify']]);
} else {
  console.log('\n=== Backup and restore verification ===');
  console.log('Skipped: no local backup artifact is present in this checkout.');
}

function run(label, command) {
  return new Promise((resolve) => {
    console.log(`\n=== ${label} ===`);
    const child = process.platform === 'win32'
      ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', [command[0] === 'npm' ? 'npm.cmd' : command[0], ...command.slice(1)].join(' ')], { stdio: 'inherit', shell: false })
      : spawn(command[0], command.slice(1), { stdio: 'inherit', shell: false });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

let failed = false;
for (const [label, command] of steps) {
  if ((await run(label, command)) !== 0) failed = true;
}

process.exitCode = failed ? 1 : 0;

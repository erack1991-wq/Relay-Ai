#!/usr/bin/env node
/**
 * Run from the Relay repository root:
 *   node scripts/repair-sharp-security.mjs
 *
 * Repairs the pinned sharp override and regenerates the npm lockfile.
 * Requires registry access; never bypasses npm audit.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const path = 'package.json';
const pkg = JSON.parse(readFileSync(path, 'utf8'));
const current = pkg.overrides?.miniflare?.sharp;
if (!current) {
  console.error('No miniflare sharp override found; inspect dependencies manually.');
  process.exit(1);
}
if (current !== '0.35.4' && current !== '0.35.5') {
  console.error('Unexpected sharp override:', current, '- inspect before changing.');
  process.exit(1);
}
pkg.overrides.miniflare.sharp = '0.35.5';
writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
try {
  execFileSync('npm', ['install', '--package-lock-only', '--ignore-scripts'], { stdio: 'inherit' });
  execFileSync('npm', ['ci'], { stdio: 'inherit' });
  execFileSync('npm', ['audit', '--omit=dev', '--audit-level=high'], { stdio: 'inherit' });
  execFileSync('npm', ['run', 'verify'], { stdio: 'inherit' });
  console.log('Repair verified. Review package.json and package-lock.json, then commit together.');
} catch {
  console.error('Verification failed. Do not merge or deploy; inspect the command output.');
  process.exitCode = 1;
}

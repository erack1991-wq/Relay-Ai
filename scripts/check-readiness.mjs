const target = process.argv[2] || process.env.RELAY_HEALTH_URL || 'http://localhost:8787/api/health';

const response = await fetch(target, { headers: { accept: 'application/json' } });
let body;
try { body = await response.json(); } catch { body = { note: await response.text() }; }

console.log(`Relay readiness: ${body.readyForPilot ? 'READY' : 'NOT READY'}`);
console.log(`Configuration: ${body.configurationReady ? 'ready' : 'incomplete'}`);
console.log(`Database: ${body.databaseReachable ? 'reachable' : 'unavailable'}`);
console.log(`Provider verification: ${body.providerVerification || 'unknown'}`);
if (body.backup) console.log(`Backups: ${body.backup.lastVerifiedAt ? 'verified' : 'verification missing'}; restore drill: ${body.backup.restoreTestedAt ? 'tested' : 'missing'}`);
if (body.operations) console.log(`Operations: ${body.operations.queuedJobs || 0} queued, ${body.operations.failedJobs || 0} failed jobs, ${body.operations.failedProviderEvents || 0} failed provider events`);

for (const warning of body.pilotWarnings || []) {
  console.log(`[WARNING] ${warning.label}`);
  if (warning.nextAction) console.log(`  Next: ${warning.nextAction}`);
}

for (const blocker of body.pilotBlockers || []) {
  console.log(`[${String(blocker.severity || 'info').toUpperCase()}] ${blocker.label}: ${blocker.status}`);
  if (blocker.nextAction) console.log(`  Next: ${blocker.nextAction}`);
}

if (!response.ok || !body.readyForPilot) process.exitCode = 1;

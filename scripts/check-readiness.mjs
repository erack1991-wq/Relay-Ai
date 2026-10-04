const target = process.argv[2] || process.env.RELAY_HEALTH_URL || 'http://localhost:8787/api/health';

const response = await fetch(target, { headers: { accept: 'application/json' } });
let body;
try { body = await response.json(); } catch { body = { note: await response.text() }; }

console.log(`Relay readiness: ${body.readyForPilot ? 'READY' : 'NOT READY'}`);
console.log(`Configuration: ${body.configurationReady ? 'ready' : 'incomplete'}`);
console.log(`Database: ${body.databaseReachable ? 'reachable' : 'unavailable'}`);
console.log(`Provider verification: ${body.providerVerification || 'unknown'}`);

for (const blocker of body.pilotBlockers || []) {
  console.log(`[${String(blocker.severity || 'info').toUpperCase()}] ${blocker.label}: ${blocker.status}`);
  if (blocker.nextAction) console.log(`  Next: ${blocker.nextAction}`);
}

if (!response.ok || !body.readyForPilot) process.exitCode = 1;

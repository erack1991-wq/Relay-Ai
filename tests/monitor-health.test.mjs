import test from 'node:test';
import assert from 'node:assert/strict';
import { checkRelayHealth } from '../scripts/monitor-health.mjs';

const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const logger = () => { const warnings = []; return { warnings, warn: (line) => warnings.push(line) }; };
const options = (fetchImpl, log = logger()) => ({ url: 'https://relay.example/api/health', fetchImpl, sleepImpl: async () => {}, logger: log, retryDelayMs: 0 });

test('reports healthy but not pilot-ready without treating launch gates as an outage', async () => {
  const log = logger();
  const result = await checkRelayHealth(options(async () => response(200, { ok: true, databaseReachable: true, readyForPilot: false }), log));
  assert.deepEqual(result, { healthy: true, attempts: 1, readyForPilot: false });
  assert.match(log.warnings.join('\n'), /NOT pilot-ready/);
});

test('warns and recovers from a transient HTTP 503', async () => {
  let count = 0;
  const log = logger();
  const result = await checkRelayHealth(options(async () => ++count === 1 ? response(503, {}) : response(200, { ok: true, databaseReachable: true, readyForPilot: true }), log));
  assert.equal(result.attempts, 2);
  assert.match(log.warnings.join('\n'), /HTTP 503/);
  assert.match(log.warnings.join('\n'), /recovered/);
});

test('fails after bounded retries for persistent 503', async () => {
  const log = logger();
  await assert.rejects(checkRelayHealth(options(async () => response(503, {}), log)), /after 3 attempts.*HTTP 503/);
  assert.equal(log.warnings.filter((line) => /HTTP 503/.test(line)).length, 3);
});

test('fails closed when HTTP 200 has unhealthy or invalid JSON', async () => {
  await assert.rejects(checkRelayHealth(options(async () => response(200, { ok: true, databaseReachable: false }))), /unhealthy health payload/);
  await assert.rejects(checkRelayHealth(options(async () => ({ ok: true, status: 200, json: async () => { throw new Error('bad JSON'); } }))), /invalid health JSON/);
});

test('retries network errors without exposing error text', async () => {
  let count = 0;
  const log = logger();
  const result = await checkRelayHealth(options(async () => {
    if (++count === 1) throw new Error('private upstream detail');
    return response(200, { ok: true, databaseReachable: true });
  }, log));
  assert.equal(result.attempts, 2);
  assert.doesNotMatch(log.warnings.join('\n'), /private upstream detail/);
});

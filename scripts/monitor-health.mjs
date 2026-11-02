import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

/** Check operational health; pilot readiness is intentionally a separate launch gate. */
export async function checkRelayHealth({
  url,
  fetchImpl = fetch,
  sleepImpl = delay,
  logger = console,
  attempts = 3,
  timeoutMs = 20_000,
  retryDelayMs = 5_000,
} = {}) {
  if (!url) throw new Error('RELAY_HEALTH_URL is not configured');
  if (!Number.isInteger(attempts) || attempts < 1) throw new Error('Invalid attempts');
  let lastFailure = 'unknown';
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
        cache: 'no-store',
      });
      if (!response.ok) {
        lastFailure = `HTTP ${response.status}`;
      } else {
        let body;
        try { body = await response.json(); } catch { body = null; }
        if (body?.ok === true && body?.databaseReachable === true) {
          if (attempt > 1) logger.warn(`::warning::Relay health recovered on attempt ${attempt}/${attempts}; investigate intermittent failures.`);
          if (body.readyForPilot !== true) logger.warn('::warning::Relay is healthy but NOT pilot-ready; production launch gates remain outstanding.');
          return { healthy: true, attempts: attempt, readyForPilot: body.readyForPilot === true };
        }
        lastFailure = body ? 'unhealthy health payload (ok/databaseReachable not true)' : 'invalid health JSON';
      }
    } catch {
      // Avoid logging raw errors, URLs, or response bodies that might contain private data.
      lastFailure = 'request failed or timed out';
    }
    logger.warn(`::warning::Relay health attempt ${attempt}/${attempts} failed: ${lastFailure}`);
    if (attempt < attempts) await sleepImpl(retryDelayMs);
  }
  throw new Error(`Relay health failed after ${attempts} attempts; last result: ${lastFailure}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkRelayHealth({ url: process.env.RELAY_HEALTH_URL }).catch((error) => {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  });
}

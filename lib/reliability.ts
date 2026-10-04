const stamp = () => new Date().toISOString();

export function retryDelay(attempt: number, baseMs = 1000, maxMs = 15 * 60 * 1000) {
  const safeAttempt = Math.max(0, Math.min(12, Math.floor(attempt)));
  return Math.min(maxMs, baseMs * 2 ** safeAttempt);
}

export async function recordProviderEvent(db: D1Database, input: {
  id: string; provider: string; eventType: string; payload?: unknown;
}) {
  const now = stamp();
  const result = await db.prepare(`INSERT OR IGNORE INTO provider_events(id,provider,event_type,payload,status,attempts,last_error,created,updated) VALUES(?,?,?,?,?,?,?,?,?)`)
    .bind(input.id, input.provider, input.eventType, JSON.stringify(input.payload ?? {}), 'received', 0, '', now, now).run();
  return (result.meta.changes ?? 0) > 0;
}

export async function enqueueJob(db: D1Database, input: {
  id: string; workspace?: string; kind: string; payload?: unknown; runAfter?: string;
}) {
  const now = stamp();
  await db.prepare(`INSERT OR IGNORE INTO jobs(id,workspace,kind,payload,status,attempts,run_after,last_error,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?)`)
    .bind(input.id, input.workspace ?? null, input.kind, JSON.stringify(input.payload ?? {}), 'queued', 0, input.runAfter ?? now, '', now, now).run();
}

export async function recordAudit(db: D1Database, input: {
  id: string; workspace?: string; actor: string; action: string; target?: string; metadata?: unknown;
}) {
  await db.prepare(`INSERT INTO audit_events(id,workspace,actor,action,target,metadata,created) VALUES(?,?,?,?,?,?,?)`)
    .bind(input.id, input.workspace ?? null, input.actor, input.action, input.target ?? '', JSON.stringify(input.metadata ?? {}), stamp()).run();
}

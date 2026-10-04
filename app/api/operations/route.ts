import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/db/database';
import { recordAudit } from '@/lib/reliability';

export const dynamic = 'force-dynamic';

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: 'Authentication required.' }, 401);
  const workspace = new URL(request.url).searchParams.get('workspace');
  if (!workspace) return json({ error: 'Workspace is required.' }, 400);
  const db = database();
  const owner = await db.prepare('SELECT id FROM workspaces WHERE id=? AND owner=?').bind(workspace, user.userId).first();
  if (!owner) return json({ error: 'Workspace not found.' }, 404);
  try {
    const [jobs] = await db.batch([
      db.prepare("SELECT id,kind,status,attempts,run_after,last_error,created,updated FROM jobs WHERE workspace=? AND status IN ('queued','running','failed') ORDER BY updated DESC LIMIT 100").bind(workspace),
    ]);
    return json({ jobs: jobs.results, providerEvents: [], note: 'Provider events are intentionally omitted because the current schema does not associate them with a workspace.' });
  } catch (error) {
    if (String(error).includes('no such table')) return json({ error: 'Operations tracking is not available until the reliability migration is applied.' }, 503);
    return json({ error: 'Operations could not be loaded.' }, 500);
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: 'Authentication required.' }, 401);
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) return json({ error: 'Cross-site requests are not allowed.' }, 403);
  let body: { workspace?: unknown; jobId?: unknown };
  try { body = JSON.parse(await request.text()) as { workspace?: unknown; jobId?: unknown }; } catch { return json({ error: 'Invalid request body.' }, 400); }
  if (typeof body.workspace !== 'string' || typeof body.jobId !== 'string') return json({ error: 'Workspace and jobId are required.' }, 400);
  const db = database();
  const owner = await db.prepare('SELECT id FROM workspaces WHERE id=? AND owner=?').bind(body.workspace, user.userId).first();
  if (!owner) return json({ error: 'Workspace not found.' }, 404);
  try {
    const job = await db.prepare("SELECT id,status,attempts FROM jobs WHERE id=? AND workspace=?").bind(body.jobId, body.workspace).first<{ id: string; status: string; attempts: number }>();
    if (!job) return json({ error: 'Job not found.' }, 404);
    if (job.status !== 'failed') return json({ error: 'Only failed jobs can be retried.' }, 409);
    if (Number(job.attempts || 0) >= 5) return json({ error: 'Retry limit reached. Investigate the failure before manually repairing it.' }, 409);
    const now = new Date().toISOString();
    await db.prepare("UPDATE jobs SET status='queued',run_after=?,last_error='',updated=? WHERE id=? AND workspace=? AND status='failed'").bind(now, now, job.id, body.workspace).run();
    try { await recordAudit(db, { id: crypto.randomUUID(), workspace: body.workspace, actor: user.userId, action: 'job.retry_requested', target: job.id, metadata: { previousAttempts: job.attempts } }); } catch { /* audit table may be pending in production */ }
    return json({ ok: true, jobId: job.id, status: 'queued' });
  } catch (error) {
    if (String(error).includes('no such table')) return json({ error: 'Operations tracking is not available until the reliability migration is applied.' }, 503);
    return json({ error: 'The retry request could not be saved.' }, 500);
  }
}

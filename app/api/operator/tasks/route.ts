import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/db/database';
import { recordAudit } from '@/lib/reliability';

export const dynamic = 'force-dynamic';
const allowedStatuses = new Set(['queued', 'in_progress', 'blocked', 'completed', 'cancelled']);
const allowedApprovals = new Set(['not_required', 'pending_owner', 'approved', 'rejected']);
function json(data: unknown, status = 200) { return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } }); }
function id() { return `op_${crypto.randomUUID()}`; }
function sameOrigin(request: Request) { return request.headers.get('origin') === new URL(request.url).origin; }

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return json({ error: 'Authentication required.' }, 401);
  try {
    const rows = await database().prepare('SELECT id,title,objective,status,approval,next_action,result,created,updated FROM operator_tasks WHERE owner=? ORDER BY CASE status WHEN \'in_progress\' THEN 0 WHEN \'queued\' THEN 1 WHEN \'blocked\' THEN 2 ELSE 3 END, updated DESC LIMIT 100').bind(user.userId).all();
    return json({ tasks: rows.results });
  } catch (error) {
    if (String(error).includes('no such table')) return json({ error: 'Operator tasks are unavailable until migration 0007 is applied.' }, 503);
    return json({ error: 'Operator tasks could not be loaded.' }, 500);
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: 'Authentication required.' }, 401);
  if (!sameOrigin(request)) return json({ error: 'Cross-site requests are not allowed.' }, 403);
  let body: { title?: unknown; objective?: unknown; approval?: unknown; nextAction?: unknown };
  try { body = JSON.parse(await request.text()); } catch { return json({ error: 'Invalid request body.' }, 400); }
  if (typeof body.title !== 'string' || body.title.trim().length < 2 || body.title.length > 160) return json({ error: 'A title between 2 and 160 characters is required.' }, 400);
  if (typeof body.objective !== 'string' || body.objective.trim().length < 2 || body.objective.length > 4000) return json({ error: 'An objective between 2 and 4000 characters is required.' }, 400);
  const approval = typeof body.approval === 'string' ? body.approval : 'not_required';
  if (!allowedApprovals.has(approval)) return json({ error: 'Invalid approval state.' }, 400);
  const taskId = id();
  const now = new Date().toISOString();
  try {
    await database().prepare('INSERT INTO operator_tasks(id,owner,title,objective,status,approval,next_action,result,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(taskId, user.userId, body.title.trim(), body.objective.trim(), 'queued', approval, typeof body.nextAction === 'string' ? body.nextAction.trim().slice(0, 1000) : '', '', now, now).run();
    try { await recordAudit(database(), { id: crypto.randomUUID(), actor: user.userId, action: 'operator.task_created', target: taskId, metadata: { approval } }); } catch {}
    return json({ id: taskId, status: 'queued', approval }, 201);
  } catch (error) {
    if (String(error).includes('no such table')) return json({ error: 'Operator tasks are unavailable until migration 0007 is applied.' }, 503);
    return json({ error: 'The operator task could not be saved.' }, 500);
  }
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: 'Authentication required.' }, 401);
  if (!sameOrigin(request)) return json({ error: 'Cross-site requests are not allowed.' }, 403);
  let body: { id?: unknown; status?: unknown; approval?: unknown; nextAction?: unknown; result?: unknown };
  try { body = JSON.parse(await request.text()); } catch { return json({ error: 'Invalid request body.' }, 400); }
  if (typeof body.id !== 'string') return json({ error: 'Task id is required.' }, 400);
  if (body.status !== undefined && (typeof body.status !== 'string' || !allowedStatuses.has(body.status))) return json({ error: 'Invalid task status.' }, 400);
  if (body.approval !== undefined && (typeof body.approval !== 'string' || !allowedApprovals.has(body.approval))) return json({ error: 'Invalid approval state.' }, 400);
  const now = new Date().toISOString();
  try {
    const existing = await database().prepare('SELECT id FROM operator_tasks WHERE id=? AND owner=?').bind(body.id, user.userId).first();
    if (!existing) return json({ error: 'Task not found.' }, 404);
    await database().prepare('UPDATE operator_tasks SET status=COALESCE(?,status),approval=COALESCE(?,approval),next_action=COALESCE(?,next_action),result=COALESCE(?,result),updated=? WHERE id=? AND owner=?').bind(body.status ?? null, body.approval ?? null, typeof body.nextAction === 'string' ? body.nextAction.slice(0, 1000) : null, typeof body.result === 'string' ? body.result.slice(0, 4000) : null, now, body.id, user.userId).run();
    try { await recordAudit(database(), { id: crypto.randomUUID(), actor: user.userId, action: 'operator.task_updated', target: body.id, metadata: { status: body.status, approval: body.approval } }); } catch {}
    return json({ ok: true, id: body.id, updated: now });
  } catch (error) {
    if (String(error).includes('no such table')) return json({ error: 'Operator tasks are unavailable until migration 0007 is applied.' }, 503);
    return json({ error: 'The operator task could not be updated.' }, 500);
  }
}

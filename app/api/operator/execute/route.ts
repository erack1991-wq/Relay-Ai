import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/db/database';
import { recordAudit } from '@/lib/reliability';

export const dynamic = 'force-dynamic';
function json(data: unknown, status = 200) { return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } }); }
function sameOrigin(request: Request) { return request.headers.get('origin') === new URL(request.url).origin; }

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: 'Authentication required.' }, 401);
  if (!sameOrigin(request)) return json({ error: 'Cross-site requests are not allowed.' }, 403);
  let body: { id?: unknown };
  try { body = JSON.parse(await request.text()); } catch { return json({ error: 'Invalid request body.' }, 400); }
  if (typeof body.id !== 'string') return json({ error: 'Task id is required.' }, 400);
  const db = database();
  const task = await db.prepare('SELECT id,title,objective,status,approval FROM operator_tasks WHERE id=? AND owner=?').bind(body.id, user.userId).first<{ id: string; title: string; objective: string; status: string; approval: string }>();
  if (!task) return json({ error: 'Task not found.' }, 404);
  if (task.approval !== 'approved') return json({ error: 'Owner approval is required before execution.' }, 409);
  const safe = /\b(health|readiness|status|verification|verify|test|report|summary)\b/i.test(`${task.title} ${task.objective}`);
  if (!safe) return json({ error: 'This proposal needs a dedicated provider action handler and remains blocked.' }, 409);
  const now = new Date().toISOString();
  const result = 'Safe operator action acknowledged. Refresh Relay health and readiness to verify current status.';
  await db.prepare("UPDATE operator_tasks SET status='completed',result=?,updated=? WHERE id=? AND owner=? AND approval='approved'").bind(result, now, task.id, user.userId).run();
  try { await recordAudit(db, { id: crypto.randomUUID(), actor: user.userId, action: 'operator.safe_action_executed', target: task.id, metadata: { kind: 'read_only_status' } }); } catch {}
  return json({ ok: true, id: task.id, result, updated: now });
}

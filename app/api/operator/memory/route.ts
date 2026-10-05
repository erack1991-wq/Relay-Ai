import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/db/database';
import { recordAudit } from '@/lib/reliability';

export const dynamic = 'force-dynamic';
const kinds = new Set(['decision', 'lesson', 'architecture', 'failure', 'customer_value']);
function json(data: unknown, status = 200) { return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } }); }
function sameOrigin(request: Request) { return request.headers.get('origin') === new URL(request.url).origin; }
function id() { return `mem_${crypto.randomUUID()}`; }

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: 'Authentication required.' }, 401);
  const url = new URL(request.url);
  const kind = url.searchParams.get('kind');
  const query = url.searchParams.get('q')?.trim().slice(0, 120) || '';
  if (kind && !kinds.has(kind)) return json({ error: 'Invalid memory kind.' }, 400);
  try {
    const clauses = ['owner=?']; const bindings: string[] = [user.userId];
    if (kind) { clauses.push('kind=?'); bindings.push(kind); }
    if (query) { clauses.push('(title LIKE ? OR content LIKE ?)'); bindings.push(`%${query}%`, `%${query}%`); }
    const rows = await database().prepare(`SELECT id,kind,title,content,source_task,created,updated FROM operator_memory WHERE ${clauses.join(' AND ')} ORDER BY updated DESC LIMIT 200`).bind(...bindings).all();
    return json({ memories: rows.results });
  } catch (error) {
    if (String(error).includes('no such table')) return json({ error: 'Operator memory is unavailable until migration 0008 is applied.' }, 503);
    return json({ error: 'Operator memory could not be loaded.' }, 500);
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: 'Authentication required.' }, 401);
  if (!sameOrigin(request)) return json({ error: 'Cross-site requests are not allowed.' }, 403);
  let body: { kind?: unknown; title?: unknown; content?: unknown; sourceTask?: unknown };
  try { body = JSON.parse(await request.text()); } catch { return json({ error: 'Invalid request body.' }, 400); }
  if (typeof body.kind !== 'string' || !kinds.has(body.kind)) return json({ error: 'Invalid memory kind.' }, 400);
  if (typeof body.title !== 'string' || body.title.trim().length < 2 || body.title.length > 160) return json({ error: 'A title between 2 and 160 characters is required.' }, 400);
  if (typeof body.content !== 'string' || body.content.trim().length < 2 || body.content.length > 8000) return json({ error: 'Content must be between 2 and 8000 characters.' }, 400);
  const now = new Date().toISOString(); const memoryId = id();
  try {
    await database().prepare('INSERT INTO operator_memory(id,owner,kind,title,content,source_task,created,updated) VALUES(?,?,?,?,?,?,?,?)').bind(memoryId, user.userId, body.kind, body.title.trim(), body.content.trim(), typeof body.sourceTask === 'string' ? body.sourceTask : '', now, now).run();
    try { await recordAudit(database(), { id: crypto.randomUUID(), actor: user.userId, action: 'operator.memory_created', target: memoryId, metadata: { kind: body.kind } }); } catch {}
    return json({ id: memoryId, kind: body.kind }, 201);
  } catch (error) {
    if (String(error).includes('no such table')) return json({ error: 'Operator memory is unavailable until migration 0008 is applied.' }, 503);
    return json({ error: 'The memory entry could not be saved.' }, 500);
  }
}

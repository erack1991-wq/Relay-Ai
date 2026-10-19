import { getChatGPTUser } from '@/app/chatgpt-auth';
import { chatWithModel } from '@/lib/owner-ai/model-router';
import type { ChatTurn, ChatRequest } from '@/lib/owner-ai/model-router';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

/**
 * Private, opt-in owner preview. This route must remain disabled until deployment
 * identity headers are verified to be injected by trusted infrastructure only.
 * It does not accept owner IDs, API credentials or approval grants from the client.
 */
export async function POST(request: Request) {
  if (process.env.OWNER_AI_CHAT_ENABLED !== 'true') return json({ error: 'Owner AI chat is not enabled.' }, 503);
  const user = await getChatGPTUser();
  if (!user) return json({ error: 'Authentication required.' }, 401);
  const allowed = process.env.OWNER_AI_ALLOWED_USER_ID;
  if (!allowed || user.userId !== allowed) return json({ error: 'Forbidden.' }, 403);
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) return json({ error: 'Invalid origin.' }, 403);
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('application/json')) return json({ error: 'JSON required.' }, 415);
  let body: Partial<ChatRequest>;
  try {
    const raw = await request.text();
    if (raw.length > 50000) return json({ error: 'Request too large.' }, 413);
    body = JSON.parse(raw) as Partial<ChatRequest>;
  } catch {
    return json({ error: 'Invalid JSON.' }, 400);
  }
  const provider = body.provider;
  const model = body.model;
  const messages = body.messages;
  if (!provider || !['openai', 'anthropic', 'google', 'ollama'].includes(provider) ||
      typeof model !== 'string' || !Array.isArray(messages) ||
      messages.some((m: ChatTurn) => !m || typeof m.content !== 'string' ||
        !['user', 'assistant'].includes(m.role))) {
    return json({ error: 'Invalid chat request.' }, 400);
  }
  // The caller cannot set a system prompt or override server policy.
  const scoped: ChatTurn[] = [
    { role: 'system', content: 'You are Relay Owner AI, a private assistant. You may propose actions but cannot execute tools in this chat.' },
    ...messages,
  ];
  try {
    const result = await chatWithModel({ provider, model, messages: scoped }, process.env);
    return json({ text: result.text, provider: result.provider, model: result.model });
  } catch {
    // Provider errors can contain request details or credentials; never reflect them.
    return json({ error: 'The model request failed. Check provider configuration or try again.' }, 502);
  }
}

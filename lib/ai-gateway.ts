import { bindings } from './telephony';

type AiRequest = { model: string; input: unknown; text: unknown; max_output_tokens: number; reasoning?: unknown; store?: boolean };

function endpoint(base: string) { return `${base.replace(/\/$/, '')}/v1/responses`; }

export async function aiResponse(body: AiRequest) {
  const e = bindings();
  const providers = [
    { name: 'primary', key: e.OPENAI_API_KEY, base: 'https://api.openai.com', model: body.model },
    { name: 'backup', key: e.AI_BACKUP_API_KEY, base: e.AI_BACKUP_BASE_URL, model: e.AI_BACKUP_MODEL || body.model },
  ].filter((p): p is { name: string; key: string; base: string; model: string } => Boolean(p.key && p.base));
  if (!providers.length) throw new Error('AI provider is not configured');
  let last: Error | undefined;
  for (const provider of providers) {
    try {
      const r = await fetch(endpoint(provider.base), {
        method: 'POST', signal: AbortSignal.timeout(7000),
        headers: { Authorization: `Bearer ${provider.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, model: provider.model, store: false }),
      });
      if (!r.ok) {
        const error = new Error(`AI provider ${provider.name} HTTP ${r.status}`);
        if (![408, 429, 500, 502, 503, 504].includes(r.status)) throw error;
        last = error; continue;
      }
      return await r.json();
    } catch (error) {
      last = error instanceof Error ? error : new Error('AI provider request failed');
    }
  }
  throw last || new Error('AI provider request failed');
}

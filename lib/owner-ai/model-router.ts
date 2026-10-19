/**
 * Server-side model transport for owner-only AI.
 * This module intentionally exports no HTTP endpoint. Authentication, scope,
 * budgets, rate limits and audit logging must wrap it before exposure.
 */
import type { ModelProvider } from './core';

export type ChatTurn = { role: 'user' | 'assistant' | 'system'; content: string };
export type ChatRequest = {
  provider: ModelProvider;
  model: string;
  messages: ChatTurn[];
};
export type ChatResponse = { provider: ModelProvider; model: string; text: string };

const defaults: Record<ModelProvider, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  ollama: 'http://127.0.0.1:11434',
};

function configuredUrl(provider: ModelProvider, env: Record<string, string | undefined>): string {
  // Provider base URLs must come from trusted server configuration, never user requests.
  const override = env[provider === 'ollama' ? 'OLLAMA_BASE_URL' : ''];
  const url = new URL(override || defaults[provider]);
  if (provider === 'ollama') {
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
      throw new Error('Ollama must use a loopback address in this initial implementation');
    }
    if (url.protocol !== 'http:') throw new Error('Invalid Ollama protocol');
  } else if (url.protocol !== 'https:') {
    throw new Error('Model provider requires HTTPS');
  }
  return url.toString().replace(/\/$/, '');
}

export async function chatWithModel(
  request: ChatRequest,
  env: Record<string, string | undefined>,
  fetcher: typeof fetch = fetch,
): Promise<ChatResponse> {
  if (!request.model || request.model.length > 100 || !/^[a-zA-Z0-9._:/-]+$/.test(request.model)) {
    throw new Error('Invalid model identifier');
  }
  if (!request.messages.length || request.messages.length > 40 ||
      request.messages.some(m => !['user', 'assistant', 'system'].includes(m.role) || !m.content || m.content.length > 12000)) {
    throw new Error('Invalid message history');
  }
  const provider = request.provider;
  if (!(provider in defaults)) throw new Error('Unknown model provider');
  const base = configuredUrl(provider, env);
  let url: string;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  let body: unknown;
  if (provider === 'openai') {
    if (!env.OPENAI_API_KEY) throw new Error('OpenAI is not configured');
    url = base + '/chat/completions';
    headers.authorization = 'Bearer ' + env.OPENAI_API_KEY;
    body = { model: request.model, messages: request.messages, max_completion_tokens: 1024 };
  } else if (provider === 'anthropic') {
    if (!env.ANTHROPIC_API_KEY) throw new Error('Anthropic is not configured');
    url = base + '/messages';
    headers['x-api-key'] = env.ANTHROPIC_API_KEY;
    headers['anthropic-version'] = '2023-06-01';
    const system = request.messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
    body = { model: request.model, max_tokens: 1024, ...(system ? { system } : {}),
      messages: request.messages.filter(m => m.role !== 'system') };
  } else if (provider === 'google') {
    if (!env.GOOGLE_GENERATIVE_AI_API_KEY) throw new Error('Google is not configured');
    url = base + '/models/' + encodeURIComponent(request.model) + ':generateContent';
    headers['x-goog-api-key'] = env.GOOGLE_GENERATIVE_AI_API_KEY;
    body = { contents: request.messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }],
    })), ...(request.messages.some(m => m.role === 'system') ? {
      systemInstruction: { parts: [{ text: request.messages.filter(m => m.role === 'system').map(m => m.content).join('\n') }] },
    } : {}) };
  } else {
    url = base + '/api/chat';
    body = { model: request.model, messages: request.messages, stream: false };
  }
  const response = await fetcher(url, {
    method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error('Model provider request failed (' + response.status + ')');
  const data = await response.json() as { choices?: { message?: { content?: string } }[]; content?: { type?: string; text?: string }[]; candidates?: { content?: { parts?: { text?: string }[] } }[]; message?: { content?: string } };
  const text = provider === 'openai' ? data.choices?.[0]?.message?.content
    : provider === 'anthropic' ? data.content?.filter((x: { type?: string; text?: string }) => x.type === 'text').map((x: { type?: string; text?: string }) => x.text).join('')
    : provider === 'google' ? data.candidates?.[0]?.content?.parts?.map((x: { type?: string; text?: string }) => x.text || '').join('')
    : data.message?.content;
  if (typeof text !== 'string') throw new Error('Model provider returned no text');
  return { provider, model: request.model, text };
}

'use client';

import { FormEvent, useState } from 'react';

type Turn = { role: 'user' | 'assistant'; content: string };
const models = [
  { provider: 'openai', model: 'gpt-4.1-mini', label: 'OpenAI' },
  { provider: 'anthropic', model: 'claude-sonnet-4-5', label: 'Claude' },
  { provider: 'google', model: 'gemini-2.5-flash', label: 'Gemini' },
  { provider: 'ollama', model: 'qwen3:8b', label: 'Local Ollama' },
] as const;

export default function OwnerAiPage() {
  const [selected, setSelected] = useState(0);
  const [messages, setMessages] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  async function send(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next: Turn[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setNotice('');
    setBusy(true);
    try {
      const response = await fetch('/api/owner-ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...models[selected], messages: next }),
      });
      const data = await response.json() as { text?: string; error?: string };
      if (!response.ok || !data.text) throw new Error(data.error || 'The model did not respond.');
      setMessages([...next, { role: 'assistant', content: data.text }]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  }
  return <main style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px', fontFamily: 'system-ui' }}>
    <p style={{ letterSpacing: 2, fontSize: 12 }}>RELAY OWNER AI · PRIVATE PREVIEW</p>
    <h1>Owner AI</h1>
    <p>Multi-model chat preview. No tool execution or production operations are enabled.</p>
    <label htmlFor="model">Model</label>{' '}
    <select id="model" value={selected} onChange={e => { setSelected(Number(e.target.value)); setMessages([]); setNotice(''); }}>
      {models.map((item, i) => <option key={item.provider} value={i}>{item.label} — {item.model}</option>)}
    </select>
    <section aria-label="Conversation" aria-live="polite" style={{ minHeight: 300, display: 'grid', alignContent: 'start', gap: 12, margin: '24px 0' }}>
      {messages.length === 0 && <p>Ask your first question when the private API is enabled.</p>}
      {messages.map((m, i) => <article key={i} style={{ padding: 14, border: '1px solid #ccc', borderRadius: 10, whiteSpace: 'pre-wrap' }}>
        <strong>{m.role === 'user' ? 'You' : 'Owner AI'}</strong><p>{m.content}</p>
      </article>)}
    </section>
    {notice && <p role="alert">{notice}</p>}
    <form onSubmit={send} style={{ display: 'flex', gap: 10 }}>
      <input aria-label="Message" value={input} onChange={e => setInput(e.target.value)} maxLength={12000} placeholder="Ask Owner AI…" style={{ flex: 1, padding: 12 }} />
      <button disabled={busy || !input.trim()} type="submit">{busy ? 'Thinking…' : 'Send'}</button>
    </form>
  </main>;
}

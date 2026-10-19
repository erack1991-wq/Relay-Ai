'use client';

import { FormEvent, useState } from 'react';

type Message = { role: 'user' | 'assistant'; content: string };

const starters = [
  'What operator tasks are still blocked?',
  'What decisions have we saved about Relay?',
  'What should we tackle next in the owner AI?',
];

export default function OwnerAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function send(text = draft) {
    const content = text.trim();
    if (!content || pending) return;
    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next);
    setDraft('');
    setError('');
    setPending(true);
    try {
      const response = await fetch('/api/operator/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const body = await response.json() as { answer?: string; error?: string; toolsUsed?: string[] };
      if (!response.ok || !body.answer) throw new Error(body.error || 'Owner AI could not answer.');
      const note = body.toolsUsed?.length ? `\\n\\nRead-only tools used: ${body.toolsUsed.join(', ')}.` : '';
      setMessages([...next, { role: 'assistant', content: body.answer + note }]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Owner AI could not answer. Try again.');
      setMessages(messages);
      setDraft(content);
    } finally {
      setPending(false);
    }
  }

  function submit(event: FormEvent) { event.preventDefault(); void send(); }

  return <main style={{ maxWidth: 920, margin: '0 auto', padding: '32px 20px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#152520' }}>
    <p style={{ color: '#587767', letterSpacing: 2, fontSize: 12, fontWeight: 700 }}>RELAY OWNER AI · PREVIEW</p>
    <h1 style={{ fontSize: 36, marginBottom: 8 }}>Work with Relay context</h1>
    <p style={{ color: '#63736a', marginTop: 0 }}>Ask about saved decisions and operator tasks. This first version can read those records; it cannot make changes.</p>
    <section aria-label="Conversation" style={{ minHeight: 300, maxHeight: '55vh', overflowY: 'auto', display: 'grid', alignContent: 'start', gap: 12, padding: 18, border: '1px solid #dfe6df', borderRadius: 12, background: '#f8faf8' }}>
      {messages.length === 0 ? <div>
        <p style={{ marginTop: 0 }}>Start with a question, or choose one:</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{starters.map(item => <button key={item} onClick={() => void send(item)} style={{ padding: '9px 12px', borderRadius: 20, border: '1px solid #cbd8cf', background: '#fff', cursor: 'pointer' }}>{item}</button>)}</div>
      </div> : messages.map((message, index) => <article key={index} style={{ justifySelf: message.role === 'user' ? 'end' : 'start', maxWidth: '88%', whiteSpace: 'pre-wrap', padding: '12px 15px', borderRadius: 12, background: message.role === 'user' ? '#164c3b' : '#fff', color: message.role === 'user' ? '#fff' : '#152520', border: message.role === 'assistant' ? '1px solid #dfe6df' : 0 }}>
        <strong>{message.role === 'user' ? 'You' : 'Owner AI'}</strong><div>{message.content}</div>
      </article>)}
      {pending && <p role="status">Checking Relay context…</p>}
    </section>
    {error && <p role="alert" style={{ color: '#a12622' }}>{error}</p>}
    <form onSubmit={submit} style={{ display: 'flex', gap: 10, marginTop: 14 }}>
      <input value={draft} onChange={event => setDraft(event.target.value)} maxLength={4000} placeholder="Ask about Relay tasks or saved decisions…" aria-label="Message Owner AI" style={{ flex: 1, minWidth: 0, padding: 13, border: '1px solid #cbd8cf', borderRadius: 8 }} />
      <button disabled={pending || !draft.trim()} type="submit" style={{ padding: '11px 18px', border: 0, borderRadius: 8, background: '#164c3b', color: '#fff', fontWeight: 700 }}>{pending ? 'Working…' : 'Send'}</button>
    </form>
    <p style={{ color: '#63736a', fontSize: 13 }}>Your provider key stays on the server. Chat history stays in this browser session only; each request is sent with storage disabled.</p>
  </main>;
}

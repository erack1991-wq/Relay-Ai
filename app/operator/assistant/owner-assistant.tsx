'use client';

import { FormEvent, useState } from 'react';

type Message = { role: 'user' | 'assistant'; content: string };
type TaskProposal = { title: string; objective: string; nextAction: string };
type TaskUpdateProposal = { taskId: string; title?: string; currentStatus?: string; status: 'in_progress' | 'blocked' | 'completed'; nextAction?: string; result?: string };

const starters = [
  'What operator tasks are still blocked?',
  'What decisions have we saved about Relay?',
  'What should we tackle next in the owner AI?',
  'What is the status of Relay’s open GitHub PRs and CI?',
  'What does Relay’s runtime health check report?',
  'Where in the code is Twilio configured?',
  'Summarize the changes in PR #13.',
];

export default function OwnerAssistant({ embedded = false }: { embedded?: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [taskProposal, setTaskProposal] = useState<TaskProposal | null>(null);
  const [taskUpdateProposal, setTaskUpdateProposal] = useState<TaskUpdateProposal | null>(null);
  const [queuePending, setQueuePending] = useState(false);

  async function send(text = draft) {
    const content = text.trim();
    if (!content || pending) return;
    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next);
    setDraft('');
    setError('');
    setTaskProposal(null);
    setTaskUpdateProposal(null);
    setPending(true);
    try {
      const response = await fetch('/api/operator/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const body = await response.json() as { answer?: string; error?: string; toolsUsed?: string[]; taskProposal?: TaskProposal | null; taskUpdateProposal?: TaskUpdateProposal | null };
      if (!response.ok || !body.answer) throw new Error(body.error || 'Owner AI could not answer.');
      const note = body.toolsUsed?.length ? `\\n\\nTools used: ${body.toolsUsed.join(', ')}.` : '';
      setMessages([...next, { role: 'assistant', content: body.answer + note }]);
      setTaskProposal(body.taskProposal || null);
      setTaskUpdateProposal(body.taskUpdateProposal || null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Owner AI could not answer. Try again.');
      setMessages(messages);
      setDraft(content);
    } finally {
      setPending(false);
    }
  }

  async function queueTask() {
    if (!taskProposal || queuePending) return;
    setQueuePending(true);
    setError('');
    try {
      const response = await fetch('/api/operator/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: taskProposal.title, objective: taskProposal.objective, nextAction: taskProposal.nextAction, approval: 'pending_owner' }),
      });
      const body = await response.json() as { id?: string; error?: string };
      if (!response.ok || !body.id) throw new Error(body.error || 'Could not add the task.');
      setMessages(current => [...current, { role: 'assistant', content: 'Task added to Operator and marked pending your approval. It will not run automatically.' }]);
      setTaskProposal(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not add the task.');
    } finally {
      setQueuePending(false);
    }
  }

  async function applyTaskUpdate() {
    const proposal = taskUpdateProposal;
    if (!proposal || queuePending) return;
    setQueuePending(true);
    setError('');
    try {
      const response = await fetch('/api/operator/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: proposal.taskId, status: proposal.status, ...(proposal.nextAction !== undefined ? { nextAction: proposal.nextAction } : {}), ...(proposal.result !== undefined ? { result: proposal.result } : {}) }),
      });
      const body = await response.json() as { ok?: boolean; error?: string; status?: string };
      if (!response.ok || !body.ok) throw new Error(body.error || 'Could not update the task.');
      setMessages(current => [...current, { role: 'assistant', content: 'You confirmed the update. Task ' + proposal.taskId + ' is now ' + (body.status || proposal.status) + '.' }]);
      setTaskUpdateProposal(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update the task.');
    } finally {
      setQueuePending(false);
    }
  }

  function submit(event: FormEvent) { event.preventDefault(); void send(); }

  return <div style={{ maxWidth: 920, margin: '0 auto', padding: embedded ? '0' : '32px 20px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#152520' }}>
    <p style={{ color: '#587767', letterSpacing: 2, fontSize: 12, fontWeight: 700 }}>RELAY OWNER AI · PREVIEW</p>
    {embedded ? <h2 style={{ fontSize: 26, marginBottom: 8 }}>Work with Relay context</h2> : <h1 style={{ fontSize: 36, marginBottom: 8 }}>Work with Relay context</h1>}
    <p style={{ color: '#63736a', marginTop: 0 }}>Ask about saved decisions, operator tasks, Relay source code, pull request changes, public GitHub or CI status, and Relay’s runtime readiness. Owner AI can draft a new task or propose a status update; it applies an update only after you confirm it here.</p>
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
    {taskUpdateProposal && <section aria-label="Task update proposal" style={{ marginTop: 14, padding: 16, border: '1px solid #d8b679', borderRadius: 10, background: '#fff9ed' }}>
      <p style={{ marginTop: 0, fontWeight: 700 }}>Task update for your confirmation</p>
      <strong>{taskUpdateProposal.title || 'Operator task'}</strong>
      <p>Task ID: <code>{taskUpdateProposal.taskId}</code></p>
      <p>Status: {taskUpdateProposal.currentStatus || 'unknown'} → <strong>{taskUpdateProposal.status}</strong></p>
      {taskUpdateProposal.nextAction !== undefined && <p><strong>Next action:</strong> {taskUpdateProposal.nextAction || '(clear next action)'}</p>}
      {taskUpdateProposal.result !== undefined && <p><strong>Result:</strong> {taskUpdateProposal.result}</p>}
      <p style={{ color: '#63736a', fontSize: 13 }}>Nothing changes until you confirm. Relay will recheck the task and approval rules when saving.</p>
      <button type="button" onClick={() => void applyTaskUpdate()} disabled={queuePending} style={{ padding: '10px 14px', border: 0, borderRadius: 8, background: '#164c3b', color: '#fff', fontWeight: 700 }}>{queuePending ? 'Updating…' : 'Confirm task update'}</button>
      <button type="button" onClick={() => setTaskUpdateProposal(null)} disabled={queuePending} style={{ marginLeft: 8, padding: '10px 14px', border: '1px solid #b9c7bc', borderRadius: 8, background: '#fff', color: '#152520' }}>Dismiss</button>
    </section>}
    {taskProposal && <section aria-label="Task proposal" style={{ marginTop: 14, padding: 16, border: '1px solid #b9cebf', borderRadius: 10, background: '#f1f7f2' }}>
      <p style={{ marginTop: 0, fontWeight: 700 }}>Task proposal for your review</p>
      <strong>{taskProposal.title}</strong>
      <p>{taskProposal.objective}</p>
      {taskProposal.nextAction && <p><strong>Next action:</strong> {taskProposal.nextAction}</p>}
      <p style={{ color: '#63736a', fontSize: 13 }}>Saving adds it to Operator as pending your approval. It will not run automatically.</p>
      <button type="button" onClick={() => void queueTask()} disabled={queuePending} style={{ padding: '10px 14px', border: 0, borderRadius: 8, background: '#164c3b', color: '#fff', fontWeight: 700 }}>{queuePending ? 'Adding…' : 'Add to Operator tasks'}</button>
    </section>}
    <form onSubmit={submit} style={{ display: 'flex', gap: 10, marginTop: 14 }}>
      <input value={draft} onChange={event => setDraft(event.target.value)} maxLength={4000} placeholder="Ask about Relay tasks, code, decisions, GitHub, or CI…" aria-label="Message Owner AI" style={{ flex: 1, minWidth: 0, padding: 13, border: '1px solid #cbd8cf', borderRadius: 8 }} />
      <button disabled={pending || !draft.trim()} type="submit" style={{ padding: '11px 18px', border: 0, borderRadius: 8, background: '#164c3b', color: '#fff', fontWeight: 700 }}>{pending ? 'Working…' : 'Send'}</button>
    </form>
    <p style={{ color: '#63736a', fontSize: 13 }}>Your provider key stays on the server. Chat history stays in this browser session only; each request is sent with storage disabled. Task proposals are saved only when you choose to add them and remain pending your approval. Proposed status updates change a task only after you confirm them.</p>
  </div>;
}

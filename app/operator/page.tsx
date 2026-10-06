'use client';

import { FormEvent, useEffect, useState } from 'react';

type Task = { id: string; title: string; objective: string; status: string; approval: string; next_action: string; result: string; updated: string };

export default function OperatorPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  async function load() {
    try {
      const response = await fetch('/api/operator/tasks', { cache: 'no-store' });
      const body = await response.json() as { tasks?: Task[]; error?: string };
      if (response.ok) setTasks(body.tasks || []);
      else setMessage(body.error || 'Operator tasks are unavailable.');
    } catch {
      setMessage('Operator tasks could not be loaded. Try again shortly.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    const response = await fetch('/api/operator/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, objective }) });
    const body = await response.json() as { id?: string; error?: string };
    if (!response.ok) return setMessage(body.error || 'Could not create task.');
    setTitle(''); setObjective(''); setMessage('Goal added to the Operator queue.'); await load();
  }

  async function update(task: Task, status: string) {
    if (busy) return;
    setBusy(task.id);
    try {
      const response = await fetch('/api/operator/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: task.id, status }) });
      if (response.ok) await load(); else setMessage('Task update failed.');
    } catch {
      setMessage('Task update failed. Try again shortly.');
    } finally {
      setBusy('');
    }
  }

  return <main style={{ maxWidth: 1000, margin: '0 auto', padding: 40, fontFamily: 'Segoe UI, Arial, sans-serif', color: '#152520' }}>
    <p style={{ color: '#587767', letterSpacing: 2, fontSize: 12, fontWeight: 700 }}>RELAY OPERATOR V1</p>
    <h1 style={{ fontSize: 38, marginBottom: 8 }}>Owner command center</h1>
    <p style={{ color: '#63736a', marginBottom: 28 }}>Jarvis work stays visible, reversible, and approval-aware.</p>
    <section style={{ border: '1px solid #dfe6df', borderRadius: 12, padding: 24, background: '#fff', marginBottom: 24 }}>
      <h2 style={{ marginTop: 0 }}>Add a goal</h2>
      <form onSubmit={create} style={{ display: 'grid', gap: 12 }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Goal title" required maxLength={160} style={{ padding: 12, border: '1px solid #cbd8cf', borderRadius: 8 }} />
        <textarea value={objective} onChange={e => setObjective(e.target.value)} placeholder="What should Relay accomplish?" required maxLength={4000} rows={4} style={{ padding: 12, border: '1px solid #cbd8cf', borderRadius: 8 }} />
        <button type="submit" style={{ width: 'fit-content', padding: '11px 17px', border: 0, borderRadius: 8, background: '#164c3b', color: '#fff', fontWeight: 700 }}>Queue goal</button>
      </form>
    </section>
    {message && <p role="status">{message}</p>}
    <section style={{ display: 'grid', gap: 12 }}>
      {loading ? <p>Loading Operator tasks…</p> : tasks.length === 0 ? <p>No Operator goals yet.</p> : tasks.map(task => <article key={task.id} style={{ border: '1px solid #dfe6df', borderRadius: 12, padding: 20, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}><h2 style={{ margin: 0, fontSize: 20 }}>{task.title}</h2><span>{task.status}{task.approval === 'pending_owner' ? ' · approval needed' : ''}</span></div>
        <p>{task.objective}</p>
        {task.next_action && <p><strong>Next:</strong> {task.next_action}</p>}
        <div style={{ display: 'flex', gap: 8 }}><button disabled={busy === task.id} onClick={() => void update(task, 'in_progress')}>{busy === task.id ? 'Saving…' : 'Start'}</button><button disabled={busy === task.id} onClick={() => void update(task, 'blocked')}>Block</button><button disabled={busy === task.id} onClick={() => void update(task, 'completed')}>Complete</button></div>
      </article>)}
    </section>
  </main>;
}

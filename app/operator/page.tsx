'use client';

import { FormEvent, useEffect, useState } from 'react';
import ImprovementQueue from '../improvement-queue';

type Task = { id: string; title: string; objective: string; status: string; approval: string; next_action: string; result: string; updated: string };
type Plan = { summary: string; steps: string[]; nextAction: string; approvalRequired: boolean; approvalReason: string };
type Health = { readyForPilot: boolean; pilotBlockers?: { label: string; nextAction: string }[]; operations?: { failedJobs: number; failedProviderEvents: number } };
type Report = { counts: { missedCallOpportunities: number; pendingFollowups: number; callsNeedingAttention: number } };

export default function OperatorPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [creating, setCreating] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  async function load() {
    try {
      const response = await fetch('/api/operator/tasks', { cache: 'no-store' });
      const body = await response.json() as { tasks?: Task[]; error?: string };
      if (response.ok) setTasks(body.tasks || []);
      else setMessage(body.error || 'Operator tasks are unavailable.');
      const [healthResponse, reportResponse] = await Promise.all([
        fetch('/api/health', { cache: 'no-store' }),
        fetch('/api/reporting/summary', { cache: 'no-store' }),
      ]);
      if (healthResponse.ok) setHealth(await healthResponse.json() as Health);
      if (reportResponse.ok) setReport(await reportResponse.json() as Report);
    } catch {
      setMessage('Operator tasks could not be loaded. Try again shortly.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    await queueGoal(true);
  }

  async function queueGoal(withPlan = false) {
    if (creating) return;
    setCreating(true);
    setMessage('');
    try {
      let plan: Plan | undefined;
      if (withPlan) {
        const planResponse = await fetch('/api/operator/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, objective }) });
        const planBody = await planResponse.json() as { plan?: Plan; error?: string };
        if (!planResponse.ok || !planBody.plan) { setMessage(planBody.error || 'Relay could not create a plan.'); return; }
        plan = planBody.plan;
      }
      const response = await fetch('/api/operator/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        title, objective,
        ...(plan ? { approval: plan.approvalRequired ? 'pending_owner' : 'not_required', nextAction: plan.nextAction, result: JSON.stringify(plan) } : {}),
      }) });
      const body = await response.json() as { id?: string; error?: string };
      if (!response.ok) { setMessage(body.error || 'Could not create task.'); return; }
      setTitle(''); setObjective(''); setMessage(plan ? 'Plan saved to the Operator queue. Relay has not executed any steps.' : 'Goal added to the Operator queue.'); await load();
    } catch {
      setMessage('Relay could not save the goal. Try again shortly.');
    } finally {
      setCreating(false);
    }
  }

  async function update(task: Task, status: string, approval?: 'approved' | 'rejected') {
    if (busy) return;
    if (approval === 'approved' && !window.confirm(`Approve “${task.title}” and start tracking it? This only changes tracking state; it will not run code or make external changes.`)) return;
    if (approval === 'rejected' && !window.confirm(`Reject “${task.title}” and cancel this proposed task?`)) return;
    setBusy(task.id);
    setMessage('');
    try {
      const response = await fetch('/api/operator/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: task.id, status, ...(approval ? { approval } : {}) }) });
      if (response.ok) await load(); else { const body = await response.json() as { error?: string }; setMessage(body.error || 'Task update failed.'); }
    } catch {
      setMessage('Task update failed. Try again shortly.');
    } finally {
      setBusy('');
    }
  }

  return <main style={{ maxWidth: 1000, margin: '0 auto', padding: 40, fontFamily: 'Segoe UI, Arial, sans-serif', color: '#152520' }}>
    <p style={{ color: '#587767', letterSpacing: 2, fontSize: 12, fontWeight: 700 }}>RELAY OPERATOR V1</p>
    <h1 style={{ fontSize: 38, marginBottom: 8 }}>Owner command center</h1>
    <p style={{ color: '#63736a', marginBottom: 28 }}>Jarvis work stays visible, reversible, and approval-aware. <a href="/operator/command" style={{ color: '#164c3b', fontWeight: 700 }}>Open Owner AI command center →</a> · <a href="/operator/assistant">Open chat only →</a></p>
    <ImprovementQueue health={health} report={report} pending={tasks.filter(task => task.status !== 'completed' && task.status !== 'cancelled').length} openItems={report?.counts.missedCallOpportunities ?? 0} />
    <section style={{ border: '1px solid #dfe6df', borderRadius: 12, padding: 24, background: '#fff', marginBottom: 24 }}>
      <h2 style={{ marginTop: 0 }}>Add a goal</h2>
      <form onSubmit={create} style={{ display: 'grid', gap: 12 }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Goal title" required maxLength={160} style={{ padding: 12, border: '1px solid #cbd8cf', borderRadius: 8 }} />
        <textarea value={objective} onChange={e => setObjective(e.target.value)} placeholder="What should Relay accomplish?" required maxLength={4000} rows={4} style={{ padding: 12, border: '1px solid #cbd8cf', borderRadius: 8 }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button type="submit" disabled={creating} style={{ width: 'fit-content', padding: '11px 17px', border: 0, borderRadius: 8, background: '#164c3b', color: '#fff', fontWeight: 700 }}>{creating ? 'Working…' : 'Plan & queue'}</button>
          <button type="button" disabled={creating} onClick={() => void queueGoal()} style={{ width: 'fit-content', padding: '11px 17px', border: '1px solid #cbd8cf', borderRadius: 8, background: '#fff', color: '#164c3b', fontWeight: 700 }}>Queue without a plan</button>
        </div>
      </form>
    </section>
    {message && <p role="status">{message}</p>}
    <section style={{ display: 'grid', gap: 12 }}>
      {loading ? <p>Loading Operator tasks…</p> : tasks.length === 0 ? <p>No Operator goals yet.</p> : tasks.map(task => <article key={task.id} style={{ border: '1px solid #dfe6df', borderRadius: 12, padding: 20, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}><h2 style={{ margin: 0, fontSize: 20 }}>{task.title}</h2><span>{task.status}{task.approval === 'pending_owner' ? ' · approval needed' : ''}</span></div>
        <p>{task.objective}</p>
        {task.result && (() => {
          try {
            const plan = JSON.parse(task.result) as Plan;
            if (!Array.isArray(plan.steps)) return <p>{task.result}</p>;
            return <div style={{ background: '#f5f8f5', borderRadius: 8, padding: 14, margin: '12px 0' }}>
              <p><strong>Plan:</strong> {plan.summary}</p>
              <ol>{plan.steps.map((step, index) => <li key={`${task.id}-step-${index}`}>{step}</li>)}</ol>
              {plan.approvalRequired && <p><strong>Owner approval required:</strong> {plan.approvalReason || 'Review before carrying out the plan.'}</p>}
              <p><strong>Next:</strong> {plan.nextAction}</p>
              <p style={{ color: '#63736a', marginBottom: 0 }}>Plan only; Relay has not executed these steps.</p>
            </div>;
          } catch { return <p>{task.result}</p>; }
        })()}
        {!task.result && task.next_action && <p><strong>Next:</strong> {task.next_action}</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {task.approval === 'pending_owner' ? <>
            <button disabled={busy === task.id} onClick={() => void update(task, 'in_progress', 'approved')}>{busy === task.id ? 'Saving…' : 'Approve & track'}</button>
            <button disabled={busy === task.id} onClick={() => void update(task, 'cancelled', 'rejected')}>Reject proposal</button>
          </> : task.approval === 'rejected' || task.status === 'cancelled' || task.status === 'completed' ? null : <>
            <button disabled={busy === task.id} onClick={() => void update(task, 'in_progress')}>{busy === task.id ? 'Saving…' : 'Start tracking'}</button>
            <button disabled={busy === task.id} onClick={() => void update(task, 'blocked')}>Block</button>
            <button disabled={busy === task.id} onClick={() => void update(task, 'completed')}>Complete</button>
          </>}
        </div>
      </article>)}
    </section>
  </main>;
}

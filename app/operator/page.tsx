'use client';

import { FormEvent, useEffect, useState } from 'react';

type Task = { id: string; title: string; objective: string; status: string; approval: string; next_action: string; result: string; updated: string };
type Health = { readyForPilot: boolean; pilotBlockers?: { label: string; nextAction: string }[]; operations?: { queuedJobs: number; failedJobs: number; failedProviderEvents: number } };
type Report = { counts: { missedCallOpportunities: number; pendingFollowups: number; callsNeedingAttention: number; completedJobs: number }; value: { openOpportunityCents: number; confirmedRevenueCents: number } };

export default function OperatorPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<Health | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [command, setCommand] = useState('');
  const [commandResult, setCommandResult] = useState('');
  const [commandTool, setCommandTool] = useState('');

  async function load() {
    const response = await fetch('/api/operator/tasks', { cache: 'no-store' });
    const body = await response.json() as { tasks?: Task[]; error?: string };
    if (response.ok) setTasks(body.tasks || []);
    else setMessage(body.error || 'Operator tasks are unavailable.');
    const [healthResponse, reportResponse] = await Promise.all([fetch('/api/health', { cache: 'no-store' }), fetch('/api/reporting/summary', { cache: 'no-store' })]);
    if (healthResponse.ok) setHealth(await healthResponse.json() as Health);
    if (reportResponse.ok) setReport(await reportResponse.json() as Report);
    setLoading(false);
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

  async function runCommand(event: FormEvent) {
    event.preventDefault();
    const normalized = command.trim().toLowerCase();
    if (!normalized) return;
    setCommandResult('Thinking…');
    const context = JSON.stringify({ health, report, tasks: tasks.slice(0, 20) });
    const response = await fetch('/api/operator/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: command.trim(), context }) });
    const body = await response.json() as { text?: string; error?: string; tool?: string; approvalRequired?: boolean; proposalId?: string };
    if (response.ok) { setCommandResult(`${body.approvalRequired ? 'Approval task created. ' : ''}${body.text || 'No response returned.'}`); setCommandTool(body.tool && body.tool !== 'none' ? body.tool : 'model guidance'); setCommand(''); await load(); return; }
    if (normalized.includes('attention') || normalized.includes('today') || normalized.includes('block')) {
      const blockers = health?.pilotBlockers?.slice(0, 3).map(item => `${item.label}: ${item.nextAction}`).join(' | ') || 'No readiness blockers loaded.';
      const attention = (report?.counts.pendingFollowups ?? 0) + (report?.counts.callsNeedingAttention ?? 0);
      setCommandResult(`${attention} item(s) need attention. Pilot status: ${health?.readyForPilot ? 'ready' : 'blocked'}. ${blockers}`);
    } else if (normalized.includes('missed') || normalized.includes('lead')) {
      setCommandResult(`${report?.counts.missedCallOpportunities ?? 0} missed-call opportunities are recorded. Relay can prepare follow-ups, but sending remains review-gated.`);
    } else if (normalized.includes('safe') || normalized.includes('check') || normalized.includes('health')) {
      setCommandResult(`Safe status check: ${health?.readyForPilot ? 'pilot gate passed' : 'pilot gate blocked'}; ${health?.operations?.failedJobs ?? 0} failed operations; ${health?.operations?.failedProviderEvents ?? 0} failed provider events.`);
    } else {
      setCommandResult('I can currently answer readiness, health, attention, missed-call, lead, and safe-check requests. External actions remain approval-gated.');
    }
    setCommand('');
  }

  async function update(task: Task, changes: { status?: string; approval?: string }) {
    const response = await fetch('/api/operator/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: task.id, ...changes }) });
    if (response.ok) await load(); else setMessage('Task update failed.');
  }

  async function execute(task: Task) {
    const response = await fetch('/api/operator/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: task.id }) });
    const body = await response.json() as { result?: string; error?: string };
    setMessage(response.ok ? body.result || 'Safe action completed.' : body.error || 'Execution was blocked.');
    if (response.ok) await load();
  }

  return <main style={{ maxWidth: 1000, margin: '0 auto', padding: 40, fontFamily: 'Segoe UI, Arial, sans-serif', color: '#152520' }}>
    <p style={{ color: '#587767', letterSpacing: 2, fontSize: 12, fontWeight: 700 }}>RELAY OPERATOR V1</p>
    <h1 style={{ fontSize: 38, marginBottom: 8 }}>Owner command center</h1>
    <p style={{ color: '#63736a', marginBottom: 28 }}>Jarvis work stays visible, reversible, and approval-aware.</p>
    <section style={{ border: '1px solid #dfe6df', borderRadius: 12, padding: 24, background: '#fff', marginBottom: 24 }}>
      <h2 style={{ marginTop: 0 }}>Ask Relay</h2>
      <p style={{ color: '#63736a' }}>Try “What needs attention today?”, “Show missed calls”, or “Run a safe health check.”</p>
      <form onSubmit={runCommand} style={{ display: 'flex', gap: 8 }}><input value={command} onChange={e => setCommand(e.target.value)} placeholder="Ask a Relay question…" maxLength={500} style={{ flex: 1, padding: 12, border: '1px solid #cbd8cf', borderRadius: 8 }} /><button type="submit" style={{ padding: '11px 17px', border: 0, borderRadius: 8, background: '#164c3b', color: '#fff', fontWeight: 700 }}>Ask</button></form>
      {commandResult && <p role="status" style={{ marginBottom: 0, lineHeight: 1.5 }}>{commandTool && <><strong>{commandTool}:</strong> </>}{commandResult}</p>}
    </section>
    <section aria-label="Relay status" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
      {[
        ['Pilot gate', health?.readyForPilot ? 'Ready' : 'Blocked'],
        ['Missed calls', String(report?.counts.missedCallOpportunities ?? '—')],
        ['Needs attention', String((report?.counts.pendingFollowups ?? 0) + (report?.counts.callsNeedingAttention ?? 0))],
        ['Failed operations', String(health?.operations?.failedJobs ?? '—')],
      ].map(([label, value]) => <div key={label} style={{ border: '1px solid #dfe6df', borderRadius: 12, padding: 16, background: '#fff' }}><small style={{ color: '#63736a' }}>{label}</small><strong style={{ display: 'block', fontSize: 24, marginTop: 6 }}>{value}</strong></div>)}
    </section>
    {!health?.readyForPilot && <section style={{ border: '1px solid #ead9b2', borderRadius: 12, padding: 20, background: '#fffaf0', marginBottom: 24 }}><h2 style={{ marginTop: 0 }}>Highest-priority blockers</h2>{(health?.pilotBlockers || [{ label: 'Readiness check unavailable', nextAction: 'Run the readiness scan.' }]).slice(0, 3).map(blocker => <p key={blocker.label} style={{ marginBottom: 8 }}><strong>{blocker.label}:</strong> {blocker.nextAction}</p>)}</section>}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}><h2 style={{ margin: 0, fontSize: 20 }}>{task.title}</h2><span>{task.status}{task.approval === 'pending_owner' ? ' · approval needed' : task.approval === 'approved' ? ' · approved' : ''}</span></div>
        <p>{task.objective}</p>
        {task.next_action && <p><strong>Next:</strong> {task.next_action}</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button onClick={() => void update(task, { status: 'in_progress' })}>Start</button><button onClick={() => void update(task, { status: 'blocked' })}>Block</button>{task.approval === 'pending_owner' && <><button onClick={() => void update(task, { approval: 'approved' })}>Approve</button><button onClick={() => void update(task, { approval: 'rejected', status: 'blocked' })}>Reject</button></>}{task.approval === 'approved' && <button onClick={() => void execute(task)}>Execute safe action</button>}{task.approval !== 'pending_owner' && task.approval !== 'approved' && <button onClick={() => void update(task, { status: 'completed' })}>Complete</button>}</div>
      </article>)}
    </section>
  </main>;
}

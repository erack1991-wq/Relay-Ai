'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import OwnerAssistant from '../assistant/owner-assistant';
import './owner-command.css';

type Task = { id: string; title: string; objective: string; status: string; approval: string; next_action: string };
type TaskResult = { tasks: Task[]; checkedAt: string };

export default function OwnerCommandCenter() {
  const [result, setResult] = useState<TaskResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'overview' | 'assistant' | 'tasks'>('overview');
  const assistant = useRef<HTMLDivElement>(null);
  const currentRead = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    currentRead.current?.abort();
    const controller = new AbortController();
    currentRead.current = controller;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/operator/tasks', {
        cache: 'no-store', credentials: 'same-origin', redirect: 'error', signal: controller.signal,
      });
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Sign in to Relay again to load owner tasks.');
      const body = await response.json() as { tasks?: Task[]; error?: string };
      if (!response.ok) throw new Error(body.error || 'Owner tasks are unavailable.');
      if (!Array.isArray(body.tasks)) throw new Error('Owner tasks returned an unexpected response.');
      if (!controller.signal.aborted) setResult({ tasks: body.tasks, checkedAt: new Date().toISOString() });
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load owner tasks.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => { window.clearTimeout(timer); currentRead.current?.abort(); };
  }, [refresh]);

  const tasks = result?.tasks || [];
  const active = tasks.filter(task => !['completed', 'cancelled'].includes(task.status));
  const pending = active.filter(task => task.approval === 'pending_owner');
  const blocked = active.filter(task => task.status === 'blocked');
  const count = (value: number) => result ? value : '—';
  const showAssistant = () => {
    setView('assistant');
    window.setTimeout(() => assistant.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  return <div className="owner-command">
    <aside className="oc-sidebar">
      <a className="oc-brand" href="/operator/command"><b>r</b> relay <small>OWNER AI</small></a>
      <div className="oc-workspace"><strong>Relay HQ</strong><span>Authenticated owner workspace</span></div>
      <p className="oc-eyebrow">WORKSPACE</p>
      <nav aria-label="Owner workspace">
        <button className={view === 'overview' ? 'selected' : ''} onClick={() => setView('overview')}>◈ Command center</button>
        <button className={view === 'assistant' ? 'selected' : ''} onClick={showAssistant}>✧ Owner AI</button>
        <button className={view === 'tasks' ? 'selected' : ''} onClick={() => setView('tasks')}>☷ Action board</button>
        <button onClick={showAssistant}>◎ Launch readiness</button>
      </nav>
      <div className="oc-bottom"><strong>One focused next move.</strong><p>Live owner tasks. Evidence before action.</p><a href="https://github.com/erack1991-wq/Relay-Ai/pull/13" target="_blank" rel="noopener noreferrer">Source · PR #13 ↗</a><a href="/operator">Manage tasks & approvals ↗</a></div>
    </aside>
    <main className="oc-main">
      <header className="oc-header"><span>Workspace / <strong>{view === 'tasks' ? 'Action board' : view === 'assistant' ? 'Owner AI' : 'Command center'}</strong></span><Link href="/">Relay workspace ↗</Link></header>
      <div className="oc-content">
        <section className="oc-intro"><div><p className="oc-eyebrow">YOUR BUSINESS. YOUR CONTROL ROOM.</p><h1>Let’s build what’s next<span>.</span></h1><p>Your AI, real owner tasks, and the evidence that moves Relay forward.</p></div><a className="oc-primary" href="/operator">＋ New action</a></section>
        {view === 'overview' && <>
          <section className="oc-hero"><div><p className="oc-eyebrow">RELAY OWNER AI</p><h2>Big ambition.<br />Real Relay context.</h2><p>Ask about tasks, saved decisions, source code, PRs, CI, and runtime health. Review proposals before choosing to save them.</p><button onClick={showAssistant}>Work with Owner AI ↗</button></div><div className="oc-orb" aria-hidden="true">r</div></section>
          <section className="oc-metrics" aria-label="Owner task summary">
            <article><small>OPEN ACTIONS</small><strong>{count(active.length)}</strong><span>From Operator · latest 100 tasks</span></article>
            <article><small>AWAITING YOUR APPROVAL</small><strong>{count(pending.length)}</strong><span>Never started automatically</span></article>
            <article><small>BLOCKED TASKS</small><strong>{count(blocked.length)}</strong><span>Review the next step</span></article>
            <article><small>PRODUCTION READINESS</small><strong className="oc-unknown">Unverified</strong><button onClick={showAssistant}>Ask for runtime health ↗</button></article>
          </section>
        </>}
        {view !== 'assistant' && <section className="oc-panel" aria-label="Owner tasks">
          <div className="oc-panelhead"><h2>{view === 'tasks' ? 'Your action board' : 'Your focus queue'}</h2><button onClick={() => void refresh()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh tasks'}</button></div>
          {error && <p role="alert" className="oc-error">{error} {result && 'Previously loaded tasks below may be stale.'}</p>}
          {result && <p className="oc-timestamp">{error ? 'Last successful read' : 'Last refreshed'}: {new Date(result.checkedAt).toLocaleString()} · latest 100 owner tasks</p>}
          {!result && loading && <p role="status">Loading your owner tasks…</p>}
          {result && (view === 'tasks' ? tasks : active.slice(0, 5)).map(task => <article className="oc-task" key={task.id}><div><h3>{task.title}</h3><p>{task.objective}</p>{task.next_action && <p><strong>Next:</strong> {task.next_action}</p>}</div><div className="oc-taskstate"><span>{task.status.replaceAll('_', ' ')}</span>{task.approval === 'pending_owner' && <b>Approval needed</b>}<a href="/operator">Review task ↗</a></div></article>)}
          {result && (view === 'tasks' ? tasks : active).length === 0 && <p>No {view === 'tasks' ? '' : 'open '}owner tasks. Add a goal or ask Owner AI to draft one.</p>}
        </section>}
        <section className="oc-panel oc-assistant" hidden={view === 'tasks'} aria-label="Owner AI assistant">
          <div className="oc-panelhead"><h2>✧ Work with Owner AI</h2><a href="/operator/assistant" target="_top">Open full chat ↗</a></div>
          <p>Chat uses Relay’s authenticated assistant. Task proposals require your separate save click and remain pending approval. Runtime configuration errors appear inside the chat.</p>
          <div ref={assistant}><OwnerAssistant embedded /></div>
        </section>
        <footer className="oc-footer"><span>RELAY OWNER AI</span><span>Owner tasks stay in Relay. Chat history stays in this page session.</span></footer>
      </div>
    </main>
  </div>;
}

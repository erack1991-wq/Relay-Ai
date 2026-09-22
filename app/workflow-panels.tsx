/* eslint-disable @typescript-eslint/no-explicit-any, react/no-unescaped-entities */
'use client';

import { useState } from 'react';
import { CalendarDays, Plus, ArrowRight, MessageSquare, Zap } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { workflows } from '@/lib/domain';

type Row = Record<string, any>;
type Mutate = (action: string, payload?: Row, message?: string) => Promise<any>;
const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n / 100);
const when = (s: string) => new Date(s).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function Choice({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { id: string; name: string }[] }) {
  return <label className="field"><span>{label}</span><Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label}><SelectValue placeholder="Choose a customer" /></SelectTrigger><SelectContent>{options.map(o => <SelectItem value={o.id} key={o.id}>{o.name}</SelectItem>)}</SelectContent></Select></label>;
}

export function BookingForm({ customers, items, initialCustomer, initialSource, busy, mutate, done }: { customers: Row[]; items: Row[]; initialCustomer: string; initialSource: string; busy: boolean; mutate: Mutate; done: () => void }) {
  const [customer, setCustomer] = useState(initialCustomer);
  const [source, setSource] = useState(initialSource || 'none');
  const [error, setError] = useState('');
  const eligible = items.filter(i => i.customer === customer && i.status === 'open' && ['missed_call', 'quote', 'reactivation'].includes(i.kind));
  if (!customers.length) return <p className="muted">Add a customer before booking an appointment.</p>;
  return <form className="form-stack" onSubmit={async e => {
    e.preventDefault(); setError('');
    const fields = new FormData(e.currentTarget);
    const start = new Date(String(fields.get('start')));
    if (!Number.isFinite(start.getTime()) || start <= new Date() || start.getMinutes() !== 0) { setError('Choose a future appointment on the hour.'); return; }
    const result = await mutate('book', { customer, title: fields.get('title'), start: start.toISOString(), ...(source !== 'none' ? { source } : {}) }, 'Appointment booked');
    if (result) done();
  }}>
    <Choice label="Customer" value={customer} onChange={v => { setCustomer(v); setSource('none'); }} options={customers.map(c=>({id:c.id,name:c.name}))} />
    <label className="field"><span>Appointment title</span><input name="title" required maxLength={200} defaultValue={items.find(i => i.id === initialSource)?.title || ''} placeholder="Heating repair visit" /></label>
    <label className="field"><span>Start time · {Intl.DateTimeFormat().resolvedOptions().timeZone}</span><input name="start" type="datetime-local" step={3600} required /></label>
    <Choice label="Link to an opportunity" value={source} onChange={setSource} options={[{ id: 'none', name: 'No linked opportunity' }, ...eligible.map(i => ({ id: i.id, name: i.title }))]} />
    <p className="muted">Reserves one hour. A linked opportunity is marked booked and any pending follow-up draft is dismissed. No payment or customer notification is sent.</p>
    {error && <p role="alert" className="inline-error">{error}</p>}
    <button disabled={busy || !customer} className="primary"><CalendarDays size={17} />Confirm booking</button>
  </form>;
}

export function OpportunityForm({ customers, initialCustomer, busy, mutate, done }: { customers: Row[]; initialCustomer: string; busy: boolean; mutate: Mutate; done: () => void }) {
  const [customer, setCustomer] = useState(initialCustomer);
  const [kind, setKind] = useState('quote');
  const [error, setError] = useState('');
  return <form className="form-stack" onSubmit={async e => {
    e.preventDefault(); setError(''); const f = new FormData(e.currentTarget);
    const due = new Date(String(f.get('due')));
    if (!Number.isFinite(due.getTime())) { setError('Choose a valid follow-up date.'); return; }
    const result = await mutate('create_item', { customer, kind, title: f.get('title'), amount: Math.round(Number(f.get('amount')) * 100), due: due.toISOString() }, 'Opportunity added');
    if (result) done();
  }}>
    <Choice label="Customer" value={customer} onChange={setCustomer} options={customers.map(c=>({id:c.id,name:c.name}))} />
    <Choice label="Workflow" value={kind} onChange={setKind} options={workflows.map(f => ({ id: f.key, name: f.label }))} />
    <label className="field"><span>Opportunity title</span><input name="title" required maxLength={200} placeholder="System replacement estimate" /></label>
    <label className="field"><span>Value in USD</span><input type="number" name="amount" min={0} max={1000000} step="0.01" defaultValue={0} required /></label>
    <label className="field"><span>Follow up after · your computer's time zone</span><input name="due" type="datetime-local" required /></label>
    <p className="muted">This records a follow-up trigger. It does not issue an invoice or collect a payment.</p>
    {error && <p role="alert" className="inline-error">{error}</p>}
    <button className="primary" disabled={busy || !customer}><Plus size={17} />Save opportunity</button>
  </form>;
}

export function OpportunityRegister({ items, customers, tasks, busy, onAdd, onBook, mutate }: { items: Row[]; customers: Row[]; tasks: Row[]; busy: boolean; onAdd: () => void; onBook: (customer: string, source: string) => void; mutate: Mutate }) {
  const [filter, setFilter] = useState('open');
  const visible = items.filter(i => filter === 'all' || i.status === filter);
  return <section className="panel below"><div className="section-heading"><div><h2>Opportunity register</h2><p>Connect the follow-up to its next outcome.</p></div><button className="secondary" onClick={onAdd} disabled={busy}><Plus size={16} />Add opportunity</button></div>
    <div className="toolbar"><Choice label="Show opportunities" value={filter} onChange={setFilter} options={['open', 'booked', 'closed', 'all'].map(id => ({ id, name: id[0].toUpperCase() + id.slice(1) }))} /><span className="muted">{visible.length} opportunities</span></div>
    <Table><TableHeader><TableRow><TableHead>Customer / opportunity</TableHead><TableHead>Value</TableHead><TableHead>Follow up after</TableHead><TableHead>Status</TableHead><TableHead>Next step</TableHead></TableRow></TableHeader><TableBody>{visible.map(i => <TableRow key={i.id}>
      <TableCell><strong>{customers.find(c => c.id === i.customer)?.name}</strong><small>{i.title} · {workflows.find(f => f.key === i.kind)?.label}</small></TableCell><TableCell>{money(i.amount)}</TableCell><TableCell>{when(i.due)}</TableCell><TableCell><span className="badge">{i.status}</span></TableCell>
      <TableCell>{i.status === 'open' && <div className="action-row">{['missed_call', 'quote', 'reactivation'].includes(i.kind) && <button disabled={busy} className="secondary" onClick={() => onBook(i.customer, i.id)}>Book</button>}<button disabled={busy} className="text-button" onClick={() => mutate('close_item', { id: i.id }, 'Opportunity closed')}>Close</button></div>}</TableCell>
    </TableRow>)}</TableBody></Table>
    {!visible.length && <div className="empty">No {filter === 'all' ? '' : filter} opportunities.</div>}
    <p className="footnote">{tasks.filter(t => t.status === 'simulated').length} simulated deliveries · {tasks.filter(t => t.status === 'dismissed').length} dismissed · Preparing follow-ups again never duplicates an existing draft.</p>
  </section>;
}

export function CustomerActions({ customer, onBook, onOpportunity, onInbox, messages, bookings }: { customer: Row; onBook: () => void; onOpportunity: () => void; onInbox: () => void; messages: Row[]; bookings: Row[] }) {
  const events = [
    ...messages.filter(m => m.customer === customer.id).map(m => ({ id: m.id, at: m.created, label: `${m.direction === 'inbound' ? 'Incoming' : 'Outgoing'} simulation`, detail: m.body })),
    ...bookings.filter(b => b.customer === customer.id).map(b => ({ id: b.id, at: b.created, label: `Appointment ${b.status}`, detail: `${b.title} · ${when(b.start)}` }))
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
  return <div className="padded"><div className="detail-actions"><button type="button" className="secondary" onClick={onBook}><CalendarDays size={16} />Book visit</button><button type="button" className="secondary" onClick={onOpportunity}><Zap size={16} />Add opportunity</button><button type="button" className="text-button" onClick={onInbox}><MessageSquare size={16} />Open conversation</button></div><h3 style={{ marginTop: 25 }}>Recent activity</h3><div className="timeline">{events.map(e => <div key={e.id}><strong>{e.label}</strong><p>{e.detail}</p><small>{when(e.at)}</small></div>)}{!events.length && <p className="muted">No activity yet.</p>}</div></div>;
}

export function JourneyGuide({ onStart, onReview, onBook }: { onStart: () => void; onReview: () => void; onBook: () => void }) {
  return <div className="guide-strip"><div><strong>Try the missed-call-to-booking workflow</strong><p>Simulate a missed call, review the follow-up, then link a booking to the opportunity.</p></div><div className="action-row"><button className="secondary" onClick={onStart}>1. Test call</button><button className="secondary" onClick={onReview}>2. Follow up</button><button className="secondary" onClick={onBook}>3. Book <ArrowRight size={15} /></button></div></div>;
}

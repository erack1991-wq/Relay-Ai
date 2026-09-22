/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

type RecordRow = Record<string, any>;
export default function Outcomes({ items, bookings, tasks }: { items: RecordRow[]; bookings: RecordRow[]; tasks: RecordRow[] }) {
  const missed = items.filter(item => item.kind === 'missed_call');
  const linked = new Set(bookings.filter(booking => booking.status === 'confirmed' && booking.source).map(booking => booking.source));
  const booked = missed.filter(item => linked.has(item.id)).length;
  const followed = missed.filter(item => tasks.some(task => task.source === item.id && task.status === 'simulated')).length;
  return <section className="panel below padded" aria-label="Missed-call outcomes"><div className="section-heading flush"><div><h2>From missed call to booked visit</h2><p>Counts from this workspace, including sample records.</p></div><a className="text-button" href="/pilot">See the pilot offer →</a></div><div className="outcome-grid"><div><strong>{missed.length}</strong><span>Missed-call opportunities</span></div><div><strong>{followed}</strong><span>With a simulated follow-up</span></div><div><strong>{booked}</strong><span>With a confirmed linked booking</span></div></div><p className="muted">These are overlapping counts, not a conversion funnel. Bookings are not completed jobs or collected revenue.</p></section>;
}

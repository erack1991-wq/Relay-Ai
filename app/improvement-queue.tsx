'use client';

import { ArrowRight, CheckCircle2, Lightbulb, ShieldAlert } from 'lucide-react';

type Recommendation = { title: string; detail: string; tone: 'urgent' | 'next' | 'done' };

export default function ImprovementQueue({ health, report, pending, openItems }: {
  health: { readyForPilot: boolean; pilotBlockers?: { label: string; nextAction: string }[]; operations?: { failedJobs: number; failedProviderEvents: number } } | null;
  report: { counts: { missedCallOpportunities: number; pendingFollowups: number; callsNeedingAttention: number } } | null;
  pending: number;
  openItems: number;
}) {
  const recommendations: Recommendation[] = [];
  const failed = (health?.operations?.failedJobs || 0) + (health?.operations?.failedProviderEvents || 0);
  const missed = report?.counts.missedCallOpportunities || 0;
  const followups = report?.counts.pendingFollowups || pending;
  const attention = report?.counts.callsNeedingAttention || 0;

  if (failed) recommendations.push({ title: 'Recover failed operations', detail: `${failed} operation${failed === 1 ? '' : 's'} need attention in the recovery queue.`, tone: 'urgent' });
  if (attention) recommendations.push({ title: 'Review calls needing attention', detail: `${attention} call${attention === 1 ? '' : 's'} may need a human callback.`, tone: 'urgent' });
  if (missed) recommendations.push({ title: 'Run missed-call follow-up', detail: `${missed} missed-call opportunit${missed === 1 ? 'y is' : 'ies are'} available for review.`, tone: 'next' });
  if (followups) recommendations.push({ title: 'Review follow-up drafts', detail: `${followups} customer follow-up${followups === 1 ? '' : 's'} are waiting for approval.`, tone: 'next' });
  if (!health?.readyForPilot && health?.pilotBlockers?.[0]) recommendations.push({ title: 'Advance readiness', detail: health.pilotBlockers[0].nextAction, tone: 'next' });
  if (!recommendations.length) recommendations.push({ title: 'Relay is caught up', detail: openItems ? `${openItems} open opportunit${openItems === 1 ? 'y is' : 'ies are'} still being tracked.` : 'No urgent operational work is currently visible.', tone: 'done' });

  return <section className="panel below padded" aria-label="Relay recommendations">
    <div className="section-heading flush"><div><h2>Relay recommendations</h2><p>Evidence-based next actions for your business.</p></div><Lightbulb /></div>
    <div className="recommendation-list">{recommendations.slice(0, 4).map((item) => <div className="recommendation" key={item.title}>
      <div className={`recommendation-icon ${item.tone}`}>{item.tone === 'urgent' ? <ShieldAlert size={18} /> : item.tone === 'done' ? <CheckCircle2 size={18} /> : <ArrowRight size={18} />}</div>
      <div><strong>{item.title}</strong><p>{item.detail}</p></div>
    </div>)}</div>
  </section>;
}

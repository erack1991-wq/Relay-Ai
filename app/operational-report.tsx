'use client';

type Report={counts:{missedCallOpportunities:number;confirmedBookings:number;completedJobs:number;pendingFollowups:number;callsNeedingAttention:number}};

export default function OperationalReport({report}:{report:Report|null}){
 if(!report)return null;
 return <section className="panel below padded" aria-label="Operational report"><div className="section-heading flush"><div><h2>Operational scorecard</h2><p>Workspace activity, not a promise of revenue.</p></div><span className="badge neutral">LIVE COUNTS</span></div><div className="outcome-grid"><div><strong>{report.counts.missedCallOpportunities}</strong><span>Missed-call opportunities</span></div><div><strong>{report.counts.confirmedBookings}</strong><span>Confirmed bookings</span></div><div><strong>{report.counts.completedJobs}</strong><span>Completed jobs</span></div><div><strong>{report.counts.callsNeedingAttention}</strong><span>Calls needing attention</span></div></div><p className="muted">Open opportunity value is estimated. Confirmed revenue is recorded only after completed-job tracking is connected.</p></section>;
}

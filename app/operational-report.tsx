'use client';

type Report={counts:{missedCallOpportunities:number;confirmedBookings:number;recoveredBookings:number;completedJobs:number;pendingFollowups:number;callsNeedingAttention:number};value:{openOpportunityCents:number;confirmedRevenueCents:number;confirmedRevenueStatus:'recorded'|'not_recorded';note:string}};

export default function OperationalReport({report}:{report:Report|null}){
 if(!report)return null;
 const missed=report.counts.missedCallOpportunities;
 const recovered=report.counts.recoveredBookings;
 const bookingRate=missed?Math.round(recovered/missed*100):0;
 return <section className="panel below padded" aria-label="Revenue recovery scorecard"><div className="section-heading flush"><div><h2>Revenue recovery scorecard</h2><p>Evidence from this workspace—not a promise of revenue.</p></div><span className="badge neutral">LIVE COUNTS</span></div><div className="outcome-grid"><div><strong>{missed}</strong><span>Missed-call opportunities</span></div><div><strong>{recovered}</strong><span>Missed calls recovered</span></div><div><strong>{bookingRate}%</strong><span>Missed-call booking rate</span></div><div><strong>{report.counts.completedJobs}</strong><span>Completed jobs</span></div></div><div className="scorecard-revenue"><div><span>All confirmed bookings</span><strong>{report.counts.confirmedBookings}</strong><small>Across every opportunity type</small></div><div><span>Open opportunity value</span><strong>{money(report.value.openOpportunityCents)}</strong><small>Estimated pipeline only</small></div><div><span>Verified completed-job revenue</span><strong>{report.value.confirmedRevenueStatus==='recorded'?money(report.value.confirmedRevenueCents):'Not recorded'}</strong><small>{report.value.confirmedRevenueStatus==='recorded'?'Based on completed-job entries':'Complete a job record before claiming revenue'}</small></div></div><p className="muted">{report.value.note}</p></section>;
}

function money(cents:number){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(cents/100)}

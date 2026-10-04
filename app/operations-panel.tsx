'use client';
import { useState } from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

type Job={id:string;kind:string;status:string;attempts:number;last_error:string;updated:string};
export default function OperationsPanel({workspace,operations,onChanged}:{workspace:string;operations:{jobs:Job[]}|null;onChanged:()=>void}){
 const [busy,setBusy]=useState('');
 if(!operations?.jobs?.length)return null;
 async function retry(job:Job){setBusy(job.id);try{const r=await fetch('/api/operations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({workspace,jobId:job.id})});const body=await r.json() as {error?:string};if(!r.ok)throw new Error(body.error||'Retry failed.');toast.success('Job placed back in the recovery queue.');onChanged()}catch(e){toast.error(e instanceof Error?e.message:'Retry failed.')}finally{setBusy('')}}
 return <section className="panel below padded" aria-label="Operations recovery"><div className="section-heading flush"><div><h2>Recovery queue</h2><p>Failed work stays visible and retries are bounded.</p></div><ShieldAlert/></div>{operations.jobs.map(job=><div className="integration" key={job.id}><div className="integration-icon"><RefreshCw size={19}/></div><div><strong>{job.kind}</strong><p>{job.last_error||'Failed background operation'} · attempt {job.attempts}</p></div><button className="secondary" disabled={busy===job.id||job.attempts>=5} onClick={()=>retry(job)}>{busy===job.id?'Retrying…':job.attempts>=5?'Limit reached':'Retry'}</button></div>)}</section>;
}

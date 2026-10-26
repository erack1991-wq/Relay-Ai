import { verifiedForm } from '@/lib/telephony';
import { database } from '@/db/database';
export const dynamic='force-dynamic';
export async function POST(request:Request){
  let form:URLSearchParams;try{form=await verifiedForm(request);}catch{return new Response('Forbidden',{status:403});}
  const db=database(),mid=new URL(request.url).searchParams.get('message');
  if(mid){
    const status=form.get('MessageStatus')||'';
    if(['queued','sending','sent','delivered','undelivered','failed'].includes(status))await db.prepare("UPDATE messages SET status=? WHERE id=? AND status NOT IN ('delivered','undelivered','failed')").bind(status,mid).run();
  }else{
    const status=form.get('CallStatus')||'';
    const sid=form.get('CallSid')||'';
    if(['completed','failed','busy','no-answer','canceled'].includes(status)){
      const stamp=new Date().toISOString();
      // Provider completion must not erase an intake or SMS failure that still needs a human.
      await db.prepare("UPDATE voice_calls SET status=CASE WHEN error IS NOT NULL AND error<>'' THEN 'needs-attention' ELSE ? END,updated=? WHERE id=?").bind(status,stamp,sid).run();
      if(['no-answer','busy','failed'].includes(status)){
        const requestedWorkspace=new URL(request.url).searchParams.get('workspace')||'';
        const call=await db.prepare('SELECT workspace,phone FROM voice_calls WHERE id=?').bind(sid).first<{workspace:string;phone:string}>();
        const workspace=requestedWorkspace&&requestedWorkspace===call?.workspace?requestedWorkspace:(call?.workspace||'');
        if(workspace&&call?.phone){
          // The initial call creates the customer and an intake item keyed by CallSid.
          // Reuse that key so repeated or concurrent status callbacks cannot add
          // duplicate missed-call opportunities for the same provider call.
          await db.prepare("INSERT OR IGNORE INTO items(id,workspace,customer,kind,title,amount,due,created) SELECT ?,workspace,id,'missed_call','Missed call',0,?,? FROM customers WHERE workspace=? AND phone=?").bind(sid,stamp,stamp,workspace,call.phone).run();
        }
      }
    }
  }
  return new Response(null,{status:204});
}

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
          // A Twilio call can trigger the same status callback more than once.\n          // Reuse the same item primary key so retries cannot duplicate a missed-call lead.\n          const customerId=crypto.randomUUID(), itemId=`missed-call:${sid}`;
          await db.batch([
            db.prepare("INSERT OR IGNORE INTO customers(id,workspace,name,phone,email,stage,sms_consent,marketing_consent,notes,created) VALUES(?,?,?,?,?,'New lead',0,0,?,?)").bind(customerId,workspace,'Unknown caller',call.phone,'',`Missed call ${sid}`,stamp),
            db.prepare("INSERT OR IGNORE INTO items(id,workspace,customer,kind,title,amount,due,created) SELECT ?,workspace,id,'missed_call','Missed call',0,?,? FROM customers WHERE workspace=? AND phone=?").bind(itemId,stamp,stamp,workspace,call.phone)
          ]);
        }
      }
    }
  }
  return new Response(null,{status:204});
}

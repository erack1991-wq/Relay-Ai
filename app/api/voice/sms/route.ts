import { database } from '@/db/database';
import { bindings, verifiedForm } from '@/lib/telephony';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 let form:URLSearchParams;try{form=await verifiedForm(request);}catch{return new Response('Forbidden',{status:403});}
 const text=(form.get('Body')||'').trim();
 if(/^(STOP|STOPALL|UNSUBSCRIBE|CANCEL|END|QUIT)$/i.test(text)||form.get('OptOutType')==='STOP'){
  const workspace=new URL(request.url).searchParams.get('workspace')||bindings().RELAY_WORKSPACE_ID||'';
  if(workspace)await database().prepare('UPDATE customers SET opted_out=1,sms_consent=0 WHERE workspace=? AND phone=?').bind(workspace,form.get('From')||'').run();
 }
 return new Response('<?xml version="1.0"?><Response/>',{headers:{'Content-Type':'text/xml'}});
}

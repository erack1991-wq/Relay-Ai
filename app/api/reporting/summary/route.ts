import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/db/database';

export const dynamic='force-dynamic';

export async function GET(request:Request){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:'Sign in required.'},{status:401});
  const workspace=new URL(request.url).searchParams.get('workspace');
  if(!workspace)return Response.json({error:'Workspace required.'},{status:400});
  const db=database();
  const owner=await db.prepare('SELECT id FROM workspaces WHERE id=? AND owner=?').bind(workspace,user.userId).first();
  if(!owner)return Response.json({error:'Workspace not found.'},{status:404});
  const [customers,missed,openValue,bookings,completed,followups,attention]=await Promise.all([
    db.prepare('SELECT count(*) AS count FROM customers WHERE workspace=?').bind(workspace).first<{count:number}>(),
    db.prepare("SELECT count(*) AS count FROM items WHERE workspace=? AND kind='missed_call'").bind(workspace).first<{count:number}>(),
    db.prepare("SELECT COALESCE(SUM(amount),0) AS cents FROM items WHERE workspace=? AND status='open'").bind(workspace).first<{cents:number}>(),
    db.prepare("SELECT count(*) AS count FROM bookings WHERE workspace=? AND status='confirmed'").bind(workspace).first<{count:number}>(),
    db.prepare("SELECT count(*) AS count FROM bookings WHERE workspace=? AND status='completed'").bind(workspace).first<{count:number}>(),
    db.prepare("SELECT count(*) AS count FROM tasks WHERE workspace=? AND status='draft'").bind(workspace).first<{count:number}>(),
    db.prepare("SELECT count(*) AS count FROM voice_calls WHERE workspace=? AND status='needs-attention'").bind(workspace).first<{count:number}>(),
  ]);
  const valueCents=Number(openValue?.cents||0);
  return Response.json({
    workspace,
    generatedAt:new Date().toISOString(),
    counts:{customers:Number(customers?.count||0),missedCallOpportunities:Number(missed?.count||0),confirmedBookings:Number(bookings?.count||0),completedJobs:Number(completed?.count||0),pendingFollowups:Number(followups?.count||0),callsNeedingAttention:Number(attention?.count||0)},
    value:{openOpportunityCents:valueCents,confirmedRevenueCents:0,confirmedRevenueStatus:'not_recorded',note:'Open opportunity value is an estimate; confirmed revenue requires a completed job or billing record.'},
  },{headers:{'Cache-Control':'no-store'}});
}

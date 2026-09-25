import { bindings } from '@/lib/telephony';
import { database } from '@/db/database';
export const dynamic='force-dynamic';
type StripeEvent={id?:string;type?:string;data?:{object?:Record<string,unknown>}};
const now=()=>new Date().toISOString();
const text=(value:unknown)=>typeof value==='string'?value:'';
const numberText=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?new Date(value*1000).toISOString():'';
export async function POST(request: Request) {
  const secret = bindings().STRIPE_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: 'Stripe billing is not configured.' }, { status: 503 });
  const signature = request.headers.get('stripe-signature') || '';
  const raw = await request.text();
  const timestamp = signature.match(/(?:^|,)t=(\d+)/)?.[1];
  const v1 = signature.match(/(?:^|,)v1=([^,]+)/)?.[1];
  if (!timestamp || !v1 || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return Response.json({ error: 'Invalid webhook.' }, { status: 400 });
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${raw}`));
  const expected = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (expected !== v1) return Response.json({ error: 'Invalid webhook.' }, { status: 400 });
  let event:StripeEvent;
  try{event=JSON.parse(raw) as StripeEvent;}catch{return Response.json({error:'Invalid webhook payload.'},{status:400});}
  if(!event.id||!event.type||!event.data?.object)return Response.json({error:'Invalid webhook payload.'},{status:400});
  const db=database(), object=event.data.object, metadata=(object.metadata&&typeof object.metadata==='object'?object.metadata:{}) as Record<string,unknown>;
  const owner=text(metadata.owner);
  const subscriptionId=event.type==='checkout.session.completed'?text(object.subscription):text(object.id);
  const customerId=text(object.customer);
  const status=text(object.status);
  const items=object.items&&typeof object.items==='object'?(object.items as Record<string,unknown>).data:undefined;
  const priceId=Array.isArray(items)&&items[0]&&typeof items[0]==='object'?text(((items[0] as Record<string,unknown>).price&&typeof (items[0] as Record<string,unknown>).price==='object'?(items[0] as Record<string,unknown>).price as Record<string,unknown>:{}).id):'';
  const periodEnd=numberText(object.current_period_end);
  if(!owner && !subscriptionId)return new Response(null,{status:204});
  const existing=await db.prepare('SELECT id FROM subscription_events WHERE id=?').bind(event.id).first();
  if(existing)return new Response(null,{status:204});
  const resolved=owner||((await db.prepare('SELECT owner FROM subscriptions WHERE stripe_subscription_id=?').bind(subscriptionId).first<{owner:string}>())?.owner||'');
  if(resolved && ['checkout.session.completed','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(event.type)){
    const nextStatus=event.type==='customer.subscription.deleted'?'canceled':status||'active';
    await db.prepare(`INSERT INTO subscriptions(owner,stripe_customer_id,stripe_subscription_id,status,price_id,current_period_end,updated) VALUES(?,?,?,?,?,?,?) ON CONFLICT(owner) DO UPDATE SET stripe_customer_id=excluded.stripe_customer_id,stripe_subscription_id=excluded.stripe_subscription_id,status=excluded.status,price_id=excluded.price_id,current_period_end=excluded.current_period_end,updated=excluded.updated`).bind(resolved,customerId,subscriptionId,nextStatus,priceId,periodEnd,now()).run();
  }
  await db.prepare('INSERT OR IGNORE INTO subscription_events(id,created) VALUES(?,?)').bind(event.id,now()).run();
  return new Response(null, { status: 204 });
}

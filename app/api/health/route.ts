import { env } from 'cloudflare:workers';
export const dynamic='force-dynamic';
export async function GET(){
 const e=env as unknown as Record<string, unknown>;
 let database=false;
 try{await (e.DB as D1Database).prepare('SELECT id FROM voice_calls LIMIT 1').all();database=true;}catch{}
 return Response.json({ok:database,service:'relay',databaseReachable:database,configuration:{twilio:Boolean(e.TWILIO_ACCOUNT_SID&&e.TWILIO_AUTH_TOKEN&&e.TWILIO_PHONE_NUMBER),ai:Boolean(e.OPENAI_API_KEY),publicUrl:Boolean(e.PUBLIC_BASE_URL)},note:'Configuration presence does not verify provider authentication, delivery, calendar integration, or end-to-end readiness.'},{status:database?200:503,headers:{'Cache-Control':'no-store'}});
}

import { env } from 'cloudflare:workers';
export const dynamic='force-dynamic';
export async function GET(){
 const e=env as unknown as Record<string, unknown>;
 let database=false;const missingTables:string[]=[];
 try{const db=e.DB as D1Database;for(const table of ['workspaces','customers','bookings','voice_calls','subscriptions','subscription_events']){try{await db.prepare(`SELECT 1 FROM ${table} LIMIT 1`).all();}catch{missingTables.push(table);}}database=missingTables.length===0;}catch{}
 const configuration={twilio:Boolean(e.TWILIO_ACCOUNT_SID&&e.TWILIO_AUTH_TOKEN&&e.TWILIO_PHONE_NUMBER),ai:Boolean(e.OPENAI_API_KEY),publicUrl:Boolean(e.PUBLIC_BASE_URL),billing:Boolean(e.STRIPE_SECRET_KEY&&e.STRIPE_PRICE_ID&&e.STRIPE_WEBHOOK_SECRET)};
 const configurationWarnings=Object.entries(configuration).filter(([,configured])=>!configured).map(([provider])=>`${provider} is not configured`);
 const readyForPilot=database&&configuration.twilio&&configuration.ai&&configuration.publicUrl;
 return Response.json({ok:database,readyForPilot,service:'relay',databaseReachable:database,missingTables,configuration,configurationWarnings,providerVerification:'not_run',note:'Ready status confirms required tables and configuration presence only. Provider authentication and end-to-end delivery still require a live verification.'},{status:database?200:503,headers:{'Cache-Control':'no-store'}});
}

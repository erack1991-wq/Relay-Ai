import { env } from 'cloudflare:workers';
export const dynamic='force-dynamic';
export async function GET(){
 const e=env as unknown as Record<string, unknown>;
 let database=false;const missingTables:string[]=[];
 try{const db=e.DB as D1Database;for(const table of ['workspaces','customers','bookings','voice_calls','subscriptions','subscription_events','provider_events','jobs','audit_events']){try{await db.prepare(`SELECT 1 FROM ${table} LIMIT 1`).all();}catch{missingTables.push(table);}}database=missingTables.length===0;}catch{}
 let operations={queuedJobs:0,failedJobs:0,failedProviderEvents:0};
 if(database){try{const db=e.DB as D1Database;const [q,f,p]=await db.batch([db.prepare("SELECT count(*) AS n FROM jobs WHERE status IN ('queued','running')"),db.prepare("SELECT count(*) AS n FROM jobs WHERE status='failed'"),db.prepare("SELECT count(*) AS n FROM provider_events WHERE status='failed'")]);const count=(result:{results?:unknown[]})=>Number((result.results?.[0] as Record<string,unknown>|undefined)?.n||0);operations={queuedJobs:count(q),failedJobs:count(f),failedProviderEvents:count(p)};}catch{/* tolerate partially migrated reliability tables */}}
 const configuration={twilio:Boolean(e.TWILIO_ACCOUNT_SID&&e.TWILIO_AUTH_TOKEN&&e.TWILIO_PHONE_NUMBER),ai:Boolean(e.OPENAI_API_KEY),aiBackup:Boolean(e.AI_BACKUP_API_KEY&&e.AI_BACKUP_BASE_URL),publicUrl:Boolean(e.PUBLIC_BASE_URL),billing:Boolean(e.STRIPE_SECRET_KEY&&e.STRIPE_PRICE_ID&&e.STRIPE_WEBHOOK_SECRET)};
 const backup={lastVerifiedAt:typeof e.BACKUP_VERIFIED_AT==='string'?e.BACKUP_VERIFIED_AT:'',restoreTestedAt:typeof e.BACKUP_RESTORE_TESTED_AT==='string'?e.BACKUP_RESTORE_TESTED_AT:''};
 const configurationWarnings=[...Object.entries(configuration).filter(([,configured])=>!configured).map(([provider])=>`${provider} is not configured`),'provider verification and end-to-end delivery have not been completed',...(backup.lastVerifiedAt?[]:['backup verification timestamp is not configured']),...(backup.restoreTestedAt?[]:['backup restore drill is not configured'])];
 const configurationReady=database&&configuration.twilio&&configuration.ai&&configuration.publicUrl;
 const providerVerification='not_run';
 const readyForPilot=false;
 const pilotWarnings=[...Object.entries(configuration).filter(([,configured])=>!configured && configured!==configuration.aiBackup).map(([provider])=>({id:`config:${provider}`,severity:'high',status:'warning',label:`${provider} configuration`,nextAction:`Configure the ${provider} production settings before onboarding customers.`})),...(operations.failedJobs||operations.failedProviderEvents?[{id:'operations:failed-work',severity:'warning',status:'attention',label:`Retry queue needs attention (${operations.failedJobs} failed jobs, ${operations.failedProviderEvents} failed provider events)`,nextAction:'Review failed operations, verify provider delivery, and retry only after the cause is understood.'}]:[])];
 const pilotBlockers=[
  ...missingTables.map(table=>({id:`schema:${table}`,severity:'critical',status:'blocked',label:`Database table ${table}`,nextAction:'Apply the pending database migration and re-run the health check.'})),
  {id:'providers:end-to-end',severity:'critical',status:'unverified',label:'Provider authentication and delivery',nextAction:'Run a supervised real call, SMS, booking, and billing verification.'}
 ];
 return Response.json({ok:database,readyForPilot,configurationReady,service:'relay',databaseReachable:database,missingTables,operations,backup,configuration,configurationWarnings,providerVerification,pilotWarnings,pilotBlockers,nextSafeAction:pilotBlockers[0]?.nextAction||pilotWarnings[0]?.nextAction||'Run the supervised pilot verification checklist.',note:'Configuration readiness is not pilot readiness. A real provider authentication and end-to-end delivery check must pass before routing customer traffic.'},{status:database?200:503,headers:{'Cache-Control':'no-store'}});
}

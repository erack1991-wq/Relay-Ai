import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHmac} from 'node:crypto';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';

test('Signed live voice intake, booking and confirmation',async t=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-05-15',d1Databases:['DB']});t.after(()=>mf.dispose());
 const db=await mf.getD1Database('DB');
 for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 const env={DB:db,TWILIO_ACCOUNT_SID:'AC'+'a'.repeat(32),TWILIO_AUTH_TOKEN:'test-secret',TWILIO_PHONE_NUMBER:'+15550000001',PUBLIC_BASE_URL:'https://relay.test',OPENAI_API_KEY:'test-key'};
 globalThis.__voiceTest={env};
 await mkdir('.sites-runtime/tests',{recursive:true});
 const output=resolve('.sites-runtime/tests/voice.mjs');
 await build({entryPoints:['lib/voice-workflow.ts'],outfile:output,bundle:true,platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'runtime',setup(b){b.onResolve({filter:/^cloudflare:workers$/},a=>({path:a.path,namespace:'runtime'}));b.onLoad({filter:/.*/,namespace:'runtime'},()=>({contents:'export const env=globalThis.__voiceTest.env'}));}}]});
 const api=await import(pathToFileURL(output).href);
 const originalFetch=globalThis.fetch;let aiValue='Jane Smith',smsCount=0,smsFail=false,aiFail=false;
 globalThis.fetch=async(url)=>{if(String(url).startsWith('https://api.openai.com/')){if(aiFail)return Response.json({error:'unavailable'},{status:503});return Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({value:aiValue})}]}]});}if(String(url).endsWith('/Messages.json')){smsCount++;if(smsFail)throw new Error('timeout');return Response.json({sid:'SMtest',status:'queued'});}throw new Error('Unexpected external request');};t.after(()=>{globalThis.fetch=originalFetch;});
 const workspace='11111111-1111-4111-8111-111111111111';
 await db.prepare('INSERT INTO workspaces(id,owner,name,config,created) VALUES(?,?,?,?,?)').bind(workspace,'owner','Test HVAC',JSON.stringify({timezone:'America/New_York',hours:'Monday–Friday, 9 AM–5 PM'}),new Date().toISOString()).run();
 async function webhook(sid,turn,speech='',extra={}){
  const path=turn===0?`/api/voice?workspace=${workspace}`:`/api/voice/respond?turn=${turn}`;
  const url=env.PUBLIC_BASE_URL+path;
  const params=new URLSearchParams({AccountSid:env.TWILIO_ACCOUNT_SID,CallSid:sid,From:'+15550000002',To:'+15550000001',Direction:'inbound',SpeechResult:speech,...extra});
  const payload=url+[...params.keys()].sort().map(k=>k+params.get(k)).join('');
  const sig=createHmac('sha1',env.TWILIO_AUTH_TOKEN).update(payload).digest('base64');
  const r=await api.handleVoice(new Request(url,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','x-twilio-signature':sig},body:params}),turn===0);
  return {status:r.status,text:await r.text()};
 }
 const sid='CA'+'1'.repeat(32);
 await t.test('rejects unsigned forged calls before writes',async()=>{const r=await api.handleVoice(new Request('https://relay.test/api/voice',{method:'POST',body:'CallSid='+sid,headers:{'content-type':'application/x-www-form-urlencoded'}}),true);assert.equal(r.status,403);assert.equal((await db.prepare('SELECT count(*) n FROM customers').first()).n,0);});
 await t.test('saves intake and conversational fields in the workspace',async()=>{
  assert.match((await webhook(sid,0)).text,/What is your name/);
  assert.match((await webhook(sid,1,'My name is Jane Smith')).text,/What service/);
  aiValue='Furnace repair';assert.match((await webhook(sid,2,'My furnace is broken')).text,/Option 1/);
  assert.equal((await db.prepare('SELECT name FROM customers').first()).name,'Jane Smith');
  assert.equal((await db.prepare('SELECT title FROM items').first()).title,'Furnace repair');
 });
 await t.test('requires explicit booking confirmation and handles duplicate webhooks',async()=>{
  assert.match((await webhook(sid,3,'1')).text,/To confirm/);
  assert.equal((await db.prepare('SELECT count(*) n FROM bookings').first()).n,0);
  const [a,b]=await Promise.all([webhook(sid,4,'yes'),webhook(sid,4,'yes')]);
  assert.ok(a.text.includes('Your appointment is booked')||b.text.includes('Your appointment is booked'));
  assert.equal((await db.prepare('SELECT count(*) n FROM bookings').first()).n,1);
  assert.match((await webhook(sid,4,'yes')).text,/Your appointment is booked/);
  assert.equal(smsCount,0);
 });
 await t.test('sends one consented SMS and persists provider acceptance without claiming delivery',async()=>{
  const first=await webhook(sid,5,'yes');assert.match(first.text,/submitted/);
  assert.equal(smsCount,1);await webhook(sid,5,'yes');assert.equal(smsCount,1);
  assert.equal((await db.prepare("SELECT status FROM messages WHERE direction='outbound'").first()).status,'queued');
 });
 await t.test('calendar respects hours, timezone and existing reservations',async()=>{
  const slots=await api.availableSlots(db,workspace,'America/New_York','Monday–Friday, 9 AM–5 PM',Date.parse('2030-01-05T12:00:00Z'));
  assert.equal(slots[0],'2030-01-07T14:00:00.000Z');
  assert.deepEqual(await api.availableSlots(db,workspace,'America/New_York','unconfigured'),[]);
  const booked=(await db.prepare('SELECT start FROM bookings').first()).start;
  assert.ok(!(await api.availableSlots(db,workspace,'America/New_York','Monday–Friday, 9 AM–5 PM')).includes(booked));
 });
 async function prepareCall(char,phone){const id='CA'+char.repeat(32);const extra={From:phone};aiValue='Test Caller';await webhook(id,0,'',extra);await webhook(id,1,'Test Caller',extra);aiValue='AC repair';await webhook(id,2,'AC repair',extra);await webhook(id,3,'1',extra);return {id,extra};}
 await t.test('concurrent reservation causes a fresh offer, never a false confirmation',async()=>{
  const {id,extra}=await prepareCall('2','+15550000003');const row=await db.prepare('SELECT state FROM voice_calls WHERE id=?').bind(id).first();const state=JSON.parse(row.state);
  await db.prepare('INSERT INTO bookings(id,workspace,customer,title,start,created) VALUES(?,?,?,?,?,?)').bind('competing-booking',workspace,state.customer,'Other booking',state.selected,new Date().toISOString()).run();
  assert.match((await webhook(id,4,'yes',extra)).text,/just taken/);
  assert.equal(await db.prepare('SELECT id FROM bookings WHERE id=?').bind(id).first(),null);
 });
 await t.test('SMS failure keeps booking and is visible for follow-up',async()=>{
  const {id,extra}=await prepareCall('3','+15550000004');await webhook(id,4,'yes',extra);smsFail=true;
  assert.match((await webhook(id,5,'yes',extra)).text,/could not verify/);
  assert.ok(await db.prepare('SELECT id FROM bookings WHERE id=?').bind(id).first());
  assert.match((await db.prepare('SELECT error FROM voice_calls WHERE id=?').bind(id).first()).error,/text failed/);smsFail=false;
 });
 await t.test('declining SMS never sends a message',async()=>{
  const {id,extra}=await prepareCall('5','+15550000005');await webhook(id,4,'yes',extra);const before=smsCount;
  assert.match((await webhook(id,5,'no',extra)).text,/No text will be sent/);assert.equal(smsCount,before);
 });
 await t.test('previous opt-out overrides new voice SMS consent',async()=>{
  const {id,extra}=await prepareCall('6','+15550000006');await webhook(id,4,'yes',extra);
  await db.prepare('UPDATE customers SET opted_out=1 WHERE phone=?').bind('+15550000006').run();const before=smsCount;
  assert.match((await webhook(id,5,'yes',extra)).text,/Texts are disabled/);assert.equal(smsCount,before);
 });
 await t.test('AI outage saves lead and reports failure without inventing a booking',async()=>{
  const id='CA'+'4'.repeat(32);await webhook(id,0);aiFail=true;
  assert.match((await webhook(id,1,'My name is Sam')).text,/cannot complete/);
  assert.equal((await db.prepare('SELECT status FROM voice_calls WHERE id=?').bind(id).first()).status,'needs-attention');
  assert.equal(await db.prepare('SELECT id FROM bookings WHERE id=?').bind(id).first(),null);aiFail=false;
 });
});

import { env } from 'cloudflare:workers';
export const dynamic='force-dynamic';
const xml=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const twiml=(body:string)=>new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`,{headers:{'Content-Type':'text/xml'}});
export async function POST(request:Request){const bindings=env as unknown as Record<string, unknown>;const base=String(bindings.PUBLIC_BASE_URL||new URL(request.url).origin);const greeting=String(bindings.RELAY_GREETING||'Thanks for calling. I’m Relay, the AI receptionist. What service do you need today?');return twiml(`<Gather input="speech" language="en-US" speechTimeout="auto" action="${xml(base.replace(/\/$/,'')+'/api/voice/respond')}" method="POST"><Say>${xml(greeting)}</Say></Gather><Say>I didn&apos;t hear anything. Goodbye.</Say>`);}

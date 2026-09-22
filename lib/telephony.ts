import { env } from 'cloudflare:workers';
export const bindings = () => env as unknown as Record<string, string>;
export const escapeXml = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export function publicUrl(path: string) {
  const base = bindings().PUBLIC_BASE_URL;
  if (!base || new URL(base).protocol !== 'https:') throw new Error('A public HTTPS URL is required.');
  return base.replace(/\/$/, '') + path;
}
export function xmlResponse(body: string, status = 200) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/xml', 'Cache-Control': 'no-store' } });
}
export function say(text: string) { return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${escapeXml(text)}</Say><Hangup/></Response>`; }
export function gather(text: string, turn: number) {
  const action = escapeXml(publicUrl(`/api/voice/respond?turn=${turn}`));
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Gather input="speech dtmf" numDigits="1" speechTimeout="auto" timeout="8" actionOnEmptyResult="true" action="${action}" method="POST"><Say>${escapeXml(text)}</Say></Gather></Response>`;
}
export async function verifiedForm(request: Request) {
  if (!request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) throw new Error('Invalid webhook');
  const body = await request.text();
  if (body.length > 20000) throw new Error('Invalid webhook');
  const form = new URLSearchParams(body);
  const token = bindings().TWILIO_AUTH_TOKEN;
  const signature = request.headers.get('x-twilio-signature') || '';
  if (!token || !signature || form.get('AccountSid') !== bindings().TWILIO_ACCOUNT_SID) throw new Error('Invalid webhook');
  const url = new URL(request.url);
  let payload = publicUrl(url.pathname + url.search);
  for (const key of [...new Set(form.keys())].sort()) for (const value of [...new Set(form.getAll(key))].sort()) payload += key + value;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(token), { name: 'HMAC', hash: 'SHA-1' }, false, ['verify']);
  let sig: Uint8Array<ArrayBuffer>;
  try { sig = Uint8Array.from(atob(signature), c => c.charCodeAt(0)); } catch { throw new Error('Invalid webhook'); }
  if (!await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(payload))) throw new Error('Invalid webhook');
  return form;
}
export async function twilio(path: string, form?: URLSearchParams) {
  const e = bindings();
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${e.TWILIO_ACCOUNT_SID}/${path}`, {
    method: form ? 'POST' : 'GET', signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Basic ${btoa(`${e.TWILIO_ACCOUNT_SID}:${e.TWILIO_AUTH_TOKEN}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form,
  });
  const j = await r.json() as { sid?: string; status?: string; message?: string; code?: number };
  if (!r.ok) throw new Error(`Twilio ${j.code || r.status}: ${j.message || 'request failed'}`);
  return j;
}

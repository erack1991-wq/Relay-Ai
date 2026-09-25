import { bindings } from '@/lib/telephony';
export const dynamic='force-dynamic';

async function validSignature(request: Request, raw: string) {
  const secret = bindings().META_APP_SECRET;
  if (!secret) return false;
  const header = request.headers.get('x-hub-signature-256') || '';
  if (!header.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  const expected = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return header.slice(7) === expected;
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  if (query.get('hub.verify_token') !== bindings().META_VERIFY_TOKEN) {
    console.warn('Messenger webhook verification rejected: verify token mismatch.');
    return new Response('Forbidden', { status: 403 });
  }
  console.log('Messenger webhook verification succeeded.');
  return new Response(query.get('hub.challenge') || '', { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!(await validSignature(request, raw))) {
    console.warn('Messenger webhook rejected: invalid or missing signature.');
    return new Response('Forbidden', { status: 403 });
  }
  try {
    const body = JSON.parse(raw) as { object?: string; entry?: unknown[] };
    if (body.object !== 'page') {
      console.warn(`Messenger webhook ignored: unsupported object ${String(body.object || 'missing')}.`);
      return new Response('Ignored', { status: 200 });
    }
    console.log(`Relay Messenger webhook received ${body.entry?.length || 0} page event(s).`);
    return new Response('EVENT_RECEIVED', { status: 200 });
  } catch {
    console.warn('Messenger webhook rejected: invalid JSON.');
    return new Response('Invalid JSON', { status: 400 });
  }
}

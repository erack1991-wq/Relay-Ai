import { bindings } from '@/lib/telephony';
export const dynamic='force-dynamic';
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
  return new Response(null, { status: 204 });
}

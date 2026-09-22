import { bindings } from '@/lib/telephony';

export async function stripeRequest(path: string, form: URLSearchParams) {
  const key = bindings().STRIPE_SECRET_KEY;
  if (!key) throw new Error('Stripe billing is not configured.');
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.json() as { id?: string; url?: string; error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message || `Stripe request failed (${response.status}).`);
  return body;
}

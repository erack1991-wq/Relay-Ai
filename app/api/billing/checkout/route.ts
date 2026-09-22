import { getChatGPTUser } from '@/app/chatgpt-auth';
import { stripeRequest } from '@/lib/stripe';
import { bindings, publicUrl } from '@/lib/telephony';
export const dynamic='force-dynamic';
export async function POST() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in required.' }, { status: 401 });
  const price = bindings().STRIPE_PRICE_ID;
  if (!price) return Response.json({ error: 'Stripe billing is not configured.' }, { status: 503 });
  const form = new URLSearchParams({ mode: 'subscription', 'line_items[0][price]': price, 'line_items[0][quantity]': '1', success_url: publicUrl('/?billing=success'), cancel_url: publicUrl('/?billing=cancelled'), 'metadata[owner]': user.userId });
  try { const session = await stripeRequest('checkout/sessions', form); return Response.json({ url: session.url }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Stripe checkout failed.' }, { status: 502 }); }
}

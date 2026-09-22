import { env } from 'cloudflare:workers';
export const dynamic='force-dynamic';
export async function GET(){const e=env as unknown as Record<string, unknown>;return Response.json({ok:Boolean(e.DB),service:'relay',checks:{database:Boolean(e.DB),twilio:Boolean(e.TWILIO_ACCOUNT_SID&&e.TWILIO_AUTH_TOKEN&&e.TWILIO_PHONE_NUMBER&&e.PUBLIC_BASE_URL),ai:Boolean(e.OPENAI_API_KEY),voiceWebhook:Boolean(e.PUBLIC_BASE_URL)}},{headers:{'Cache-Control':'no-store'}});}

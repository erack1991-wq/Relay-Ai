import { env } from 'cloudflare:workers';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const config = () => env as unknown as Record<string, string | undefined>;

function required(name: string): string {
  const value = config()[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

async function keyMaterial(): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(required('GOOGLE_TOKEN_ENCRYPTION_KEY')), c => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY must be 32 bytes, base64 encoded');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptGoogleToken(value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyMaterial(), encoder.encode(value)));
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv); combined.set(ciphertext, iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptGoogleToken(value: string): Promise<string> {
  const combined = Uint8Array.from(atob(value), c => c.charCodeAt(0));
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: combined.slice(0, 12) }, await keyMaterial(), combined.slice(12));
  return decoder.decode(plaintext);
}

export function googleOAuthUrl(state: string): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', required('GOOGLE_CLIENT_ID'));
  url.searchParams.set('redirect_uri', required('GOOGLE_REDIRECT_URI'));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/calendar.events');
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeGoogleCode(code: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: required('GOOGLE_CLIENT_ID'), client_secret: required('GOOGLE_CLIENT_SECRET'), redirect_uri: required('GOOGLE_REDIRECT_URI'), grant_type: 'authorization_code' }) });
  const body = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
  if (!response.ok || !body.access_token) throw new Error(body.error || 'Google authorization failed');
  return body;
}

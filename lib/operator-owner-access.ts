import { env } from 'cloudflare:workers';

type OwnerAccess = { ok: true } | { ok: false; status: 403 | 503; error: string };

export function operatorOwnerAccess(email: string): OwnerAccess {
  const values = env as unknown as Record<string, unknown>;
  const allowed = typeof values.OWNER_AI_ALLOWED_EMAILS === 'string'
    ? values.OWNER_AI_ALLOWED_EMAILS.split(',').map(value => value.trim().toLowerCase()).filter(Boolean)
    : [];
  if (!allowed.length) return { ok: false, status: 503, error: 'Owner tools are disabled until OWNER_AI_ALLOWED_EMAILS is configured.' };
  if (!allowed.includes(email.trim().toLowerCase())) return { ok: false, status: 403, error: 'This area is restricted to configured Relay owners.' };
  return { ok: true };
}

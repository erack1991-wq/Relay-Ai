import { getChatGPTUser } from '@/app/chatgpt-auth';
import { bindings } from '@/lib/telephony';

export async function getOperatorUser() {
  const user = await getChatGPTUser();
  if (!user) return { user: null, status: 401, error: 'Authentication required.' } as const;

  const ownerEmail = bindings().RELAY_OWNER_EMAIL?.trim().toLowerCase();
  if (!ownerEmail) return { user: null, status: 503, error: 'Operator owner is not configured.' } as const;
  if (user.email.trim().toLowerCase() !== ownerEmail) {
    return { user: null, status: 403, error: 'Owner access required.' } as const;
  }

  return { user, status: 200, error: null } as const;
}

import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { operatorOwnerAccess } from '@/lib/operator-owner-access';
import OwnerCommandCenter from './owner-command-center';

export const dynamic = 'force-dynamic';

export default async function OwnerCommandPage() {
  const user = await requireChatGPTUser('/operator/command');
  const access = operatorOwnerAccess(user.email);
  if (!access.ok) return <main style={{ padding: 40 }}><h1>Owner access required</h1><p>{access.error}</p></main>;
  return <OwnerCommandCenter />;
}

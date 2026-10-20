import { getChatGPTUser } from '@/app/chatgpt-auth';
import { operatorTools } from '@/lib/operator-tools';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Authentication required.' }, { status: 401 });
  return Response.json({ tools: operatorTools }, { headers: { 'Cache-Control': 'no-store' } });
}

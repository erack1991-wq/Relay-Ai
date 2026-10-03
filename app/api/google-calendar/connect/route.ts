import { chatGPTSignInPath, getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/db/database';
import { googleOAuthUrl } from '@/lib/google-calendar';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) {
    const url = new URL(request.url);
    const returnTo = `${url.pathname}${url.search}`;
    return Response.redirect(new URL(chatGPTSignInPath(returnTo), url.origin), 302);
  }
  const workspace = new URL(request.url).searchParams.get('workspace');
  if (!workspace) return new Response('Workspace required', { status: 400 });
  const owned = await database().prepare('SELECT id FROM workspaces WHERE id=? AND owner=?').bind(workspace, user.userId).first();
  if (!owned) return new Response('Not found', { status: 404 });
  const state = `${crypto.randomUUID()}.${btoa(JSON.stringify({ workspace, owner: user.userId, exp: Date.now() + 10 * 60 * 1000 }))}`;
  const response = new Response(null, {
    status: 302,
    headers: { Location: googleOAuthUrl(state) },
  });
  response.headers.append('Set-Cookie', `relay_google_oauth_state=${encodeURIComponent(state)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  return response;
}

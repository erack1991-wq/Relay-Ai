import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/db/database';
import { exchangeGoogleCode, encryptGoogleToken } from '@/lib/google-calendar';

export const dynamic = 'force-dynamic';

function cookie(request: Request, name: string) { return request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`))?.slice(name.length + 1); }

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  const url = new URL(request.url);
  const rawState = url.searchParams.get('state');
  const storedState = cookie(request, 'relay_google_oauth_state');
  if (!user || !rawState || !storedState || rawState !== decodeURIComponent(storedState)) return new Response('Invalid authorization state', { status: 400 });
  let state: { workspace: string; owner: string; exp: number };
  try { state = JSON.parse(atob(rawState.split('.')[1])); } catch { return new Response('Invalid authorization state', { status: 400 }); }
  if (state.owner !== user.userId || state.exp < Date.now()) return new Response('Authorization expired', { status: 400 });
  const code = url.searchParams.get('code');
  if (!code) return new Response(`Google authorization was not completed: ${url.searchParams.get('error') || 'unknown error'}`, { status: 400 });
  try {
    const token = await exchangeGoogleCode(code);
    const db = database();
    const refresh = token.refresh_token ? await encryptGoogleToken(token.refresh_token) : null;
    const access = await encryptGoogleToken(token.access_token!);
    await db.prepare(`CREATE TABLE IF NOT EXISTS google_calendar_connections (workspace TEXT PRIMARY KEY, owner TEXT NOT NULL, refresh_token TEXT, access_token TEXT NOT NULL, access_expires_at TEXT NOT NULL, calendar_id TEXT NOT NULL DEFAULT 'primary', created TEXT NOT NULL, updated TEXT NOT NULL)`).run();
    const now = new Date().toISOString();
    await db.prepare(`INSERT INTO google_calendar_connections (workspace,owner,refresh_token,access_token,access_expires_at,calendar_id,created,updated) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(workspace) DO UPDATE SET owner=excluded.owner,refresh_token=COALESCE(excluded.refresh_token,google_calendar_connections.refresh_token),access_token=excluded.access_token,access_expires_at=excluded.access_expires_at,updated=excluded.updated`).bind(state.workspace, user.userId, refresh, access, new Date(Date.now() + (token.expires_in || 3600) * 1000).toISOString(), 'primary', now, now).run();
    return new Response(null, {
      status: 302,
      headers: {
        Location: new URL('/', url.origin).toString(),
        'Set-Cookie': 'relay_google_oauth_state=; Path=/; Max-Age=0',
      },
    });
  } catch (error) { return new Response((error as Error).message, { status: 502 }); }
}

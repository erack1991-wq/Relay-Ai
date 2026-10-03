import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/db/database';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { const user = await getChatGPTUser(); if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 }); const body = await request.json() as { workspace?: string }; if (!body.workspace) return Response.json({ error: 'Workspace required' }, { status: 400 }); await database().prepare('DELETE FROM google_calendar_connections WHERE workspace=? AND owner=?').bind(body.workspace,user.userId).run(); return Response.json({ disconnected: true }); }

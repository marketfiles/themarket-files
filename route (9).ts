import { monthDocs, saveMonth, cleanEvent, sql } from '@/lib/db';
import { isEditor, sameOrigin } from '@/lib/auth';
import type { TMEvent } from '@/lib/content';
export const dynamic = 'force-dynamic';

const monthOf = (id: string) => { const m = /^m(0[1-9]|1[0-2])$/.exec(id); return m ? +m[1] : 0; };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!monthOf(id)) return Response.json({ data: null }, { status: 404 });
  const doc = (await monthDocs()).find((d) => d.id === id);
  return Response.json({ data: doc?.data ?? { month: monthOf(id), events: [] } }, { headers: { 'cache-control': 'no-store' } });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const month = monthOf(id);
  if (!month) return Response.json({ error: 'Unknown month' }, { status: 404 });
  if (!(await isEditor()) || !(await sameOrigin())) return Response.json({ error: 'Editor sign-in required' }, { status: 401 });
  if (!sql) return Response.json({ error: 'Database is not configured' }, { status: 503 });
  let body: { events?: unknown[] };
  try { body = await req.json(); } catch { return Response.json({ error: 'Bad request' }, { status: 400 }); }
  if (!Array.isArray(body.events) || body.events.length > 2000) return Response.json({ error: 'Bad request' }, { status: 400 });
  const events = body.events.map(cleanEvent).filter(Boolean) as TMEvent[];
  if (events.length !== body.events.length) return Response.json({ error: 'One or more events are invalid' }, { status: 422 });
  await saveMonth(month, events);
  return Response.json({ ok: true, count: events.length });
}

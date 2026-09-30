import postgres from 'postgres';
import { SEED_EVENTS, type TMEvent, DESKS } from './content';

const url = process.env.DATABASE_URL;
// One pooled client per server instance. `prepare: false` keeps it compatible with PgBouncer/Supabase pooling.
const g = globalThis as unknown as { __mfSql?: ReturnType<typeof postgres> };
export const sql = url ? (g.__mfSql ??= postgres(url, { max: 5, prepare: false, idle_timeout: 20 })) : null;

const STATUSES = ['verified', 'review', 'pending'] as const;
const isDesk = (d: unknown): d is TMEvent['desk'] => typeof d === 'string' && d !== 'hub' && d in DESKS;

/** Validate and normalize an event coming from the editor. Returns null when invalid. */
export function cleanEvent(raw: unknown): TMEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const date = str(e.date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const head = str(e.head, 240);
  if (!head || !isDesk(e.desk)) return null;
  const status = STATUSES.includes(e.status as (typeof STATUSES)[number]) ? (e.status as TMEvent['status']) : 'review';
  const urlStr = str(e.url, 500);
  return {
    id: str(e.id, 80) || `e${date.replace(/-/g, '')}-${Date.now().toString(36)}`,
    date, desk: e.desk, head, status,
    summary: str(e.summary, 2000), source: str(e.source, 200), doc: str(e.doc, 300),
    url: /^https?:\/\//.test(urlStr) ? urlStr : '', link: str(e.link, 80), updatedAt: new Date().toISOString(),
  };
}

export async function listEvents(): Promise<TMEvent[]> {
  if (!sql) return SEED_EVENTS;
  const rows = await sql<TMEvent[]>`select id, date, desk, head, status, summary, source, doc, url, link, updated_at as "updatedAt" from tm_events order by date`;
  return rows.length ? rows : SEED_EVENTS;
}

/** The experience reads the inventory as 12 month documents: tm/m01 … tm/m12. */
export async function monthDocs() {
  const events = await listEvents();
  const byMonth = new Map<number, TMEvent[]>();
  for (const e of events) { const m = +e.date.slice(5, 7); byMonth.set(m, [...(byMonth.get(m) || []), e]); }
  return [...byMonth.entries()].sort((a, b) => a[0] - b[0]).map(([m, list]) => ({ id: `m${String(m).padStart(2, '0')}`, data: { month: m, events: list } }));
}

/** Replace one month's events (the editor writes a whole month at a time). */
export async function saveMonth(month: number, events: TMEvent[]) {
  if (!sql) throw new Error('DATABASE_URL is not configured');
  const clean = events.filter((e) => +e.date.slice(5, 7) === month);
  await sql.begin(async (tx) => {
    const ids = clean.map((e) => e.id);
    if (ids.length) await tx`delete from tm_events where month = ${month} and id not in ${tx(ids)}`;
    else await tx`delete from tm_events where month = ${month}`;
    for (const e of clean) {
      await tx`insert into tm_events (id, date, month, desk, head, status, summary, source, doc, url, link, updated_at)
        values (${e.id}, ${e.date}, ${month}, ${e.desk}, ${e.head}, ${e.status}, ${e.summary || ''}, ${e.source || ''}, ${e.doc || ''}, ${e.url || ''}, ${e.link || ''}, now())
        on conflict (id) do update set date = excluded.date, month = excluded.month, desk = excluded.desk, head = excluded.head, status = excluded.status,
          summary = excluded.summary, source = excluded.source, doc = excluded.doc, url = excluded.url, link = excluded.link, updated_at = now()`;
    }
  });
}

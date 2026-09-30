import articlesJson from '@/content/articles.json';
import eventsJson from '@/content/events.json';
import desksJson from '@/content/desks.json';

export type DeskKey = 'hub' | 'wallst' | 'then' | 'global' | 'btc' | 'chain';
export type Status = 'verified' | 'review' | 'pending' | 'sample';
export interface SourceRecord { claim: string; source: string; doc: string; date: string; evidence: string; conf: string; rights: string }
export interface Article {
  slug: string; file: string; desk: DeskKey; cat: string; date: string; prec: 'y' | null; loc: string;
  head: string; deck: string; status: Status; research: boolean; body: [string, string][];
  keyDates: [string, string][]; inst: string[]; people: string[]; assets: string[]; countries: string[];
  crisis: string; sources: SourceRecord[]; img: { status: string; note: string }; alt: string; plate: string;
}
export interface TMEvent {
  id: string; date: string; desk: Exclude<DeskKey, 'hub'>; head: string; status: Exclude<Status, 'sample'>;
  summary?: string; source?: string; doc?: string; url?: string; link?: string; updatedAt?: string;
}
export interface Desk { name: string; handle: string; hex: string; route?: string; blurb?: string }

export const ARTICLES = articlesJson as Article[];
export const SEED_EVENTS = eventsJson as TMEvent[];
export const DESKS = desksJson as Record<DeskKey, Desk>;
export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export const articleBySlug = (slug: string) => ARTICLES.find((a) => a.slug === slug);
export const siteUrl = () => (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

export function parseISO(iso: string) {
  const m = /^(\d{1,4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const t = new Date(Date.UTC(2000, mo - 1, d)); t.setUTCFullYear(y);
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return { y, m: mo, d, weekday: WEEKDAYS[t.getUTCDay()], time: t.getTime() };
}
export const fmtDate = (iso: string, prec?: string | null) => {
  const p = parseISO(iso); if (!p) return iso; return prec === 'y' ? String(p.y) : `${MONTHS[p.m - 1]} ${p.d}, ${p.y}`;
};
export const isoOf = (y: number, m: number, d: number) => `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Simple keyword search over files + events (used by Market Files AI tools). */
export function searchContent(query: string, events: TMEvent[], limit = 8) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const hits: { id: string; title: string; date: string; desk: string; status: string; summary: string; url: string; score: number }[] = [];
  for (const a of ARTICLES) {
    const hay = [a.head, a.deck, a.loc, a.cat, a.date, a.crisis, ...a.inst, ...a.people, ...a.assets, ...a.countries, ...a.body.map((b) => b[1])].join(' ').toLowerCase();
    const matched = terms.filter((t) => hay.includes(t)).length;
    if (matched === terms.length || matched >= Math.max(2, terms.length - 1))
      hits.push({ id: a.file, title: a.head, date: a.date, desk: DESKS[a.desk].name, status: a.status, summary: [a.deck, ...a.body.map((b) => `${b[0]}: ${b[1]}`)].join(' ').slice(0, 900), url: `/files/${a.slug}`, score: matched * 2 + (terms.some((t) => a.head.toLowerCase().includes(t)) ? 3 : 0) });
  }
  for (const e of events) {
    const hay = `${e.head} ${e.summary || ''} ${e.date}`.toLowerCase();
    const matched = terms.filter((t) => hay.includes(t)).length;
    if (matched === terms.length) hits.push({ id: `day:${e.date}`, title: e.head, date: e.date, desk: DESKS[e.desk]?.name || '', status: e.status, summary: (e.summary || '').slice(0, 500), url: `/day/${e.date}`, score: matched });
  }
  return hits.sort((x, y) => y.score - x.score).slice(0, limit).map(({ score, ...h }) => h);
}

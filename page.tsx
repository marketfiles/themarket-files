import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ARTICLES, DESKS, MONTHS, parseISO, isoOf } from '@/lib/content';
import { listEvents } from '@/lib/db';
import { SiteHeader, SiteFooter } from '@/components/SiteChrome';

type P = { params: Promise<{ date: string }> };
export const revalidate = 300;

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const p = parseISO((await params).date);
  if (!p) return {};
  const t = `${MONTHS[p.m - 1]} ${p.d}, ${p.y} in market history`;
  return { title: t, description: `What happened in markets and finance on ${p.weekday}, ${MONTHS[p.m - 1]} ${p.d}, ${p.y}.`, alternates: { canonical: `/day/${(await params).date}` } };
}

export default async function DayPage({ params }: P) {
  const iso = (await params).date;
  const p = parseISO(iso);
  if (!p) return notFound();
  const events = await listEvents();
  const all = [
    ...ARTICLES.filter((a) => a.prec !== 'y').map((a) => ({ date: a.date, head: a.head, desk: a.desk, href: `/files/${a.slug}`, status: a.status })),
    ...events.map((e) => ({ date: e.date, head: e.head, desk: e.desk, href: e.link ? `/files/${e.link}` : `/day/${e.date}`, status: e.status, summary: e.summary, source: e.source })),
  ];
  const exact = all.filter((e) => e.date === iso);
  const md = iso.slice(5);
  const others = all.filter((e) => e.date.slice(5) === md && e.date !== iso).sort((a, b) => a.date.localeCompare(b.date));
  const prev = new Date(p.time - 864e5), next = new Date(p.time + 864e5);
  const iso2 = (t: Date) => isoOf(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  const Row = ({ e }: { e: (typeof all)[number] }) => (
    <a className="ev" href={e.href}><span className="ev-y">{e.date.slice(0, 4)}</span><div><h3>{e.head}</h3><div className="meta"><span className="dk" style={{ ['--dc' as string]: DESKS[e.desk].hex }}>{DESKS[e.desk].name}</span></div></div><span className={`stamp ${e.status}`}>{e.status === 'review' ? 'In review' : e.status}</span></a>
  );
  return (<>
    <SiteHeader />
    <main id="main" className="wrap">
      <header className="ph serif day-h"><p className="mono dim">DAY FILE · {iso}</p><h1 className="holo">{p.weekday}, {MONTHS[p.m - 1]} {p.d}, {p.y}</h1>
        <div className="day-nav"><a className="btn" href={`/day/${iso2(prev)}`}>← Previous day</a><a className="btn" href={`/day/${iso2(next)}`}>Next day →</a><a className="btn btn-p" href={`/#/day/${iso}`}>Open in the Time Machine</a><a className="btn" href={`/#/search?q=${encodeURIComponent(`What happened in financial markets on ${MONTHS[p.m - 1]} ${p.d}, ${p.y}?`)}&ai=1`}>✦ Research this day</a></div></header>
      <section className="dsec"><h2>On this exact day</h2>{exact.length ? <div className="otd-res">{exact.map((e, i) => <Row key={i} e={e} />)}</div> : <div className="empty" style={{ textAlign: 'left' }}><b>Nothing filed for this day yet.</b>Ask Market Files AI, or explore the same date in other years below.</div>}</section>
      <section className="dsec"><h2>{MONTHS[p.m - 1]} {p.d} in other years</h2>{others.length ? <div className="otd-res">{others.map((e, i) => <Row key={i} e={e} />)}</div> : <p className="dim">No other years filed yet.</p>}</section>
    </main><SiteFooter /></>);
}

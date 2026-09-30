import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ARTICLES, DESKS, articleBySlug, fmtDate, siteUrl } from '@/lib/content';
import { SiteHeader, SiteFooter } from '@/components/SiteChrome';

type P = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return ARTICLES.map((a) => ({ slug: a.slug })); }

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const a = articleBySlug((await params).slug);
  if (!a) return {};
  return {
    title: a.head, description: a.deck, alternates: { canonical: `/files/${a.slug}` },
    openGraph: { type: 'article', title: a.head, description: a.deck, url: `/files/${a.slug}`, section: DESKS[a.desk].name },
    twitter: { card: 'summary_large_image', title: a.head, description: a.deck, site: `@${DESKS[a.desk].handle}` },
  };
}

export default async function FilePage({ params }: P) {
  const a = articleBySlug((await params).slug);
  if (!a) return notFound();
  const d = DESKS[a.desk];
  const ld = {
    '@context': 'https://schema.org', '@type': 'Article', headline: a.head, description: a.deck, articleSection: d.name,
    author: { '@type': 'Organization', name: 'Market Files' }, publisher: { '@id': `${siteUrl()}/#org` }, mainEntityOfPage: `${siteUrl()}/files/${a.slug}`,
    about: { '@type': 'Event', name: a.head, startDate: a.prec === 'y' ? a.date.slice(0, 4) : a.date, location: { '@type': 'Place', name: a.loc } },
  };
  const related = ARTICLES.filter((x) => x.slug !== a.slug && (x.desk === a.desk || (a.crisis && x.crisis === a.crisis))).slice(0, 4);
  return (
    <>
      <SiteHeader />
      <main id="main" style={{ ['--dc' as string]: d.hex }}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
        <article className="wrap">
          <header className="art-h t-hist">
            <div className="hero-k"><span className="chip solid">{a.cat}</span><span className="chip">FILE {a.file}</span><span className={`stamp ${a.status}`}>{a.status === 'review' ? 'In review' : a.status}</span></div>
            <p className="dateline">{a.loc.toUpperCase()} — {fmtDate(a.date, a.prec).toUpperCase()}</p>
            <h1>{a.head}</h1>
            <p className="deck">{a.deck}</p>
            <div className="byline"><span>By <b>Market Files</b></span><span>Desk <a className="handle" href={`https://x.com/${d.handle}`}>@{d.handle}</a></span></div>
            <div className="share"><a className="btn btn-p" href={`/#/file/${a.slug}`}>Open the interactive file →</a><a className="btn" href={`/#/search?q=${encodeURIComponent(a.head)}&ai=1`}>✦ Research this</a></div>
          </header>
          <div className="art-grid">
            <div>
              <div className="body">{a.body.map(([h, p]) => (<section key={h}><h2>{h}</h2><p>{p}</p></section>))}</div>
              {a.sources.length > 0 && (
                <section className="srec" aria-labelledby="sr-h">
                  <div className="srec-h"><h2 id="sr-h">SOURCE RECORD</h2><span>{a.sources.length} claims</span></div>
                  <div className="tscroll"><table><thead><tr><th>Claim</th><th>Source</th><th>Publication / document</th><th>Date</th><th>Evidence</th><th>Confidence</th><th>Asset rights</th></tr></thead>
                    <tbody>{a.sources.map((s, i) => (<tr key={i}><td>{s.claim}</td><td data-l="Source">{s.source}</td><td data-l="Document">{s.doc}</td><td data-l="Date" className="mono">{s.date}</td><td data-l="Evidence">{s.evidence}</td><td data-l="Confidence"><span className={`conf ${s.conf}`}>{s.conf}</span></td><td data-l="Rights">{s.rights}</td></tr>))}</tbody></table></div>
                </section>
              )}
            </div>
            <aside className="rail" aria-label="File details">
              {a.keyDates.length > 0 && <div className="rbox"><h3>Key dates</h3><ul>{a.keyDates.map(([dt, t]) => <li key={dt + t}><span className="d">{dt}</span><span>{/^\d{4}-\d\d-\d\d$/.test(dt) ? <a href={`/day/${dt}`}>{t}</a> : t}</span></li>)}</ul></div>}
              <div className="rbox"><h3>Image status</h3><div className="imgstat"><b>{a.img.status}</b>{a.img.note}</div></div>
              {related.length > 0 && <div className="rbox"><h3>Related files</h3><ul>{related.map((r) => <li key={r.slug}><span className="d">{r.date.slice(0, 4)}</span><a href={`/files/${r.slug}`}>{r.head}</a></li>)}</ul></div>}
            </aside>
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}

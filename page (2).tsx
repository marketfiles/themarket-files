import type { Metadata } from 'next';
import { ARTICLES, DESKS, fmtDate } from '@/lib/content';
import { SiteHeader, SiteFooter } from '@/components/SiteChrome';
export const metadata: Metadata = { title: 'The Market Files Blog', description: 'Stories, explainers and financial history from every Market Files desk.', alternates: { canonical: '/blog' } };
export default function Blog() {
  const posts = [...ARTICLES].sort((a, b) => Number(b.research) - Number(a.research) || b.date.localeCompare(a.date));
  return (<>
    <SiteHeader />
    <main id="main" className="wrap"><header className="ph serif"><p className="mono dim">THE MARKET FILES BLOG</p><h1 className="holo">From the desks</h1><p>Live market stories, explainers and financial history from every Market Files desk.</p><div className="share"><a className="btn btn-p" href="/#/blog">Open the interactive blog</a></div></header>
      <div className="deep" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>{posts.map((a) => (
        <a key={a.slug} href={`/files/${a.slug}`} style={{ ['--dc' as string]: DESKS[a.desk].hex }}><span className="n">{DESKS[a.desk].name.toUpperCase()} · {fmtDate(a.date, a.prec)}</span><h3>{a.head}</h3><p>{a.deck}</p></a>))}</div>
    </main><SiteFooter /></>);
}

import type { Metadata } from 'next';
import { ARTICLES, DESKS, fmtDate } from '@/lib/content';
import { SiteHeader, SiteFooter } from '@/components/SiteChrome';
export const metadata: Metadata = { title: 'The Archive', description: 'Every Market Files record, from the Dutch East India Company to spot bitcoin ETFs.', alternates: { canonical: '/files' } };
export default function Archive() {
  const list = [...ARTICLES].sort((a, b) => a.date.localeCompare(b.date));
  return (<>
    <SiteHeader />
    <main id="main" className="wrap"><header className="ph serif"><h1>The Archive</h1><p>Every Market Files record, with its sources on file.</p></header>
      <div className="files">{list.map((a) => (
        <article className="file" key={a.slug} style={{ ['--dc' as string]: DESKS[a.desk].hex }}><a href={`/files/${a.slug}`} style={{ display: 'contents' }}>
          <span className="file-tab">FILE {a.file}</span>
          <div className="file-b"><dl className="file-m"><dt>Location</dt><dd>{a.loc}</dd><dt>Date</dt><dd>{fmtDate(a.date, a.prec)}</dd><dt>Category</dt><dd>{a.cat}</dd></dl>
            <h3>{a.head}</h3><div className="file-f"><span className="handle">@{DESKS[a.desk].handle}</span><span className={`stamp ${a.status}`}>{a.status === 'review' ? 'In review' : a.status}</span></div></div></a></article>))}</div>
    </main><SiteFooter /></>);
}

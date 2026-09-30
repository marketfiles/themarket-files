import { DESKS } from '@/lib/content';

/** Lightweight header/footer for server-rendered, indexable pages (files, day files). */
export function SiteHeader() {
  const nav: [string, string][] = [['Blog', '/blog'], ['Markets', '/#/markets'], ['Futures', '/#/futures'], ['Library', '/#/library'], ['Wall Street', '/#/wall-street'], ['Global Finance', '/#/global-finance'], ['History', '/#/history'], ['Bitcoin', '/#/bitcoin'], ['Blockchain', '/#/blockchain'], ['Archive', '/files'], ['Time Machine', '/#/on-this-date']];
  return (
    <header className="nav" style={{ position: 'sticky' }}>
      <div className="wrap nav-in">
        <a className="logo" href="/" aria-label="Market Files home">
          <img className="logo-i" src="/logo-72.png" alt="" width={36} height={36} />
          <span className="logo-t"><b>Market Files</b><small>MARKETS • MONEY • HISTORY</small></span>
        </a>
        <nav aria-label="Primary"><ul className="nav-links">{nav.map(([l, h]) => <li key={h}><a href={h}>{l}</a></li>)}</ul></nav>
        <div className="nav-r"><a className="btn btn-p" href="/#/search">✦ Search & research</a></div>
      </div>
    </header>
  );
}
export function SiteFooter() {
  return (
    <footer>
      <div className="wrap">
        <div className="desks">
          {Object.values(DESKS).map((d) => (
            <a key={d.handle} href={`https://x.com/${d.handle}`} target="_blank" rel="noopener" style={{ ['--dc' as string]: d.hex }}>
              <b>@{d.handle}</b><span>{d.blurb || 'Main account — every desk in one feed.'}</span>
            </a>
          ))}
        </div>
        <div className="f-bot">
          <span>Educational purposes only. Nothing published by Market Files constitutes financial advice.</span>
          <span>© {new Date().getFullYear()} Market Files</span>
        </div>
      </div>
    </footer>
  );
}

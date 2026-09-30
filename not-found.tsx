import { SiteHeader, SiteFooter } from '@/components/SiteChrome';
export default function NotFound() {
  return (<><SiteHeader /><main className="wrap"><header className="ph"><h1>File not found</h1><p>This address doesn’t match a Market Files page.</p></header><a className="btn" href="/">Front page</a></main><SiteFooter /></>);
}

import type { Metadata, Viewport } from 'next';
import './globals.css';
import { siteUrl } from '@/lib/content';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: 'Market Files — Markets • Money • History', template: '%s — Market Files' },
  description: 'Live markets, an archive of the events that changed them, and Market Files AI research on anything financial — Wall Street, global finance, Bitcoin and blockchain.',
  applicationName: 'Market Files',
  openGraph: { type: 'website', siteName: 'Market Files', title: 'Market Files — Markets • Money • History', description: 'Real-time market intelligence and the history behind it.' },
  twitter: { card: 'summary_large_image', site: '@TheMarketFiles', creator: '@TheMarketFiles' },
  alternates: { canonical: '/' },
};
export const viewport: Viewport = { themeColor: '#080B10', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

const ORG = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'NewsMediaOrganization', '@id': `${siteUrl()}/#org`, name: 'Market Files', slogan: 'Markets • Money • History', url: siteUrl(), logo: `${siteUrl()}/logo-512.png`,
      sameAs: ['TheMarketFiles', 'NowOnWallSt', 'ThenOnWallSt', 'OnGlobalFinance', 'NowOnBTC', 'NowOnChain'].map((h) => `https://x.com/${h}`) },
    { '@type': 'WebSite', '@id': `${siteUrl()}/#site`, url: siteUrl(), name: 'Market Files', publisher: { '@id': `${siteUrl()}/#org` },
      potentialAction: { '@type': 'SearchAction', target: `${siteUrl()}/#/search?q={query}`, 'query-input': 'required name=query' } },
  ],
};
const THEME_BOOT = `try{document.documentElement.dataset.theme=localStorage.getItem("mf-theme")||"dark"}catch(e){document.documentElement.dataset.theme="dark"}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=IBM+Plex+Mono:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400..700&display=swap" rel="stylesheet" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

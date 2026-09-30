import Script from 'next/script';
import { SHELL_HTML } from './experience-shell';
import { siteUrl } from '@/lib/content';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/** X profile photos dropped into public/pfp/<Handle>.jpg|png|webp are picked up automatically. */
function pfps() {
  try {
    return Object.fromEntries(readdirSync(join(process.cwd(), 'public', 'pfp')).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).map((f) => [f.replace(/\.[^.]+$/, ''), `/pfp/${f}`]));
  } catch { return {}; }
}

export const dynamic = 'force-dynamic';

export default function Home() {
  const config = {
    siteUrl: siteUrl(),
    market: process.env.MARKET_DATA === 'live' ? 'live' : 'simulated',
    ai: Boolean(process.env.ANTHROPIC_API_KEY),
    google: process.env.GOOGLE_CSE_ID || '',
    tradingview: process.env.TRADINGVIEW !== 'false',
    pfps: pfps(),
  };
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: `window.MF_CONFIG=${JSON.stringify(config)};` }} />
      <div id="mf-root" dangerouslySetInnerHTML={{ __html: SHELL_HTML }} />
      <Script src="/experience/market-files.js" strategy="afterInteractive" />
      <noscript>
        <div style={{ padding: 24 }}>Market Files needs JavaScript for live markets and the globe. Browse the <a href="/files">archive</a> instead.</div>
      </noscript>
    </>
  );
}

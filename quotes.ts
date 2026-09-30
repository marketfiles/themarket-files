import { SYMBOLS } from './symbols';

export interface Quote { id: string; v: number; prev: number; label?: string; source: string; asOf: string; mc?: number }

// Small per-instance cache so every visitor shares the same upstream calls.
const cache = new Map<string, { at: number; data: Quote[] }>();
async function cached(key: string, ttlMs: number, fn: () => Promise<Quote[]>) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data;
  try { const data = await fn(); cache.set(key, { at: Date.now(), data }); return data; }
  catch (e) { console.error(`[quotes] ${key}:`, (e as Error).message); return hit?.data ?? []; }
}
const getJSON = async (url: string, headers: Record<string, string> = {}) => {
  const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'MarketFiles/1.0', ...headers }, cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`${r.status} ${url.split('?')[0]}`);
  return r.json();
};

async function finnhub(): Promise<Quote[]> {
  const key = process.env.FINNHUB_API_KEY; if (!key) return [];
  const entries = Object.entries(SYMBOLS).filter(([, s]) => s.kind === 'finnhub') as [string, Extract<(typeof SYMBOLS)[string], { kind: 'finnhub' }>][];
  const out: Quote[] = [];
  // Sequential in small batches to respect the free tier's per-minute limit.
  for (let i = 0; i < entries.length; i += 8) {
    const batch = await Promise.all(entries.slice(i, i + 8).map(async ([id, s]) => {
      try {
        const j = await getJSON(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(s.symbol)}&token=${key}`);
        if (!j || !j.c) return null;
        return { id, v: j.c, prev: j.pc || j.c, label: s.label, source: `Finnhub · ${s.symbol} · delayed`, asOf: new Date((j.t || Date.now() / 1000) * 1000).toISOString() } as Quote;
      } catch { return null; }
    }));
    batch.forEach((q) => q && out.push(q));
  }
  return out;
}

async function fred(): Promise<Quote[]> {
  const key = process.env.FRED_API_KEY; if (!key) return [];
  const entries = Object.entries(SYMBOLS).filter(([, s]) => s.kind === 'fred') as [string, Extract<(typeof SYMBOLS)[string], { kind: 'fred' }>][];
  const res = await Promise.all(entries.map(async ([id, s]) => {
    try {
      const j = await getJSON(`https://api.stlouisfed.org/fred/series/observations?series_id=${s.series}&api_key=${key}&file_type=json&sort_order=desc&limit=10`);
      const obs = (j.observations || []).filter((o: { value: string }) => o.value !== '.' && isFinite(+o.value));
      if (!obs.length) return null;
      return { id, v: +obs[0].value, prev: +(obs[1]?.value ?? obs[0].value), label: s.label, source: `FRED · ${s.series} · ${s.freq}`, asOf: obs[0].date } as Quote;
    } catch { return null; }
  }));
  return res.filter(Boolean) as Quote[];
}

async function fx(): Promise<Quote[]> {
  const base = (process.env.FX_API_BASE || 'https://api.frankfurter.app').replace(/\/$/, '');
  const start = new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10);
  const j = await getJSON(`${base}/${start}..?from=USD&to=EUR,JPY,GBP,CNY,CHF,AUD`);
  const dates = Object.keys(j.rates || {}).sort();
  if (dates.length < 1) return [];
  const now = j.rates[dates[dates.length - 1]], before = j.rates[dates[Math.max(0, dates.length - 2)]];
  const asOf = dates[dates.length - 1], source = 'ECB reference rate · Frankfurter · daily';
  const inv = (x: number) => 1 / x;
  return [
    { id: 'EURUSD', v: inv(now.EUR), prev: inv(before.EUR), source, asOf },
    { id: 'GBPUSD', v: inv(now.GBP), prev: inv(before.GBP), source, asOf },
    { id: 'AUDUSD', v: inv(now.AUD), prev: inv(before.AUD), source, asOf },
    { id: 'USDJPY', v: now.JPY, prev: before.JPY, source, asOf },
    { id: 'USDCNY', v: now.CNY, prev: before.CNY, source, asOf },
    { id: 'USDCHF', v: now.CHF, prev: before.CHF, source, asOf },
  ];
}

async function coingecko(): Promise<Quote[]> {
  const entries = Object.entries(SYMBOLS).filter(([, s]) => s.kind === 'coingecko') as [string, { kind: 'coingecko'; id: string }][];
  const ids = entries.map(([, s]) => s.id).join(',');
  const key = process.env.COINGECKO_API_KEY;
  const j = await getJSON(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=24h`, key ? { 'x-cg-demo-api-key': key } : {});
  return entries.map(([id, s]) => {
    const c = (j as { id: string; current_price: number; price_change_percentage_24h: number; market_cap: number; last_updated: string }[]).find((x) => x.id === s.id);
    if (!c || !c.current_price) return null;
    const pct = c.price_change_percentage_24h || 0;
    return { id, v: c.current_price, prev: c.current_price / (1 + pct / 100), mc: c.market_cap, source: 'CoinGecko · 24h change', asOf: c.last_updated } as Quote;
  }).filter(Boolean) as Quote[];
}

/**
 * Futures: reads a licensed feed you control (FUTURES_FEED_URL) returning JSON like
 * [{ "symbol": "ES", "last": 6752.25, "prevSettle": 6731.5, "contract": "ESZ6", "asOf": "2026-09-30T14:02:00Z" }]
 * — e.g. a small job that pulls from Databento, Barchart or CME DataMine under your license.
 */
async function futures(): Promise<Quote[]> {
  const url = process.env.FUTURES_FEED_URL; if (!url) return [];
  const rows = await getJSON(url, process.env.FUTURES_FEED_TOKEN ? { authorization: `Bearer ${process.env.FUTURES_FEED_TOKEN}` } : {});
  const roots = new Set(Object.values(SYMBOLS).filter((s) => s.kind === 'futures').map((s) => (s as { root: string }).root));
  return (Array.isArray(rows) ? rows : []).filter((r: { symbol: string; last: number }) => roots.has(r.symbol) && isFinite(r.last))
    .map((r: { symbol: string; last: number; prevSettle?: number; contract?: string; asOf?: string }) => ({
      id: `${r.symbol}1`, v: r.last, prev: r.prevSettle ?? r.last, source: `Futures · ${r.contract || r.symbol + ' front month'} · delayed`, asOf: r.asOf || new Date().toISOString(),
    }));
}

export async function getQuotes() {
  const [a, b, c, d, e] = await Promise.all([
    cached('finnhub', 60_000, finnhub),
    cached('fred', 60 * 60_000, fred),
    cached('fx', 60 * 60_000, fx),
    cached('coingecko', 30_000, coingecko),
    cached('futures', 30_000, futures),
  ]);
  return { asOf: new Date().toISOString(), quotes: [...a, ...b, ...c, ...d, ...e] };
}

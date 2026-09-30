// Long-run data for Market Files Library charts (FRED). Annual averages; `units=pc1` gives year-over-year % change.
export const revalidate = 86400;
const ALLOWED = new Set(['DGS10', 'FEDFUNDS', 'CPIAUCSL', 'UNRATE', 'GDPC1', 'DGS2', 'M2SL', 'MORTGAGE30US']);
const cache = new Map<string, { at: number; body: unknown }>();
export async function GET(req: Request) {
  const u = new URL(req.url);
  const id = (u.searchParams.get('id') || '').toUpperCase();
  const units = u.searchParams.get('units') === 'pc1' ? 'pc1' : 'lin';
  const key = process.env.FRED_API_KEY;
  if (!ALLOWED.has(id) || !key) return Response.json({ error: 'Unavailable' }, { status: 404 });
  const ck = `${id}:${units}`, hit = cache.get(ck);
  if (hit && Date.now() - hit.at < 86_400_000) return Response.json(hit.body);
  const r = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${key}&file_type=json&frequency=a&aggregation_method=avg&units=${units}`, { signal: AbortSignal.timeout(10_000) });
  if (!r.ok) return Response.json({ error: 'Upstream error' }, { status: 502 });
  const j = await r.json();
  const body = { id, units, source: `FRED · ${id} · annual average`, points: (j.observations || []).filter((o: { value: string }) => o.value !== '.').map((o: { date: string; value: string }) => ({ d: o.date, v: +(+o.value).toFixed(3) })) };
  cache.set(ck, { at: Date.now(), body });
  return Response.json(body, { headers: { 'cache-control': 'public, s-maxage=86400' } });
}

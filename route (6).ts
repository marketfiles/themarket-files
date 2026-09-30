import { getQuotes } from '@/lib/market/quotes';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  if (process.env.MARKET_DATA !== 'live') return Response.json({ asOf: new Date().toISOString(), quotes: [] });
  const data = await getQuotes();
  return Response.json(data, { headers: { 'cache-control': 'public, s-maxage=20, stale-while-revalidate=60' } });
}

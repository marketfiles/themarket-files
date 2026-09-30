import { monthDocs } from '@/lib/db';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return Response.json({ docs: await monthDocs() }, { headers: { 'cache-control': 'public, s-maxage=30, stale-while-revalidate=300' } }); }
  catch (e) { console.error('[tm]', (e as Error).message); return Response.json({ docs: [] }, { status: 503 }); }
}

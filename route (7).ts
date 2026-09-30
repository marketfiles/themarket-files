import { isEditor } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function GET() { return Response.json({ editor: await isEditor() }, { headers: { 'cache-control': 'no-store' } }); }

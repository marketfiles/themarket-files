import { cookies } from 'next/headers';
import { EDITOR_COOKIE } from '@/lib/auth';
export async function POST() { (await cookies()).delete(EDITOR_COOKIE); return Response.json({ ok: true }); }

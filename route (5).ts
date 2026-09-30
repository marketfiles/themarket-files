import { cookies } from 'next/headers';
import { passwordMatches, editorCookieValue, sameOrigin } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/ratelimit';
export async function POST(req: Request) {
  if (!rateLimit(`login:${clientIp(req.headers)}`, 8, 15 * 60_000)) return Response.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  if (!(await sameOrigin())) return Response.json({ error: 'Bad origin' }, { status: 403 });
  const { password } = await req.json().catch(() => ({ password: '' }));
  if (!passwordMatches(String(password || ''))) return Response.json({ error: 'Incorrect password' }, { status: 401 });
  const c = editorCookieValue();
  (await cookies()).set(c.name, c.value, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: c.maxAge });
  return Response.json({ ok: true });
}

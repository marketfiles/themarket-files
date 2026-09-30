import { sql } from '@/lib/db';
import { rateLimit, clientIp } from '@/lib/ratelimit';
export async function POST(req: Request) {
  if (!rateLimit(`nl:${clientIp(req.headers)}`, 5, 10 * 60_000)) return Response.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  const { email } = await req.json().catch(() => ({ email: '' }));
  const e = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) || e.length > 254) return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });
  const key = process.env.BEEHIIV_API_KEY, pub = process.env.BEEHIIV_PUBLICATION_ID;
  try {
    if (key && pub) {
      const r = await fetch(`https://api.beehiiv.com/v2/publications/${pub}/subscriptions`, {
        method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ email: e, reactivate_existing: true, send_welcome_email: true, utm_source: 'marketfiles.com' }),
      });
      if (!r.ok) throw new Error(`beehiiv ${r.status}`);
    } else if (sql) {
      await sql`insert into newsletter_signups (email) values (${e}) on conflict do nothing`;
    } else {
      return Response.json({ error: 'Signups open soon.' }, { status: 503 });
    }
    return Response.json({ ok: true, message: 'You’re on the list for The Daily File. Check your inbox.' });
  } catch (err) {
    console.error('[newsletter]', (err as Error).message);
    return Response.json({ error: 'Couldn’t subscribe right now. Please try again.' }, { status: 502 });
  }
}

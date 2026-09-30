import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';

const COOKIE = 'mf_editor';
const secret = () => process.env.ADMIN_SECRET || '';
const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

export function passwordMatches(input: string) {
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected || !secret()) return false;
  const a = Buffer.from(input), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function editorCookieValue(days = 7) {
  const exp = Date.now() + days * 864e5;
  return { name: COOKIE, value: `${exp}.${sign(`editor.${exp}`)}`, maxAge: days * 86400 };
}
export async function isEditor() {
  if (!secret()) return false;
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return false;
  const [exp, sig] = v.split('.');
  if (!exp || !sig || Date.now() > +exp) return false;
  const good = sign(`editor.${exp}`);
  return sig.length === good.length && timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}
/** Blocks cross-site form posts for state-changing requests. */
export async function sameOrigin() {
  const h = await headers();
  const origin = h.get('origin');
  const host = h.get('x-forwarded-host') || h.get('host');
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}
export const EDITOR_COOKIE = COOKIE;

// Admin session: a signed, expiring cookie after ADMIN_PASSWORD. Admin is off without a password.
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { env } from './env';

const COOKIE = 'sp_admin';
const sign = (v: string) => crypto.createHmac('sha256', env.SESSION_SECRET || 'unset').update(v).digest('hex');

export function checkPassword(pw: string) {
  if (!env.ADMIN_PASSWORD) return false;
  const a = Buffer.from(pw), b = Buffer.from(env.ADMIN_PASSWORD);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export function sessionCookie() {
  const exp = String(Date.now() + 12 * 3600_000);
  return { name: COOKIE, value: `${exp}.${sign(exp)}`, httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 12 * 3600 };
}
export function isAdmin() {
  if (!env.ADMIN_PASSWORD) return false;
  const v = cookies().get(COOKIE)?.value || '';
  const [exp, sig] = v.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const want = sign(exp);
  return sig.length === want.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want));
}

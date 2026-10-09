import { NextResponse } from 'next/server';
import { checkPassword, sessionCookie } from '@/lib/auth';
import { body } from '@/lib/http';

export const dynamic = 'force-dynamic';

const tries = new Map<string, number[]>();

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const now = Date.now();
  const recent = (tries.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  if (recent.length >= 8) return NextResponse.json({ error: 'Too many attempts. Wait ten minutes.' }, { status: 429 });
  tries.set(ip, [...recent, now]);
  const { password } = await body<{ password?: string }>(req);
  if (!checkPassword(String(password || ''))) return NextResponse.json({ error: 'Wrong password.' }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie());
  return res;
}

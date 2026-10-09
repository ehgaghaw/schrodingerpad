// Coins launched before 2026-10-09 22:45 UTC carry "/box/pending" as their website in their
// (immutable) pump.fun metadata. Send those visitors to that coin with a real HTTP redirect.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
const LEGACY_CUTOFF = new Date('2026-10-09T22:45:00Z');

export async function GET(req: Request) {
  const legacy = await prisma.box.findFirst({ where: { test: false, mint: { not: null }, createdAt: { lt: LEGACY_CUTOFF } }, orderBy: { createdAt: 'desc' } });
  return NextResponse.redirect(new URL(legacy?.mint ? `/box/${legacy.mint}` : '/boxes', req.url), 307);
}

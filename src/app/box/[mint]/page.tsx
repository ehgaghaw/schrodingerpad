import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { boxName, publicRpcUrl } from '@/lib/env';
import { redirect } from 'next/navigation';
import { BoxView } from '@/components/BoxView';

// Coins launched before 2026-10-09 22:45 UTC carry "/box/pending" as their website (immutable
// pump.fun metadata); send those visitors to the coin.
const LEGACY_CUTOFF = new Date('2026-10-09T22:45:00Z');

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { mint: string } }): Promise<Metadata> {
  const b = await prisma.box.findUnique({ where: { mint: params.mint }, select: { number: true, state: true, name: true, ticker: true } });
  if (!b) return { title: 'Box not found' };
  const title = b.state === 'COLLAPSED' && b.name ? `${b.name} ($${b.ticker})` : `${boxName(b.number)} ($${b.ticker})`;
  return { title, openGraph: { title, images: [`/api/art/${params.mint}`] }, twitter: { card: 'summary_large_image', title, images: [`/api/art/${params.mint}`] } };
}

export default async function BoxPage({ params }: { params: { mint: string } }) {
  if (params.mint === 'pending') {
    const legacy = await prisma.box.findFirst({ where: { test: false, mint: { not: null }, createdAt: { lt: LEGACY_CUTOFF } }, orderBy: { createdAt: 'desc' } });
    redirect(legacy?.mint ? `/box/${legacy.mint}` : '/boxes');
  }
  return <BoxView mint={params.mint} rpc={publicRpcUrl()} />;
}

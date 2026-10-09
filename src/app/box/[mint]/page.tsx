import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { boxName, publicRpcUrl } from '@/lib/env';
import { BoxView } from '@/components/BoxView';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { mint: string } }): Promise<Metadata> {
  const b = await prisma.box.findUnique({ where: { mint: params.mint }, select: { number: true, state: true, name: true, ticker: true } });
  if (!b) return { title: 'Box not found' };
  const title = b.state === 'COLLAPSED' && b.name ? `${b.name} ($${b.ticker})` : `${boxName(b.number)} ($${b.ticker})`;
  return { title, openGraph: { title, images: [`/api/art/${params.mint}`] }, twitter: { card: 'summary_large_image', title, images: [`/api/art/${params.mint}`] } };
}

export default function BoxPage({ params }: { params: { mint: string } }) {
  return <BoxView mint={params.mint} rpc={publicRpcUrl()} />;
}

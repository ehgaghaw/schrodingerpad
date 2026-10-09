import { prisma } from '@/lib/db';
import { renderSealed } from '@/lib/art';

export const dynamic = 'force-dynamic';

let sealed: Buffer | null = null;
const png = (b: Uint8Array, cache: string) =>
  new Response(new Uint8Array(b), { headers: { 'content-type': 'image/png', 'cache-control': cache } });

export async function GET(_req: Request, { params }: { params: { mint: string } }) {
  if (params.mint !== 'sealed') {
    const b = await prisma.box.findUnique({ where: { mint: params.mint }, select: { state: true, art: true } });
    if (b?.state === 'COLLAPSED' && b.art) return png(b.art, 'public, max-age=31536000, immutable');
  }
  sealed ||= await renderSealed();
  return png(sealed, 'public, max-age=30');
}

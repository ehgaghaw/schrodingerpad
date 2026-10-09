import { boxDetail } from '@/lib/public';
import { json, fail } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { mint: string } }) {
  const d = await boxDetail(params.mint);
  return d ? json(d) : fail('Box not found.', 404);
}

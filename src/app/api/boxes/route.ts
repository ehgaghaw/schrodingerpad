import { listBoxes, FILTERS, type Filter } from '@/lib/public';
import { json } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const u = new URL(req.url);
  const raw = u.searchParams.get('filter') || '';
  const filter = (FILTERS as readonly string[]).includes(raw) ? (raw as Filter) : 'new';
  const take = Math.min(100, Math.max(1, Number(u.searchParams.get('take')) || 25));
  const skip = Math.max(0, Number(u.searchParams.get('skip')) || 0);
  return json(await listBoxes(filter, take, skip));
}

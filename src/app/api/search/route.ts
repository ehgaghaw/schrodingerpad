import { search } from '@/lib/public';
import { json } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get('q') || '').slice(0, 60);
  return json(await search(q));
}

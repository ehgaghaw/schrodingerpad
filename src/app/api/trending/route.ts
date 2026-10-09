import { trending } from '@/lib/public';
import { json } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  return json(await trending(12));
}

import { createIntent } from '@/lib/intents';
import { json, fail, body } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const b = await body<{ wallet?: string; ticker?: string }>(req);
  try {
    return json(await createIntent(String(b.wallet || ''), String(b.ticker || '')));
  } catch (e) {
    return fail((e as Error).message);
  }
}

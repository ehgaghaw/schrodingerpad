import { confirmIntent } from '@/lib/intents';
import { json, fail, body } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: Request) {
  const b = await body<{ id?: string; signature?: string }>(req);
  try {
    const box = await confirmIntent(String(b.id || ''), String(b.signature || ''));
    return json({ mint: box?.mint, number: box?.number });
  } catch (e) {
    return fail((e as Error).message);
  }
}

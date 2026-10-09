// Helius "raw" webhook for pump.fun transactions. The Authorization header must equal
// HELIUS_WEBHOOK_SECRET. The worker's poller covers anything the webhook misses.
import { env } from '@/lib/env';
import { processTransaction } from '@/lib/observe';
import { json, fail } from '@/lib/http';

export const dynamic = 'force-dynamic';

type RawTx = {
  blockTime?: number;
  meta?: { logMessages?: string[]; innerInstructions?: { instructions: { data: string }[] }[]; err?: unknown };
  transaction?: { signatures?: string[] };
};

export async function POST(req: Request) {
  if (!env.HELIUS_WEBHOOK_SECRET || req.headers.get('authorization') !== env.HELIUS_WEBHOOK_SECRET) return fail('unauthorized', 401);
  const list = (await req.json().catch(() => [])) as RawTx[];
  let applied = 0;
  for (const t of Array.isArray(list) ? list : []) {
    const sig = t.transaction?.signatures?.[0];
    if (!sig || t.meta?.err) continue;
    const inner = (t.meta?.innerInstructions ?? []).flatMap((ii) => ii.instructions.map((x) => x.data));
    applied += await processTransaction(sig, t.meta?.logMessages, inner, t.blockTime ?? null);
  }
  return json({ ok: true, applied });
}

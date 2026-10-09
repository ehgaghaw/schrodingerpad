// Browser wallets send through this proxy so the Helius key never reaches the client.
// Only read and send methods are allowed.
import { rpcUrl } from '@/lib/env';
import { fail } from '@/lib/http';

export const dynamic = 'force-dynamic';

const ALLOWED = new Set([
  'getLatestBlockhash', 'sendTransaction', 'getSignatureStatuses', 'getBalance', 'getAccountInfo', 'getTransaction',
  'simulateTransaction', 'getBlockHeight', 'getFeeForMessage', 'getMinimumBalanceForRentExemption', 'getSlot', 'getEpochInfo',
  'getRecentPrioritizationFees', 'isBlockhashValid',
]);

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 20_000) return fail('too large', 413);
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return fail('bad json'); }
  const calls = Array.isArray(parsed) ? parsed : [parsed];
  if (calls.length > 10 || !calls.every((c) => ALLOWED.has((c as { method?: string }).method || ''))) return fail('method not allowed', 403);
  const r = await fetch(rpcUrl(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw });
  return new Response(await r.text(), { status: r.status, headers: { 'content-type': 'application/json' } });
}

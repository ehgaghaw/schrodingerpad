// TEST_MODE only: launch a free devnet test box for a connected wallet (no payment, no real coin).
import { PublicKey } from '@solana/web3.js';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { launchBox, TICKER_RE } from '@/lib/launch';
import { json, fail, body } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: Request) {
  if (!env.TEST_MODE) return fail('Test launches only exist in test mode.', 404);
  const b = await body<{ wallet?: string; ticker?: string }>(req);
  const wallet = String(b.wallet || '');
  try { new PublicKey(wallet); } catch { return fail('Connect a wallet first.'); }
  const ticker = String(b.ticker || '').toUpperCase();
  if (!TICKER_RE.test(ticker)) return fail('Ticker must be 2-10 letters or digits.');
  const since = new Date(Date.now() - 10 * 60_000);
  const [mine, all] = await Promise.all([
    prisma.box.count({ where: { test: true, creatorWallet: wallet, createdAt: { gte: since } } }),
    prisma.box.count({ where: { test: true, createdAt: { gte: since } } }),
  ]);
  if (mine >= 5) return fail('That is enough test boxes for now. Try again in a few minutes.', 429);
  if (all >= 40) return fail('The test launcher is busy. Try again in a few minutes.', 429);
  try {
    const box = await launchBox({ ticker, creatorWallet: wallet });
    return json({ mint: box.mint, number: box.number });
  } catch (e) {
    return fail((e as Error).message.slice(0, 200), 500);
  }
}

import { prisma } from '@/lib/db';
import { isAdmin } from '@/lib/auth';
import { isPaused } from '@/lib/kv';
import { env, cluster } from '@/lib/env';
import { connection, launcherAddress } from '@/lib/solana';
import { json, fail } from '@/lib/http';
import { PublicKey } from '@solana/web3.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAdmin()) return fail('unauthorized', 401);
  const launcher = launcherAddress();
  const [paused, logs, payouts, burns, collections, intents, boxes, balance] = await Promise.all([
    isPaused(),
    prisma.logEntry.findMany({ orderBy: { at: 'desc' }, take: 80 }),
    prisma.payout.findMany({ orderBy: { createdAt: 'desc' }, take: 60, include: { box: { select: { number: true, mint: true } } } }),
    prisma.burn.findMany({ orderBy: { createdAt: 'desc' }, take: 30, include: { box: { select: { number: true } } } }),
    prisma.feeCollection.findMany({ orderBy: { at: 'desc' }, take: 20 }),
    prisma.launchIntent.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
    prisma.box.findMany({ orderBy: { createdAt: 'desc' }, take: 40, select: { id: true, number: true, mint: true, ticker: true, state: true, fate: true, rarity: true, seedSource: true, pendingCreator: true, pendingPool: true, test: true } }),
    launcher ? connection().getBalance(new PublicKey(launcher)).then((l) => l / 1e9).catch(() => null) : null,
  ]);
  return json({ paused, testMode: env.TEST_MODE, cluster, launcher, launcherSol: balance, logs, payouts, burns, collections, intents, boxes });
}

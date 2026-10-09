// Fate mechanics, every fee cycle:
//   creator share  -> the coin's creator wallet
//   ALIVE coins    -> the rest is paid to holders in SOL, by 60-minute average balance
//   DEAD coins     -> the rest buys the coin back and burns it
// Exactly-once: pending amounts are taken with a compare-and-set update, every payout row is
// claimed (PENDING -> SENDING) by exactly one runner before any SOL moves, and a failed send is
// never retried automatically.
import { SystemProgram, PublicKey } from '@solana/web3.js';
import crypto from 'node:crypto';
import { prisma } from './db';
import { env } from './env';
import { launcher, sendFromLauncher, lamportsOf } from './solana';
import { averageBalances } from './holders';
import { buyBack, burnTokens } from './pump';
import { isPaused } from './kv';
import { withLease } from './lease';
import { log } from './log';

const MIN_PAYOUT = () => lamportsOf(env.MIN_PAYOUT_SOL);
const MIN_BUYBACK = () => lamportsOf(Number(process.env.MIN_BUYBACK_SOL || 0.01));
const PER_TX = 12;

/** Holder shares by weight. Pure; dust under the minimum stays in the pool. */
export function holderShares(pool: bigint, weights: Map<string, bigint>, min: bigint) {
  const total = [...weights.values()].reduce((a, b) => a + b, 0n);
  const out = new Map<string, bigint>();
  if (total <= 0n || pool <= 0n) return out;
  for (const [w, wt] of weights) {
    const amt = (pool * wt) / total;
    if (amt >= min) out.set(w, amt);
  }
  return out;
}

/** Takes `amount` out of a box's pending field only if it still holds `expected`. */
async function take(boxId: string, field: 'pendingCreator' | 'pendingPool', expected: bigint, amount: bigint) {
  const r = await prisma.box.updateMany({ where: { id: boxId, [field]: expected }, data: { [field]: { decrement: amount } } });
  return r.count === 1;
}

async function makeBatch(boxId: string, kind: 'HOLDER' | 'CREATOR', shares: Map<string, bigint>) {
  const total = [...shares.values()].reduce((a, b) => a + b, 0n);
  return prisma.payoutBatch.create({
    data: { boxId, kind, total, payouts: { create: [...shares].map(([wallet, lamports]) => ({ boxId, kind, wallet, lamports })) } },
  });
}

async function planCreator(box: { id: string; creatorWallet: string; pendingCreator: bigint }) {
  if (box.pendingCreator < MIN_PAYOUT()) return 0;
  if (!(await take(box.id, 'pendingCreator', box.pendingCreator, box.pendingCreator))) return 0;
  await makeBatch(box.id, 'CREATOR', new Map([[box.creatorWallet, box.pendingCreator]]));
  return 1;
}

async function planHolders(box: { id: string; number: number; pendingPool: bigint }) {
  if (box.pendingPool < MIN_PAYOUT()) return 0;
  const shares = holderShares(box.pendingPool, await averageBalances(box.id), MIN_PAYOUT());
  if (!shares.size) return 0;
  const total = [...shares.values()].reduce((a, b) => a + b, 0n);
  if (!(await take(box.id, 'pendingPool', box.pendingPool, total))) return 0;
  await makeBatch(box.id, 'HOLDER', shares);
  return shares.size;
}

async function buybackAndBurn(box: { id: string; number: number; mint: string | null; pendingPool: bigint }) {
  if (!box.mint || box.pendingPool < MIN_BUYBACK()) return 0;
  const amount = box.pendingPool;
  const burn = await prisma.$transaction(async (tx) => {
    const r = await tx.box.updateMany({ where: { id: box.id, pendingPool: amount }, data: { pendingPool: { decrement: amount } } });
    if (r.count !== 1) return null;
    return tx.burn.create({ data: { boxId: box.id, lamports: amount } });
  });
  if (!burn) return 0;
  try {
    const bought = await buyBack(box.mint, amount);
    await prisma.burn.update({ where: { id: burn.id }, data: { status: 'BOUGHT', buySig: bought.sig, tokens: bought.tokens } });
    await prisma.box.update({ where: { id: box.id }, data: { buybackSpent: { increment: amount } } });
    const burnSig = bought.tokens > 0n ? await burnTokens(box.mint, bought.tokens) : null;
    await prisma.burn.update({ where: { id: burn.id }, data: { status: 'BURNED', burnSig, doneAt: new Date() } });
    await prisma.box.update({ where: { id: box.id }, data: { tokensBurned: { increment: bought.tokens } } });
    await log('burn', `box #${box.number}: bought back with ${Number(amount) / 1e9} SOL and burned ${bought.tokens} (buy ${bought.sig}, burn ${burnSig})`);
  } catch (e) {
    await prisma.burn.update({ where: { id: burn.id }, data: { status: 'FAILED', error: (e as Error).message.slice(0, 300) } });
    await log('burn', `box #${box.number}: buyback/burn failed: ${(e as Error).message.slice(0, 200)}`, 'error');
  }
  return 1;
}

/** Sends every PENDING payout. Each row is claimed by exactly one runner before any SOL moves. */
export async function sendPending() {
  const pending = await prisma.payout.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, take: 300 });
  let paid = 0;
  for (let i = 0; i < pending.length; i += PER_TX) {
    const claimed: typeof pending = [];
    for (const p of pending.slice(i, i + PER_TX)) {
      const r = await prisma.payout.updateMany({ where: { id: p.id, status: 'PENDING' }, data: { status: 'SENDING' } });
      if (r.count === 1) claimed.push(p);
    }
    if (!claimed.length) continue;
    try {
      const sig = env.TEST_MODE
        ? `test-payout-${crypto.randomBytes(16).toString('hex')}`
        : await sendFromLauncher(claimed.map((p) => SystemProgram.transfer({ fromPubkey: launcher().publicKey, toPubkey: new PublicKey(p.wallet), lamports: p.lamports })));
      const now = new Date();
      for (const p of claimed) {
        await prisma.payout.update({ where: { id: p.id }, data: { status: 'PAID', sig, paidAt: now } });
        await prisma.box.update({ where: { id: p.boxId }, data: p.kind === 'CREATOR' ? { creatorPaid: { increment: p.lamports } } : { holdersPaid: { increment: p.lamports } } });
      }
      paid += claimed.length;
    } catch (e) {
      const msg = (e as Error).message.slice(0, 300);
      await prisma.payout.updateMany({ where: { id: { in: claimed.map((p) => p.id) } }, data: { status: 'FAILED', error: msg } });
      await log('payouts', `send failed for ${claimed.length} payouts: ${msg}`, 'error');
    }
  }
  return paid;
}

/** One distribution cycle. `useLease: false` lets tests hammer the row-level guarantees directly. */
export async function runDistribution(opts: { useLease?: boolean } = {}) {
  const body = async () => {
    if (await isPaused()) return 'paused';
    const boxes = await prisma.box.findMany({ where: { OR: [{ pendingCreator: { gt: 0 } }, { pendingPool: { gt: 0 } }] } });
    let planned = 0;
    for (const b of boxes) {
      planned += await planCreator(b);
      if (b.state !== 'COLLAPSED') continue; // sealed boxes keep their pool until they collapse
      if (b.fate === 'ALIVE') planned += await planHolders(b);
      else if (b.fate === 'DEAD') planned += await buybackAndBurn(b);
    }
    const paid = await sendPending();
    return `planned ${planned}, paid ${paid}`;
  };
  if (opts.useLease === false) return body();
  const r = await withLease('payouts', 900, body);
  return r.ran ? r.value : 'busy';
}

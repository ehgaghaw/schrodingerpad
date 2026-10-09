// Watching the chain: every pump.fun trade on a box updates its market data and accrues its
// creator fee. The first buy by anyone other than the launcher is the observer and collapses it.
import { PublicKey } from '@solana/web3.js';
import { prisma } from './db';
import { env } from './env';
import { connection, launcherAddress } from './solana';
import { bondingCurvePda, INITIAL_REAL_TOKEN_RESERVES, TOTAL_SUPPLY } from './pump';
import { tradesFromTx, type Trade } from './events';
import { collapseBox } from './collapse';
import { log } from './log';

/** Stores one trade (idempotent on sig+idx) and applies its effects. */
export async function applyTrade(t: Trade, sig: string, idx: number, at: Date) {
  const box = await prisma.box.findUnique({ where: { mint: t.mint } });
  if (!box) return false;
  try {
    await prisma.trade.create({
      data: { boxId: box.id, sig, idx, wallet: t.user, isBuy: t.isBuy, solAmount: t.solAmount, tokenAmount: t.tokenAmount, creatorFee: t.creatorFee, priceSol: t.priceSol, marketCapSol: t.marketCapSol, at },
    });
  } catch {
    return false; // already seen
  }
  const newer = !box.lastTradeAt || at >= box.lastTradeAt;
  await prisma.box.update({
    where: { id: box.id },
    data: {
      feesAccrued: { increment: t.creatorFee },
      ...(newer ? { priceSol: t.priceSol, marketCapSol: t.marketCapSol, bondingProgress: t.progress, complete: t.complete, lastTradeAt: at } : {}),
    },
  });
  if (t.isBuy && box.state === 'SEALED' && t.user !== launcherAddress()) {
    await collapseBox(box.id, 'FIRST_BUY', { wallet: t.user, sig, at });
  }
  return true;
}

/** Applies every trade event in a transaction (from polling or the Helius webhook). */
export async function processTransaction(sig: string, logs: string[] | null | undefined, innerIxData: string[], blockTime: number | null) {
  const trades = tradesFromTx(logs, innerIxData);
  let n = 0;
  for (let i = 0; i < trades.length; i++) if (await applyTrade(trades[i], sig, i, new Date((blockTime ?? trades[i].timestamp) * 1000))) n++;
  return n;
}

/** Polls one box's bonding curve for new transactions, oldest first. */
export async function pollBox(box: { id: string; mint: string | null; lastSig: string | null }) {
  if (!box.mint || env.TEST_MODE) return 0;
  const c = connection();
  const curve = bondingCurvePda(new PublicKey(box.mint));
  const sigs = await c.getSignaturesForAddress(curve, { until: box.lastSig ?? undefined, limit: 100 }, 'confirmed');
  if (!sigs.length) return 0;
  let applied = 0;
  for (const s of [...sigs].reverse()) {
    if (s.err) continue;
    const tx = await c.getTransaction(s.signature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' }).catch(() => null);
    if (!tx?.meta) continue;
    const inner = (tx.meta.innerInstructions ?? []).flatMap((ii) => ii.instructions.map((x) => x.data));
    applied += await processTransaction(s.signature, tx.meta.logMessages, inner, tx.blockTime ?? null);
  }
  await prisma.box.update({ where: { id: box.id }, data: { lastSig: sigs[0].signature } });
  return applied;
}

export async function pollAll() {
  const boxes = await prisma.box.findMany({
    where: { state: { in: ['SEALED', 'COLLAPSED'] }, complete: false, mint: { not: null } },
    orderBy: { lastTradeAt: { sort: 'desc', nulls: 'first' } },
    take: 50,
  });
  let n = 0;
  for (const b of boxes) {
    try { n += await pollBox(b); } catch (e) { await log('observe', `poll ${b.mint}: ${(e as Error).message.slice(0, 160)}`, 'warn'); }
  }
  return n;
}

// ------------------------------------------------------------- TEST_MODE simulation --
// Fake trades on a constant-product curve shaped like pump.fun's, so the whole pipeline
// (first buy, market data, creator-fee accrual) runs on devnet without pump.fun.
const V0_SOL = 30;
const V0_TOK = 1_073_000_000;

export async function simulateTrade(boxId: string, wallet: string, solAmount: number, isBuy = true) {
  if (!env.TEST_MODE) throw new Error('simulateTrade is TEST_MODE only');
  const box = await prisma.box.findUniqueOrThrow({ where: { id: boxId } });
  if (!box.mint) throw new Error('box has no mint yet');
  const past = await prisma.trade.findMany({ where: { boxId }, select: { isBuy: true, solAmount: true } });
  const netSol = past.reduce((a, b) => a + (b.isBuy ? 1 : -1) * Number(b.solAmount), 0) / 1e9;
  const k = V0_SOL * V0_TOK;
  const vSol = V0_SOL + Math.max(0, netSol);
  const vTok = k / vSol;
  const nextSol = Math.max(V0_SOL, vSol + (isBuy ? solAmount : -solAmount));
  const nextTok = k / nextSol;
  const price = nextSol / nextTok;
  const realTok = Math.max(0, INITIAL_REAL_TOKEN_RESERVES - (V0_TOK - nextTok));
  const t: Trade = {
    mint: box.mint, user: wallet, isBuy,
    solAmount: BigInt(Math.round(solAmount * 1e9)), tokenAmount: BigInt(Math.round(Math.abs(vTok - nextTok) * 1e6)),
    creatorFee: BigInt(Math.round(solAmount * 1e9 * 0.003)), priceSol: price, marketCapSol: price * TOTAL_SUPPLY,
    progress: Math.min(1, 1 - realTok / INITIAL_REAL_TOKEN_RESERVES), complete: realTok <= 0, timestamp: Math.floor(Date.now() / 1000),
  };
  const sig = `test-trade-${box.number}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await applyTrade(t, sig, 0, new Date());
  return t;
}

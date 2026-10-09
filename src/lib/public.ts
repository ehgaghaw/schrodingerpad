// What the site and API may show. The seed is never included before a box collapses.
import type { Box, Prisma } from '@prisma/client';
import { prisma } from './db';
import { env, boxName, cluster } from './env';
import { solscan, launcherAddress } from './solana';
import { pumpUrl } from './pump';

let solUsd = { v: 0, at: 0 };
export async function solPriceUsd(): Promise<number> {
  if (Date.now() - solUsd.at < 60_000) return solUsd.v;
  try {
    const r = await fetch('https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112', { signal: AbortSignal.timeout(4000), cache: 'no-store' });
    const v = Number((await r.json())?.So11111111111111111111111111111111111111112?.usdPrice);
    solUsd = { v: Number.isFinite(v) ? v : solUsd.v, at: Date.now() };
  } catch { solUsd.at = Date.now() - 45_000; }
  return solUsd.v;
}

export type BoxSummary = ReturnType<typeof summarize>;
const lamports = (b: bigint) => Number(b) / 1e9;

function summarize(b: Box, spark: number[], change: number, usd: number) {
  const collapsed = b.state === 'COLLAPSED';
  return {
    number: b.number, mint: b.mint, ticker: b.ticker, state: b.state, onchainName: boxName(b.number),
    name: collapsed ? b.name : null, fate: collapsed ? b.fate : null, rarity: collapsed ? b.rarity : null,
    image: b.mint ? `/api/art/${b.mint}?v=${b.updatedAt.getTime()}` : '/api/art/sealed',
    creator: b.creatorWallet, launchedAt: b.launchedAt, collapsedAt: b.collapsedAt, decoheresAt: b.decoheresAt,
    marketCapSol: b.marketCapSol, marketCapUsd: usd ? b.marketCapSol * usd : null, change24h: change, progress: b.bondingProgress, complete: b.complete,
    spark, seedSource: b.seedSource, verifiedOnChain: b.verifiedOnChain, test: b.test,
  };
}

async function sparkAndChange(boxIds: string[]) {
  const since = new Date(Date.now() - 24 * 3600_000);
  const rows = await prisma.trade.findMany({ where: { boxId: { in: boxIds } }, orderBy: { at: 'asc' }, select: { boxId: true, priceSol: true, at: true } });
  const by = new Map<string, { p: number; at: Date }[]>();
  for (const r of rows) (by.get(r.boxId) ?? by.set(r.boxId, []).get(r.boxId)!).push({ p: r.priceSol, at: r.at });
  const out = new Map<string, { spark: number[]; change: number }>();
  for (const id of boxIds) {
    const list = by.get(id) ?? [];
    const recent = list.slice(-40).map((x) => x.p);
    const base = list.find((x) => x.at >= since) ?? list[0];
    const last = list.at(-1);
    out.set(id, { spark: recent, change: base && last && base.p > 0 ? ((last.p - base.p) / base.p) * 100 : 0 });
  }
  return out;
}

export async function summaries(boxes: Box[]) {
  const [sc, usd] = await Promise.all([sparkAndChange(boxes.map((b) => b.id)), solPriceUsd()]);
  return boxes.map((b) => summarize(b, sc.get(b.id)?.spark ?? [], sc.get(b.id)?.change ?? 0, usd));
}

export const FILTERS = ['sealed', 'collapsing', 'alive', 'dead', 'mcap', 'new'] as const;
export type Filter = (typeof FILTERS)[number];
const visible: Prisma.BoxWhereInput = { state: { in: ['SEALED', 'COLLAPSING', 'COLLAPSED'] }, test: env.TEST_MODE ? undefined : false };

export async function listBoxes(filter: Filter = 'new', take = 25, skip = 0) {
  const where: Prisma.BoxWhereInput = { ...visible };
  let orderBy: Prisma.BoxOrderByWithRelationInput = { createdAt: 'desc' };
  if (filter === 'sealed') where.state = 'SEALED';
  if (filter === 'collapsing') { where.state = { in: ['SEALED', 'COLLAPSING'] }; where.decoheresAt = { lte: new Date(Date.now() + 3 * 60_000) }; orderBy = { decoheresAt: 'asc' }; }
  if (filter === 'alive') { where.state = 'COLLAPSED'; where.fate = 'ALIVE'; }
  if (filter === 'dead') { where.state = 'COLLAPSED'; where.fate = 'DEAD'; }
  if (filter === 'mcap') orderBy = { marketCapSol: 'desc' };
  const [rows, total] = await Promise.all([prisma.box.findMany({ where, orderBy, take, skip }), prisma.box.count({ where })]);
  return { boxes: await summaries(rows), total };
}

export async function trending(n = 12) {
  const since = new Date(Date.now() - 6 * 3600_000);
  const vol = await prisma.trade.groupBy({ by: ['boxId'], where: { at: { gte: since } }, _sum: { solAmount: true }, orderBy: { _sum: { solAmount: 'desc' } }, take: n });
  const ids = vol.map((v) => v.boxId);
  let rows = ids.length ? await prisma.box.findMany({ where: { id: { in: ids }, ...visible } }) : [];
  rows.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  if (rows.length < n) rows = [...rows, ...(await prisma.box.findMany({ where: { ...visible, id: { notIn: rows.map((r) => r.id) } }, orderBy: { marketCapSol: 'desc' }, take: n - rows.length }))];
  return summaries(rows);
}

export async function rarest(take = 50) {
  const rows = await prisma.box.findMany({ where: { ...visible, state: 'COLLAPSED' }, orderBy: [{ rarityRoll: 'asc' }], take });
  return summaries(rows);
}

export async function search(q: string) {
  const s = q.trim();
  if (!s) return [];
  const num = Number(s.replace(/^#/, ''));
  const rows = await prisma.box.findMany({
    where: { ...visible, OR: [{ ticker: { contains: s, mode: 'insensitive' } }, { name: { contains: s, mode: 'insensitive' } }, { mint: s }, ...(Number.isInteger(num) ? [{ number: num }] : [])] },
    take: 8, orderBy: { createdAt: 'desc' },
  });
  return summaries(rows);
}

export async function stats() {
  const [boxes, sealed, collapsed, alive, dead, verified, agg, usd] = await Promise.all([
    prisma.box.count({ where: visible }),
    prisma.box.count({ where: { ...visible, state: 'SEALED' } }),
    prisma.box.count({ where: { ...visible, state: 'COLLAPSED' } }),
    prisma.box.count({ where: { ...visible, state: 'COLLAPSED', fate: 'ALIVE' } }),
    prisma.box.count({ where: { ...visible, state: 'COLLAPSED', fate: 'DEAD' } }),
    prisma.box.count({ where: { ...visible, state: 'COLLAPSED', verifiedOnChain: true } }),
    prisma.box.aggregate({ where: visible, _sum: { holdersPaid: true, creatorPaid: true, buybackSpent: true, tokensBurned: true } }),
    solPriceUsd(),
  ]);
  return {
    boxes, sealed, collapsed, alive, dead, verified,
    paidOutSol: lamports(agg._sum.holdersPaid ?? 0n), creatorPaidSol: lamports(agg._sum.creatorPaid ?? 0n),
    burnedSol: lamports(agg._sum.buybackSpent ?? 0n), tokensBurned: Number(agg._sum.tokensBurned ?? 0n) / 1e6, solUsd: usd,
  };
}

export async function boxDetail(mint: string) {
  const b = await prisma.box.findUnique({ where: { mint } });
  if (!b || b.state === 'LAUNCHING' || b.state === 'FAILED') return null;
  const [summary] = await summaries([b]);
  const collapsed = b.state === 'COLLAPSED';
  const [payouts, burns, trades, allocations] = await Promise.all([
    prisma.payout.findMany({ where: { boxId: b.id }, orderBy: { createdAt: 'desc' }, take: 60 }),
    prisma.burn.findMany({ where: { boxId: b.id }, orderBy: { createdAt: 'desc' }, take: 30 }),
    prisma.trade.findMany({ where: { boxId: b.id }, orderBy: { at: 'desc' }, take: 25 }),
    prisma.feeAllocation.findMany({ where: { boxId: b.id }, include: { collection: true }, orderBy: { at: 'desc' }, take: 20 }),
  ]);
  const link = (s: string | null) => (s && !s.startsWith('test-') ? solscan.tx(s) : null);
  return {
    ...summary,
    cluster, pumpUrl: b.mint ? pumpUrl(b.mint) : null, launcher: launcherAddress(),
    commitment: b.commitment, commitSig: b.commitSig, commitUrl: link(b.commitSig), commitCluster: b.commitCluster,
    seed: collapsed ? b.seed : null,
    seedProvider: b.seedProvider, seedRequestId: b.seedRequestId, seedSourceTime: b.seedSourceTime, seedFetchedAt: b.seedFetchedAt, seedNote: b.seedNote,
    launchUrl: link(b.launchSig), observer: b.observerWallet, observeUrl: link(b.observeSig), observedAt: b.observedAt, collapseReason: b.collapseReason,
    lore: collapsed ? b.lore : null, traits: collapsed ? b.traits : null, verifiedAt: b.verifiedAt,
    fees: {
      accruedSol: lamports(b.feesAccrued), collectedSol: lamports(b.feesAllocated), creatorPaidSol: lamports(b.creatorPaid), holdersPaidSol: lamports(b.holdersPaid),
      buybackSol: lamports(b.buybackSpent), tokensBurned: Number(b.tokensBurned) / 1e6, pendingSol: lamports(b.pendingCreator + b.pendingPool),
      creatorSharePercent: env.CREATOR_FEE_SHARE_PERCENT,
    },
    payouts: payouts.map((p) => ({ kind: p.kind, wallet: p.wallet, sol: lamports(p.lamports), status: p.status, url: link(p.sig), at: p.paidAt ?? p.createdAt })),
    burns: burns.map((x) => ({ sol: lamports(x.lamports), tokens: Number(x.tokens) / 1e6, status: x.status, buyUrl: link(x.buySig), burnUrl: link(x.burnSig), at: x.doneAt ?? x.createdAt })),
    trades: trades.map((t) => ({ wallet: t.wallet, isBuy: t.isBuy, sol: lamports(t.solAmount), at: t.at, url: link(t.sig) })),
    collections: allocations.map((a) => ({ sol: lamports(a.lamports), creator: lamports(a.creatorShare), pool: lamports(a.poolShare), url: link(a.collection.sig), at: a.at })),
  };
}
export type BoxDetail = NonNullable<Awaited<ReturnType<typeof boxDetail>>>;

// Creator-fee collection. pump.fun pools a creator's fees across all coins it launched, so the
// SOL actually received is split across boxes in proportion to the creator fees each box earned
// (from its own trade events) and not yet matched. Nothing is credited beyond what arrived.
import { prisma } from './db';
import { env } from './env';
import { collectCreatorFees } from './pump';
import { withLease } from './lease';
import { log } from './log';

export function splitShare(lamports: bigint) {
  const creator = (lamports * BigInt(Math.round(env.CREATOR_FEE_SHARE_PERCENT * 100))) / 10_000n;
  return { creator, pool: lamports - creator };
}

/** Allocates `received` lamports across boxes by unmatched accrued fees. Pure, for tests too. */
export function allocate(received: bigint, unmatched: { id: string; lamports: bigint }[]) {
  const total = unmatched.reduce((a, b) => a + b.lamports, 0n);
  const out: { id: string; lamports: bigint }[] = [];
  if (total <= 0n || received <= 0n) return { out, unattributed: received };
  let used = 0n;
  for (const u of unmatched) {
    const l = received >= total ? u.lamports : (received * u.lamports) / total;
    if (l > 0n) { out.push({ id: u.id, lamports: l }); used += l; }
  }
  return { out, unattributed: received - used };
}

export async function collectAndAllocate() {
  const res = await withLease('fees', 600, async () => {
    const boxes = await prisma.box.findMany({ where: { state: { in: ['SEALED', 'COLLAPSING', 'COLLAPSED'] } }, select: { id: true, feesAccrued: true, feesAllocated: true } });
    const unmatched = boxes.map((b) => ({ id: b.id, lamports: b.feesAccrued - b.feesAllocated })).filter((u) => u.lamports > 0n);
    const owed = unmatched.reduce((a, b) => a + b.lamports, 0n);
    // TEST_MODE: the stand-in collection returns exactly what the simulated trades accrued.
    const got = await collectCreatorFees(env.TEST_MODE ? owed : 0n);
    if (!got || got.lamports <= 0n) return 'nothing to collect';
    const { out, unattributed } = allocate(got.lamports, unmatched);
    await prisma.$transaction(async (tx) => {
      const col = await tx.feeCollection.create({ data: { sig: got.sig, lamports: got.lamports, unattributed, test: env.TEST_MODE } });
      for (const a of out) {
        const { creator, pool } = splitShare(a.lamports);
        await tx.feeAllocation.create({ data: { collectionId: col.id, boxId: a.id, lamports: a.lamports, creatorShare: creator, poolShare: pool } });
        await tx.box.update({ where: { id: a.id }, data: { feesAllocated: { increment: a.lamports }, pendingCreator: { increment: creator }, pendingPool: { increment: pool } } });
      }
    });
    const msg = `collected ${Number(got.lamports) / 1e9} SOL (${got.sig}) across ${out.length} boxes, ${Number(unattributed) / 1e9} SOL unattributed`;
    await log('fees', msg);
    return msg;
  });
  return res.ran ? res.value : 'busy';
}

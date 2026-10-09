// Observation collapses the box: the committed seed is revealed and decides the identity.
import { prisma } from './db';
import { env, rpcUrl } from './env';
import { deriveIdentity } from './identity';
import { renderCollapsed } from './art';
import { verifyCollapse } from './verify';
import { log } from './log';

export async function collapseBox(boxId: string, reason: 'FIRST_BUY' | 'DECOHERENCE', observer?: { wallet: string; sig: string; at: Date }) {
  // Only one caller can move a box out of SEALED.
  const claimed = await prisma.box.updateMany({
    where: { id: boxId, state: 'SEALED' },
    data: { state: 'COLLAPSING', collapseReason: reason, observerWallet: observer?.wallet ?? null, observeSig: observer?.sig ?? null, observedAt: observer?.at ?? new Date() },
  });
  if (claimed.count === 0) return null;
  const box = await prisma.box.findUniqueOrThrow({ where: { id: boxId } });
  // test boxes are never real tokens, so they always collapse Dead
  const id = deriveIdentity(box.seed, box.test ? 0 : env.ALIVE_ODDS_PERCENT);
  const art = await renderCollapsed(id);
  // Re-check the reveal against the memo actually on chain before calling it verified.
  let verified = false;
  if (box.commitSig && !box.commitSig.startsWith('test-')) {
    try {
      verified = (await verifyCollapse({ seedHex: box.seed, commitment: box.commitment, number: box.number, commitSig: box.commitSig, rpcUrl: rpcUrl() })).ok;
    } catch (e) {
      await log('collapse', `box #${box.number}: on-chain verify failed to run: ${(e as Error).message}`, 'warn');
    }
  }
  const done = await prisma.box.update({
    where: { id: boxId },
    data: {
      state: 'COLLAPSED', collapsedAt: new Date(), name: id.name, rarity: id.rarity, rarityRoll: id.rarityRoll, fate: id.fate, lore: id.lore,
      traits: id.traits, art, verifiedOnChain: verified, verifiedAt: verified ? new Date() : null,
    },
  });
  await log('collapse', `box #${box.number} collapsed (${reason}${observer ? ` by ${observer.wallet}` : ''}): ${id.name}, ${id.fate}, ${id.rarity}, on-chain verified ${verified}`);
  return done;
}

/** Boxes nobody bought within DECOHERENCE_MINUTES collapse on their own. */
export async function decohere() {
  const due = await prisma.box.findMany({ where: { state: 'SEALED', decoheresAt: { lte: new Date() } }, select: { id: true } });
  let n = 0;
  for (const b of due) if (await collapseBox(b.id, 'DECOHERENCE')) n++;
  return n;
}

// Launching a boxed coin. Order matters for fairness: the quantum seed is fetched and its
// SHA-256 is written on-chain (memo) BEFORE the coin exists, so nobody, us included, can pick
// an outcome after seeing who buys.
import { prisma } from './db';
import { env, boxName, cluster } from './env';
import { quantumSeed, markSeedUsed } from './qrng';
import { commitmentOf, commitMemo } from './verify';
import { memoIx, sendFromLauncher, launcher } from './solana';
import { renderSealed } from './art';
import { uploadMetadata, createCoin } from './pump';
import { log } from './log';

export const TICKER_RE = /^[A-Z0-9]{2,10}$/;

/** Writes the commitment memo from the launcher wallet (devnet in TEST_MODE, mainnet otherwise). */
export async function writeCommitment(n: number, commitment: string): Promise<string> {
  const kp = launcher();
  return sendFromLauncher([memoIx(commitMemo(n, commitment), kp.publicKey)]);
}

export async function launchBox(o: { ticker: string; creatorWallet: string; intentId?: string }) {
  const ticker = o.ticker.toUpperCase();
  if (!TICKER_RE.test(ticker)) throw new Error('Ticker must be 2-10 letters or digits.');
  const s = await quantumSeed();
  const seedHex = s.seed.toString('hex');
  const commitment = await commitmentOf(seedHex);
  const box = await prisma.box.create({
    data: {
      ticker, creatorWallet: o.creatorWallet, test: env.TEST_MODE, state: 'LAUNCHING',
      seed: seedHex, commitment, seedSource: s.source, seedProvider: s.provider, seedRequestId: s.requestId,
      seedSourceTime: s.sourceTime, seedFetchedAt: s.fetchedAt, seedNote: s.note, commitCluster: cluster,
    },
  });
  if (s.source === 'QUANTUM') await markSeedUsed(seedHex, box.number);
  await log('launch', `box #${box.number} ${ticker}: seed from ${s.source === 'QUANTUM' ? s.provider : 'CLASSICAL FALLBACK'}${s.note ? ` (${s.note})` : ''}`);
  try {
    const commitSig = await writeCommitment(box.number, commitment);
    await prisma.box.update({ where: { id: box.id }, data: { commitSig } });
    const name = boxName(box.number);
    const image = await renderSealed();
    const uri = await uploadMetadata({
      name, symbol: ticker, image,
      description: `${name}. Sealed. The first buy opens it; quantum randomness decides what it becomes. Commitment sha256:${commitment}`,
      website: env.PUBLIC_URL ? `${env.PUBLIC_URL}/box/pending` : undefined,
    });
    const { mint, sig } = await createCoin({ name, symbol: ticker, uri, devBuySol: env.DEV_BUY_SOL });
    const now = new Date();
    const done = await prisma.box.update({
      where: { id: box.id },
      data: { mint, launchSig: sig, metadataUri: uri, state: 'SEALED', launchedAt: now, decoheresAt: new Date(now.getTime() + env.DECOHERENCE_MINUTES * 60_000) },
    });
    await log('launch', `box #${box.number} live: ${mint} (commitment ${commitSig})`);
    return done;
  } catch (e) {
    const msg = (e as Error).message.slice(0, 300);
    await prisma.box.update({ where: { id: box.id }, data: { state: 'FAILED', launchError: msg } });
    await log('launch', `box #${box.number} failed: ${msg}`, 'error');
    throw e;
  }
}

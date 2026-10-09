// Launch payments. The user pays LAUNCH_COST_SOL to the launcher with a memo naming the intent;
// the server checks that transaction on chain before it launches anything.
import { PublicKey } from '@solana/web3.js';
import { prisma } from './db';
import { env } from './env';
import { connection, launcherAddress, lamportsOf } from './solana';
import { launchBox, TICKER_RE } from './launch';
import { memosFromTx } from './verify';
import { log } from './log';

export const intentMemo = (id: string) => `SchrodingerPad launch ${id}`;

export async function createIntent(wallet: string, ticker: string) {
  try { new PublicKey(wallet); } catch { throw new Error('Invalid wallet.'); }
  const t = ticker.trim().toUpperCase().replace(/^\$/, '');
  if (!TICKER_RE.test(t)) throw new Error('Ticker must be 2-10 letters or digits.');
  const recent = await prisma.launchIntent.count({ where: { wallet, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } } });
  if (recent > 10) throw new Error('Too many launch attempts. Try again in a few minutes.');
  const i = await prisma.launchIntent.create({ data: { wallet, ticker: t, lamports: lamportsOf(env.LAUNCH_COST_SOL) } });
  return { id: i.id, lamports: i.lamports.toString(), launcher: launcherAddress(), memo: intentMemo(i.id), ticker: t };
}

/** Verifies the payment transaction, then launches. Safe to call twice: only one call moves PAID -> LAUNCHING. */
export async function confirmIntent(id: string, sig: string) {
  const intent = await prisma.launchIntent.findUnique({ where: { id } });
  if (!intent) throw new Error('Unknown launch.');
  if (intent.status === 'LAUNCHED' && intent.boxId) return prisma.box.findUnique({ where: { id: intent.boxId } });
  if (intent.status === 'PENDING') {
    const tx = await connection().getParsedTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' });
    if (!tx || tx.meta?.err) throw new Error('Payment transaction not found or failed. Wait a few seconds and retry.');
    const memoOk = memosFromTx(tx).some((m) => m.includes(intentMemo(id)));
    const paid = tx.transaction.message.instructions.some((ix) => {
      const p = (ix as { parsed?: { type?: string; info?: { source?: string; destination?: string; lamports?: number } } }).parsed;
      return p?.type === 'transfer' && p.info?.source === intent.wallet && p.info?.destination === launcherAddress() && BigInt(p.info?.lamports ?? 0) >= intent.lamports;
    });
    if (!memoOk || !paid) throw new Error('That transaction is not the payment for this launch.');
    try {
      await prisma.launchIntent.update({ where: { id, status: 'PENDING' }, data: { status: 'PAID', paySig: sig } });
    } catch {
      throw new Error('This payment was already used.');
    }
  }
  const claim = await prisma.launchIntent.updateMany({ where: { id, status: 'PAID' }, data: { status: 'LAUNCHING' } });
  if (claim.count !== 1) {
    const now = await prisma.launchIntent.findUnique({ where: { id } });
    if (now?.boxId) return prisma.box.findUnique({ where: { id: now.boxId } });
    throw new Error('This launch is already in progress.');
  }
  try {
    const box = await launchBox({ ticker: intent.ticker, creatorWallet: intent.wallet, intentId: id });
    await prisma.launchIntent.update({ where: { id }, data: { status: 'LAUNCHED', boxId: box.id } });
    return box;
  } catch (e) {
    await prisma.launchIntent.update({ where: { id }, data: { status: 'FAILED', error: (e as Error).message.slice(0, 300) } });
    await log('launch', `intent ${id} failed after payment ${sig}: refund manually`, 'error');
    throw e;
  }
}

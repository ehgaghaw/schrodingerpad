// Admin actions. Test tools only work in TEST_MODE (devnet, fake pump.fun).
import { Keypair } from '@solana/web3.js';
import { prisma } from '@/lib/db';
import { isAdmin } from '@/lib/auth';
import { env } from '@/lib/env';
import { setKV } from '@/lib/kv';
import { launchBox } from '@/lib/launch';
import { simulateTrade } from '@/lib/observe';
import { decohere } from '@/lib/collapse';
import { snapshotAll } from '@/lib/holders';
import { collectAndAllocate } from '@/lib/fees';
import { runDistribution } from '@/lib/payouts';
import { log } from '@/lib/log';
import { json, fail, body } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const randomWallet = () => Keypair.generate().publicKey.toBase58();

export async function POST(req: Request) {
  if (!isAdmin()) return fail('unauthorized', 401);
  const b = await body<{ action?: string; boxId?: string; ticker?: string; wallet?: string; sol?: number }>(req);
  const action = String(b.action || '');
  const testOnly = action.startsWith('test-');
  if (testOnly && !env.TEST_MODE) return fail('test tools only run in TEST_MODE');
  try {
    switch (action) {
      case 'pause': await setKV('paused', '1'); await log('admin', 'payouts and burns paused'); return json({ ok: true });
      case 'resume': await setKV('paused', '0'); await log('admin', 'payouts and burns resumed'); return json({ ok: true });
      case 'run-fees': return json({ ok: true, result: await collectAndAllocate() });
      case 'run-distribution': return json({ ok: true, result: await runDistribution() });
      case 'run-snapshots': return json({ ok: true, result: await snapshotAll() });
      case 'test-launch': {
        const box = await launchBox({ ticker: String(b.ticker || 'TEST'), creatorWallet: b.wallet || randomWallet() });
        return json({ ok: true, mint: box.mint, number: box.number });
      }
      case 'test-buy': {
        const t = await simulateTrade(String(b.boxId), b.wallet || randomWallet(), Number(b.sol) || 0.5, true);
        return json({ ok: true, trade: { user: t.user, sol: Number(t.solAmount) / 1e9 } });
      }
      case 'test-sell': {
        const t = await simulateTrade(String(b.boxId), b.wallet || randomWallet(), Number(b.sol) || 0.2, false);
        return json({ ok: true, trade: { user: t.user, sol: Number(t.solAmount) / 1e9 } });
      }
      case 'test-decohere': {
        await prisma.box.update({ where: { id: String(b.boxId) }, data: { decoheresAt: new Date(Date.now() - 1000) } });
        return json({ ok: true, collapsed: await decohere() });
      }
      case 'test-holders': {
        const holders: Record<string, string> = {};
        for (let i = 0; i < 6; i++) holders[randomWallet()] = String(Math.floor(1e6 + Math.random() * 5e12));
        await setKV(`testHolders:${b.boxId}`, JSON.stringify(holders));
        return json({ ok: true, holders: Object.keys(holders).length, snapshots: await snapshotAll() });
      }
      default: return fail('unknown action');
    }
  } catch (e) {
    return fail((e as Error).message.slice(0, 300), 500);
  }
}

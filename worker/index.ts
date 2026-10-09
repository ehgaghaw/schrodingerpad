// SchrodingerPad worker: one long-running process.
//   observe     every 5 s    new pump.fun trades per box (first buy collapses it)
//   decohere    every 15 s   sealed boxes past DECOHERENCE_MINUTES collapse on their own
//   snapshots   every 5 min  holder balances of Alive coins (60-minute average)
//   fees        every FEE_CYCLE_MINUTES (10)  collect creator fees, allocate per box
//   distribute  right after fees              creator share, holder payouts, buyback + burn
//   qrng        every 70 s   keep a pool of pre-fetched quantum seeds (ANU allows ~1 request/min)
//   x           every 30 s   post new collapses (X_POSTING=true only)
import { pollAll } from '../src/lib/observe';
import { decohere } from '../src/lib/collapse';
import { snapshotAll } from '../src/lib/holders';
import { collectAndAllocate } from '../src/lib/fees';
import { runDistribution } from '../src/lib/payouts';
import { postPendingCollapses } from '../src/lib/xpost';
import { refillQuantumPool } from '../src/lib/qrng';
import { env, cluster } from '../src/lib/env';
import { launcherAddress } from '../src/lib/solana';
import { log } from '../src/lib/log';

const busy = new Set<string>();
function every(name: string, ms: number, fn: () => Promise<unknown>, quiet = true) {
  const run = async () => {
    if (busy.has(name)) return;
    busy.add(name);
    try {
      const r = await fn();
      if (!quiet && r) console.log(`[${name}] ${r}`);
    } catch (e) {
      await log(name, (e as Error).message.slice(0, 300), 'error');
    } finally { busy.delete(name); }
  };
  setTimeout(run, 2_000);
  setInterval(run, ms);
}

console.log(`[worker] SchrodingerPad on ${cluster}${env.TEST_MODE ? ' (TEST_MODE)' : ''}, launcher ${launcherAddress() || 'NOT SET'}`);
every('observe', 5_000, pollAll);
every('decohere', 15_000, decohere);
every('snapshots', 5 * 60_000, snapshotAll);
every('fees', env.FEE_CYCLE_MINUTES * 60_000, async () => `${await collectAndAllocate()} / ${await runDistribution()}`, false);
every('qrng', 70_000, refillQuantumPool, false);
every('x', 30_000, postPendingCollapses);

import { prisma } from '@/lib/db';
import { stats } from '@/lib/public';
import { env } from '@/lib/env';

export const metadata = { title: 'Analytics' };
export const dynamic = 'force-dynamic';

function Bar({ label, value, total }: { label: string; value: number; total: number }) {
  const w = total ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm"><span>{label}</span><span className="mono text-mute">{value}</span></div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line2"><div className="h-full rounded-full bg-white" style={{ width: `${w}%` }} /></div>
    </div>
  );
}

export default async function Analytics() {
  const s = await stats();
  const visible = { test: env.TEST_MODE ? undefined : false };
  const [byRarity, bySource, byReason, perDay] = await Promise.all([
    prisma.box.groupBy({ by: ['rarity'], where: { ...visible, state: 'COLLAPSED' }, _count: true }),
    prisma.box.groupBy({ by: ['seedSource'], where: { ...visible, state: { in: ['SEALED', 'COLLAPSED'] } }, _count: true }),
    prisma.box.groupBy({ by: ['collapseReason'], where: { ...visible, state: 'COLLAPSED' }, _count: true }),
    prisma.$queryRawUnsafe<{ d: Date; n: bigint }[]>(`SELECT date_trunc('day', "collapsedAt") AS d, count(*) AS n FROM "Box" WHERE "collapsedAt" > now() - interval '14 days' ${env.TEST_MODE ? '' : 'AND "test" = false'} GROUP BY 1 ORDER BY 1`),
  ]);
  const count = <T extends { _count: number }>(list: T[], f: (x: T) => boolean) => list.filter(f).reduce((a, b) => a + b._count, 0);
  const maxDay = Math.max(1, ...perDay.map((p) => Number(p.n)));
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Boxes launched', String(s.boxes)], ['Collapses verified on-chain', String(s.verified)],
          ['Paid to holders', `${s.paidOutSol.toFixed(4)} SOL`], ['Paid to creators', `${s.creatorPaidSol.toFixed(4)} SOL`],
          ['Spent on buybacks', `${s.burnedSol.toFixed(4)} SOL`], ['Tokens burned', s.tokensBurned.toLocaleString()], ['Alive', String(s.alive)], ['Dead', String(s.dead)],
        ].map(([k, v]) => <div key={k} className="card p-4"><p className="label">{k}</p><p className="mt-1 text-2xl font-semibold">{v}</p></div>)}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="card space-y-4 p-5">
          <h2 className="text-sm font-semibold">Fate</h2>
          <Bar label="Alive" value={s.alive} total={s.collapsed} /><Bar label="Dead" value={s.dead} total={s.collapsed} />
          <h2 className="pt-2 text-sm font-semibold">Randomness</h2>
          <Bar label="Quantum" value={count(bySource, (x) => x.seedSource === 'QUANTUM')} total={s.boxes} />
          <Bar label="Classical fallback" value={count(bySource, (x) => x.seedSource === 'CLASSICAL')} total={s.boxes} />
        </section>
        <section className="card space-y-4 p-5">
          <h2 className="text-sm font-semibold">Rarity</h2>
          {(['COMMON', 'UNCOMMON', 'RARE', 'ULTRA_RARE'] as const).map((r) => <Bar key={r} label={r === 'ULTRA_RARE' ? 'Ultra rare' : r[0] + r.slice(1).toLowerCase()} value={count(byRarity, (x) => x.rarity === r)} total={s.collapsed} />)}
          <h2 className="pt-2 text-sm font-semibold">Collapsed by</h2>
          <Bar label="First buy" value={count(byReason, (x) => x.collapseReason === 'FIRST_BUY')} total={s.collapsed} />
          <Bar label="Decoherence" value={count(byReason, (x) => x.collapseReason === 'DECOHERENCE')} total={s.collapsed} />
        </section>
        <section className="card p-5">
          <h2 className="text-sm font-semibold">Collapses, last 14 days</h2>
          <div className="mt-6 flex h-40 items-end gap-1.5">
            {perDay.length === 0 && <p className="text-sm text-mute">None yet.</p>}
            {perDay.map((p) => (
              <div key={String(p.d)} className="flex-1 rounded-t bg-white/80" title={`${new Date(p.d).toDateString()}: ${p.n}`} style={{ height: `${(Number(p.n) / maxDay) * 100}%` }} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

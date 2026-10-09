'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Cpu, Dice5, Eye, Hourglass, Link2 } from 'lucide-react';
import { useJson } from './useJson';
import { Change, FateLabel, Progress, Rolling, SealedBox, Skeleton, StateLabel } from './ui';
import { CollapseReveal, Countdown } from './Collapse';
import { VerifyButton } from './Verify';
import { ago, compactUsd, rarityText, short, sol } from '@/lib/format';
import type { BoxDetail } from '@/lib/public';

const Ext = ({ href, children }: { href: string | null; children: React.ReactNode }) =>
  href ? <a href={href} target="_blank" rel="noopener" className="link inline-flex items-center gap-1">{children}<ExternalLink size={12} /></a> : <span className="text-mute">{children}</span>;

function Panel({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <motion.section className="card p-5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">{icon}{title}</h2>
      {children}
    </motion.section>
  );
}
const KV = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-4 border-b border-line py-2 text-sm last:border-0"><span className="text-mute">{k}</span><span className="text-right">{v}</span></div>
);

export function BoxView({ mint, rpc }: { mint: string; rpc: string }) {
  const { data, error } = useJson<BoxDetail>(`/api/box/${mint}`, 3000);
  const prevState = useRef<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  useEffect(() => {
    if (!data) return;
    const was = prevState.current;
    // play the collapse when we watch it happen, or when the visitor arrives within a minute of it
    if ((was && was !== 'COLLAPSED' && data.state === 'COLLAPSED') || (!was && data.state === 'COLLAPSED' && data.collapsedAt && Date.now() - new Date(data.collapsedAt).getTime() < 60_000)) setRevealing(true);
    prevState.current = data.state;
  }, [data]);
  const done = useCallback(() => setRevealing(false), []);

  if (error && !data) return <div className="mx-auto max-w-3xl px-4 py-24 text-center text-mute">{error}</div>;
  if (!data) return <div className="mx-auto max-w-6xl space-y-4 px-4 py-12"><Skeleton className="h-80" /><Skeleton className="h-40" /></div>;
  const collapsed = data.state === 'COLLAPSED';
  const mcap = data.marketCapUsd ? compactUsd(data.marketCapUsd) : sol(data.marketCapSol, 2);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="card grid place-items-center overflow-hidden p-6">
          {revealing && data.name ? <CollapseReveal art={data.image} name={data.name} onDone={done} />
            : collapsed ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={data.image} alt={data.name ?? ''} className="w-full max-w-[380px] rounded-2xl border border-line" />)
            : <SealedBox size={320} />}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2"><StateLabel state={data.state} />{collapsed && <span className="pill">{rarityText(data.rarity)}</span>}{data.test && <span className="pill">Test box (devnet)</span>}</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{collapsed && !revealing ? data.name : '???'}</h1>
          <p className="mt-1 text-mute">{data.onchainName} · ${data.ticker}</p>
          {collapsed && !revealing && <p className="mt-4 max-w-xl text-mute">{data.lore}</p>}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="card p-3"><p className="label">Fate</p><div className="mt-1 text-lg">{collapsed && !revealing ? <FateLabel fate={data.fate} /> : <span className="text-mute">Unknown</span>}</div></div>
            <div className="card p-3"><p className="label">Market cap</p><Rolling value={mcap} className="mt-1 text-lg" /></div>
            <div className="card p-3"><p className="label">24h</p><div className="mono mt-1 text-lg"><Change value={data.change24h} /></div></div>
            <div className="card p-3"><p className="label">Bonding</p><div className="mt-2"><Progress value={data.progress} /></div></div>
          </div>
          {data.state === 'SEALED' && (
            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-line p-4 text-sm">
              <Hourglass size={16} className="text-mute" />
              <span>The first buy opens this box. If nobody buys, it decoheres on its own in <b><Countdown to={data.decoheresAt as unknown as string} /></b>.</span>
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            {data.pumpUrl && !data.test && <a href={data.pumpUrl} target="_blank" rel="noopener" className="btn-primary">Buy on pump.fun <ExternalLink size={14} /></a>}
            {data.mint && <a href={`https://solscan.io/token/${data.mint}${data.cluster === 'devnet' ? '?cluster=devnet' : ''}`} target="_blank" rel="noopener" className="btn">Token on Solscan <ExternalLink size={14} /></a>}
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Panel title="Fairness: commit and reveal" icon={<Link2 size={15} />}>
          <KV k="Commitment (sha256 of the seed)" v={<span className="mono break-all">{data.commitment}</span>} />
          <KV k="Commitment on-chain" v={<Ext href={data.commitUrl}>{data.commitSig ? short(data.commitSig, 6) : 'pending'}</Ext>} />
          <KV k="Network" v={data.commitCluster} />
          <KV k="Revealed seed" v={<span className="mono break-all">{data.seed ?? 'hidden until the box collapses'}</span>} />
          {collapsed && data.seed && <div className="mt-4"><VerifyButton seed={data.seed} commitment={data.commitment} number={data.number} commitSig={data.commitUrl ? data.commitSig : null} rpc={rpc} /></div>}
        </Panel>
        <Panel title="Randomness source" icon={data.seedSource === 'QUANTUM' ? <Cpu size={15} /> : <Dice5 size={15} />}>
          <KV k="Source" v={data.seedSource === 'QUANTUM' ? 'Quantum random number generator' : 'Classical fallback (not quantum)'} />
          <KV k="Provider" v={data.seedProvider} />
          <KV k="Source timestamp" v={<span className="mono">{data.seedSourceTime ?? '-'}</span>} />
          <KV k="Request id" v={<span className="mono break-all">{data.seedRequestId}</span>} />
          {data.seedNote && <p className="mt-3 text-xs text-mute">{data.seedNote}</p>}
        </Panel>
        <Panel title="Observation" icon={<Eye size={15} />}>
          {data.collapseReason ? (
            <>
              <KV k="Collapsed by" v={data.collapseReason === 'FIRST_BUY' ? 'the first buy' : 'decoherence (no buy in time)'} />
              {data.observer && <KV k="Observer" v={<span className="mono">{short(data.observer, 6)}</span>} />}
              {data.observeUrl && <KV k="Observing trade" v={<Ext href={data.observeUrl}>view</Ext>} />}
              <KV k="When" v={`${ago(data.observedAt)} ago`} />
              <KV k="Checked against chain at collapse" v={data.verifiedOnChain ? 'yes, matched' : 'not checked (test box)'} />
            </>
          ) : <p className="text-sm text-mute">Still sealed. Nobody has looked inside yet.</p>}
        </Panel>
        <Panel title="Fees">
          <KV k="Creator fees earned (trade events)" v={sol(data.fees.accruedSol, 6)} />
          <KV k="Collected so far" v={sol(data.fees.collectedSol, 6)} />
          <KV k={`To the creator (${data.fees.creatorSharePercent}%)`} v={sol(data.fees.creatorPaidSol, 6)} />
          {data.fate === 'DEAD' ? <KV k="Bought back and burned" v={`${sol(data.fees.buybackSol, 6)} · ${data.fees.tokensBurned.toLocaleString()} tokens`} /> : <KV k="Paid to holders" v={sol(data.fees.holdersPaidSol, 6)} />}
          <KV k="Waiting for the next cycle" v={sol(data.fees.pendingSol, 6)} />
        </Panel>
      </div>

      {(data.payouts.length > 0 || data.burns.length > 0) && (
        <section className="card mt-6 overflow-hidden">
          <h2 className="border-b border-line p-5 text-sm font-semibold">{data.fate === 'DEAD' ? 'Buybacks and burns' : 'Payouts'}</h2>
          <div className="divide-y divide-line text-sm">
            {data.burns.map((b, i) => (
              <div key={`b${i}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <span>{sol(b.sol, 6)} bought back, {b.tokens.toLocaleString()} tokens burned</span>
                <span className="flex gap-3"><Ext href={b.buyUrl}>buy</Ext><Ext href={b.burnUrl}>burn</Ext><span className="text-mute">{b.status.toLowerCase()}</span></span>
              </div>
            ))}
            {data.payouts.map((p, i) => (
              <div key={`p${i}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <span><span className="mono">{short(p.wallet, 5)}</span> <span className="text-mute">{p.kind === 'CREATOR' ? 'creator' : 'holder'}</span></span>
                <span className="flex gap-3">{sol(p.sol, 6)}<Ext href={p.url}>tx</Ext><span className="text-mute">{p.status.toLowerCase()}</span></span>
              </div>
            ))}
          </div>
        </section>
      )}
      {data.trades.length > 0 && (
        <section className="card mt-6 overflow-hidden">
          <h2 className="border-b border-line p-5 text-sm font-semibold">Recent trades</h2>
          <div className="divide-y divide-line text-sm">
            {data.trades.map((t, i) => (
              <div key={i} className="flex items-center justify-between gap-2 px-5 py-2.5">
                <span className={t.isBuy ? 'text-up' : 'text-down'}>{t.isBuy ? 'Buy' : 'Sell'}</span>
                <span className="mono text-mute">{short(t.wallet, 5)}</span>
                <span>{sol(t.sol, 4)}</span>
                <span className="text-mute">{ago(t.at)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

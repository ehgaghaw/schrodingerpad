'use client';
import Link from 'next/link';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutGrid, List } from 'lucide-react';
import { useJson } from './useJson';
import { Change, FateLabel, Progress, Rolling, Skeleton, Sparkline, StateLabel } from './ui';
import { ago, compactUsd, short, sol } from '@/lib/format';
import type { BoxSummary } from '@/lib/public';

const TABS = [
  ['sealed', 'Sealed'], ['collapsing', 'Collapsing'], ['alive', 'Alive'], ['dead', 'Dead'], ['mcap', 'Market cap'], ['new', 'New'],
] as const;

const mcap = (b: BoxSummary) => (b.marketCapUsd ? compactUsd(b.marketCapUsd) : sol(b.marketCapSol, 2));

function TokenCell({ b }: { b: BoxSummary }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={b.image} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-line bg-black" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{b.name ?? b.onchainName}</p>
        <p className="mono truncate text-mute">${b.ticker} · {short(b.creator)} · {ago(b.launchedAt)}</p>
      </div>
    </div>
  );
}

function Row({ b, i }: { b: BoxSummary; i: number }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
      <Link href={b.mint ? `/box/${b.mint}` : '#'}
        className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-line px-4 py-3 transition hover:-translate-y-px hover:bg-card md:grid-cols-[2rem_minmax(0,2.4fr)_1fr_1fr_7rem_1fr_9rem]">
        <span className="mono hidden text-mute md:block">{i + 1}</span>
        <TokenCell b={b} />
        <span className="hidden md:block"><StateLabel state={b.state} /></span>
        <span className="hidden md:block"><FateLabel fate={b.fate} /></span>
        <span className="hidden md:block"><Sparkline points={b.spark} /></span>
        <span className="text-right md:text-left">
          <span className="block text-sm"><Rolling value={mcap(b)} /></span>
          <span className="mono block"><Change value={b.change24h} /></span>
        </span>
        <span className="hidden md:block"><Progress value={b.progress} /></span>
      </Link>
    </motion.div>
  );
}

function Card({ b }: { b: BoxSummary }) {
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} whileHover={{ y: -3 }} transition={{ duration: 0.3 }}>
      <Link href={b.mint ? `/box/${b.mint}` : '#'} className="card block overflow-hidden transition hover:border-white/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={b.image} alt="" className="aspect-square w-full border-b border-line object-cover" />
        <div className="space-y-2 p-4">
          <div className="flex items-center justify-between gap-2"><p className="truncate font-medium">{b.name ?? b.onchainName}</p><StateLabel state={b.state} /></div>
          <div className="flex items-center justify-between"><span className="mono text-mute">${b.ticker}</span><FateLabel fate={b.fate} /></div>
          <div className="flex items-center justify-between"><Rolling value={mcap(b)} className="text-sm" /><span className="mono"><Change value={b.change24h} /></span></div>
          <Progress value={b.progress} />
        </div>
      </Link>
    </motion.div>
  );
}

export function TokenTable({ initialFilter = 'new' }: { initialFilter?: (typeof TABS)[number][0] }) {
  const [filter, setFilter] = useState<string>(initialFilter);
  const [take, setTake] = useState(25);
  const [view, setView] = useState<'list' | 'grid'>('list');
  const { data } = useJson<{ boxes: BoxSummary[]; total: number }>(`/api/boxes?filter=${filter}&take=${take}`, 5000);
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-card p-1">
          {TABS.map(([k, label]) => (
            <button key={k} onClick={() => { setFilter(k); setTake(25); }} className={`relative rounded-lg px-3 py-1.5 text-sm transition ${filter === k ? 'text-black' : 'text-mute hover:text-ink'}`}>
              {filter === k && <motion.span layoutId="tab" className="absolute inset-0 rounded-lg bg-white" transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }} />}
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-1 rounded-xl border border-line bg-card p-1">
          <button aria-label="List" onClick={() => setView('list')} className={`rounded-lg p-1.5 ${view === 'list' ? 'bg-white text-black' : 'text-mute'}`}><List size={16} /></button>
          <button aria-label="Grid" onClick={() => setView('grid')} className={`rounded-lg p-1.5 ${view === 'grid' ? 'bg-white text-black' : 'text-mute'}`}><LayoutGrid size={16} /></button>
        </div>
      </div>
      {!data ? (
        <div className="card space-y-3 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : data.boxes.length === 0 ? (
        <div className="card p-10 text-center text-mute">No boxes here yet.</div>
      ) : view === 'list' ? (
        <div className="card overflow-hidden">
          <div className="label hidden grid-cols-[2rem_minmax(0,2.4fr)_1fr_1fr_7rem_1fr_9rem] gap-4 border-b border-line px-4 py-3 md:grid">
            <span>#</span><span>Token</span><span>State</span><span>Fate</span><span>Graph</span><span>Market cap</span><span>Bonding</span>
          </div>
          <AnimatePresence initial={false}>{data.boxes.map((b, i) => <Row key={b.number} b={b} i={i} />)}</AnimatePresence>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <AnimatePresence initial={false}>{data.boxes.map((b) => <Card key={b.number} b={b} />)}</AnimatePresence>
        </div>
      )}
      {data && data.total > data.boxes.length && (
        <div className="mt-5 flex justify-center"><button className="btn" onClick={() => setTake(take + 25)}>Show more</button></div>
      )}
    </section>
  );
}

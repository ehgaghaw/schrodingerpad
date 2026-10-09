'use client';
import Link from 'next/link';
import { useJson } from './useJson';
import { Change, Skeleton } from './ui';
import { compactUsd, sol } from '@/lib/format';
import type { BoxSummary } from '@/lib/public';

function Item({ b, rank }: { b: BoxSummary; rank: number }) {
  return (
    <Link href={b.mint ? `/box/${b.mint}` : '#'} className="flex shrink-0 items-center gap-3 rounded-xl border border-line bg-card px-3 py-2 transition hover:-translate-y-0.5 hover:border-white/20">
      <span className="mono w-4 text-mute">{rank}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={b.image} alt="" className="h-8 w-8 rounded-lg border border-line" />
      <div className="min-w-0">
        <p className="max-w-[140px] truncate text-sm font-medium">{b.name ?? `Box #${b.number}`}</p>
        <p className="mono text-mute">{b.marketCapUsd ? compactUsd(b.marketCapUsd) : sol(b.marketCapSol, 1)}</p>
      </div>
      <span className="mono"><Change value={b.change24h} /></span>
    </Link>
  );
}

export function TrendingStrip() {
  const { data } = useJson<BoxSummary[]>('/api/trending', 15000);
  return (
    <div className="border-b border-line">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <span className="label shrink-0">Trending</span>
        <div className="marquee-wrap relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_4%,#000_96%,transparent)]">
          {!data ? (
            <div className="flex gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-52 shrink-0" />)}</div>
          ) : data.length === 0 ? (
            <p className="text-sm text-mute">No boxes yet. Be the first to open one.</p>
          ) : (
            <div className="marquee gap-3 pr-3">
              {[...data, ...data].map((b, i) => <Item key={i} b={b} rank={(i % data.length) + 1} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

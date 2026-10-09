'use client';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { useJson } from './useJson';
import { Rolling, Skeleton } from './ui';

type S = { boxes: number; sealed: number; collapsed: number; alive: number; dead: number; verified: number; paidOutSol: number; burnedSol: number };

export function Stats() {
  const { data } = useJson<S>('/api/stats', 6000);
  const items: [string, string][] = data
    ? [
        ['Boxes', String(data.boxes)],
        ['Sealed now', String(data.sealed)],
        ['Paid to holders', `${data.paidOutSol.toFixed(3)} SOL`],
        ['Bought back and burned', `${data.burnedSol.toFixed(3)} SOL`],
      ]
    : [];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <motion.div className="card flex items-center gap-3 p-4 lg:col-span-1" whileHover={{ y: -2 }}>
        <ShieldCheck size={18} className="text-mute" />
        <div>
          <p className="label">Collapses verified</p>
          {data ? <Rolling value={String(data.verified)} className="text-2xl font-semibold" /> : <Skeleton className="mt-1 h-7 w-12" />}
        </div>
      </motion.div>
      {(data ? items : Array.from({ length: 4 }, () => ['', ''] as [string, string])).map(([k, v], i) => (
        <motion.div key={i} className="card p-4" whileHover={{ y: -2 }}>
          <p className="label">{k || ' '}</p>
          {data ? <Rolling value={v} className="text-2xl font-semibold" /> : <Skeleton className="mt-1 h-7 w-20" />}
        </motion.div>
      ))}
    </div>
  );
}

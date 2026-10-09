'use client';
// Animated, monochrome diagrams for /tech. Subtle and slow; static under reduced motion.
import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const stroke = { stroke: '#fff', strokeWidth: 1.5, fill: 'none' } as const;

/** 1. A photon hits a beam splitter; each detector click is one bit. */
export function QrngDiagram() {
  const reduce = useReducedMotion();
  const [bits, setBits] = useState<string>('');
  useEffect(() => {
    if (reduce) { setBits('1011001110100101'); return; }
    const i = setInterval(() => setBits((b) => (b + (Math.random() < 0.5 ? '0' : '1')).slice(-24)), 450);
    return () => clearInterval(i);
  }, [reduce]);
  return (
    <svg viewBox="0 0 520 200" className="w-full">
      <rect x="20" y="85" width="70" height="30" rx="6" {...stroke} />
      <text x="55" y="135" fill="#8a8a8a" fontSize="11" textAnchor="middle">light source</text>
      <line x1="90" y1="100" x2="250" y2="100" stroke="#262626" strokeWidth="1.5" />
      <rect x="240" y="80" width="40" height="40" {...stroke} transform="rotate(45 260 100)" />
      <text x="260" y="150" fill="#8a8a8a" fontSize="11" textAnchor="middle">beam splitter</text>
      <line x1="260" y1="100" x2="440" y2="100" stroke="#262626" strokeWidth="1.5" />
      <line x1="260" y1="100" x2="260" y2="20" stroke="#262626" strokeWidth="1.5" />
      <rect x="440" y="85" width="50" height="30" rx="6" {...stroke} /><text x="465" y="104" fill="#fff" fontSize="12" textAnchor="middle">0</text>
      <rect x="235" y="0" width="50" height="22" rx="6" {...stroke} /><text x="260" y="15" fill="#fff" fontSize="12" textAnchor="middle">1</text>
      {!reduce && <motion.circle r="4" fill="#fff" animate={{ cx: [90, 260, 260, 440], cy: [100, 100, 100, 100], opacity: [1, 1, 1, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }} />}
      {!reduce && <motion.circle r="4" fill="#fff" animate={{ cx: [90, 260, 260], cy: [100, 100, 22], opacity: [1, 1, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'linear', delay: 0.9 }} />}
      <text x="20" y="190" fill="#8a8a8a" fontSize="12" fontFamily="monospace">{bits}</text>
    </svg>
  );
}

/** 2. The box holds both outcomes until it is observed. */
export function SuperpositionDiagram() {
  const reduce = useReducedMotion();
  const [observed, setObserved] = useState(false);
  useEffect(() => {
    if (reduce) return;
    const i = setInterval(() => setObserved((o) => !o), 3200);
    return () => clearInterval(i);
  }, [reduce]);
  return (
    <svg viewBox="0 0 520 200" className="w-full">
      <path d="M200 30 L260 60 L260 140 L200 170 L140 140 L140 60 Z M140 60 L200 90 L260 60 M200 90 V170" {...stroke} />
      <motion.text x="200" y="125" fill="#22c55e" fontSize="14" textAnchor="middle" animate={{ opacity: observed ? 1 : [0.25, 0.7, 0.25] }} transition={{ duration: 1.6, repeat: observed ? 0 : Infinity }}>Alive</motion.text>
      <motion.text x="200" y="145" fill="#ef4444" fontSize="14" textAnchor="middle" animate={{ opacity: observed ? 0 : [0.7, 0.25, 0.7] }} transition={{ duration: 1.6, repeat: observed ? 0 : Infinity }}>Dead</motion.text>
      <line x1="300" y1="100" x2="440" y2="100" stroke="#262626" strokeWidth="1.5" strokeDasharray="4 6" />
      <motion.circle cx="440" cy="100" r="16" {...stroke} animate={{ scale: observed ? 1.15 : 1 }} />
      <circle cx="440" cy="100" r="5" fill="#fff" />
      <text x="440" y="140" fill="#8a8a8a" fontSize="11" textAnchor="middle">first buy</text>
      <text x="200" y="195" fill="#8a8a8a" fontSize="11" textAnchor="middle">{observed ? 'observed: one outcome' : 'sealed: both outcomes'}</text>
    </svg>
  );
}

/** 3. Commit at launch, reveal at collapse, anyone can check. */
export function CommitRevealDiagram() {
  const reduce = useReducedMotion();
  const steps = [['Quantum seed', 'fetched at launch, kept secret'], ['sha256(seed)', 'written to Solana in a memo'], ['First buy', 'nobody can change the seed now'], ['Reveal', 'seed published on the coin page'], ['Verify', 'your browser hashes it and reads the memo']];
  const [active, setActive] = useState(reduce ? steps.length - 1 : 0);
  useEffect(() => {
    if (reduce) return;
    const i = setInterval(() => setActive((a) => (a + 1) % steps.length), 1500);
    return () => clearInterval(i);
  }, [reduce, steps.length]);
  return (
    <div className="relative space-y-2 pl-6">
      <div className="absolute bottom-3 left-[7px] top-3 w-px bg-line2" />
      <motion.div className="absolute left-[7px] top-3 w-px bg-white" animate={{ height: `calc(${(active / (steps.length - 1)) * 100}% - 24px)` }} transition={{ duration: 0.5 }} />
      {steps.map(([t, d], i) => (
        <motion.div key={t} className="relative flex items-start gap-4 rounded-xl border p-3" animate={{ borderColor: i <= active ? 'rgba(255,255,255,.35)' : '#1a1a1a', opacity: i <= active ? 1 : 0.45 }} transition={{ duration: 0.4 }}>
          <motion.span className="absolute -left-[22px] top-4 h-2.5 w-2.5 rounded-full border border-white" animate={{ backgroundColor: i <= active ? '#ffffff' : '#000000' }} />
          <p className="mono w-6 shrink-0 pt-0.5 text-mute">{String(i + 1).padStart(2, '0')}</p>
          <div><p className="text-sm font-medium">{t}</p><p className="mt-0.5 text-xs text-mute">{d}</p></div>
        </motion.div>
      ))}
    </div>
  );
}

/** 5. Fees: trades -> creator fees -> creator share + Alive payouts or Dead buyback-and-burn. */
export function FeesDiagram({ creatorShare }: { creatorShare: number }) {
  const reduce = useReducedMotion();
  const flow = (d: string, delay = 0) => (
    <motion.path d={d} stroke="#fff" strokeWidth="1.5" fill="none" strokeDasharray="5 7" animate={reduce ? undefined : { strokeDashoffset: [24, 0] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear', delay }} />
  );
  const box = (x: number, y: number, w: number, label: string, sub: string) => (
    <g><rect x={x} y={y} width={w} height="44" rx="8" {...stroke} /><text x={x + w / 2} y={y + 20} fill="#fff" fontSize="12" textAnchor="middle">{label}</text><text x={x + w / 2} y={y + 35} fill="#8a8a8a" fontSize="10" textAnchor="middle">{sub}</text></g>
  );
  return (
    <svg viewBox="0 0 600 240" className="w-full">
      {box(10, 98, 110, 'Trades', 'pump.fun')}
      {box(170, 98, 120, 'Creator fees', 'collected every 10 min')}
      {box(350, 20, 120, 'Creator', `${creatorShare}% of the fees`)}
      {box(350, 98, 120, 'Alive', 'paid to holders')}
      {box(350, 176, 120, 'Dead', 'buy back')}
      {box(510, 176, 80, 'Burn', 'supply down')}
      {flow('M120 120 H170')}
      {flow('M290 110 C320 80 320 42 350 42', 0.2)}
      {flow('M290 120 H350', 0.4)}
      {flow('M290 130 C320 160 320 198 350 198', 0.6)}
      {flow('M470 198 H510', 0.8)}
    </svg>
  );
}

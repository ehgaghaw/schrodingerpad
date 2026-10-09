'use client';
// The collapse: the box shakes, flickers between possible identities, then snaps into the real one.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { SealedBox } from './ui';

const CANDIDATES = ['Entangled Tabby', 'Quiet Photon', 'Hollow Lynx', 'Spectral Purr', 'Folded Quark', 'Latent Sphinx', 'Velvet Boson', 'Restless Qubit', 'Silent Moggy', 'Drifting Muon'];

export function CollapseReveal({ art, name, onDone }: { art: string; name: string; onDone: () => void }) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<'shake' | 'flicker' | 'snap'>(reduce ? 'snap' : 'shake');
  const [flick, setFlick] = useState(0);
  useEffect(() => {
    if (reduce) { const t = setTimeout(onDone, 600); return () => clearTimeout(t); }
    const t1 = setTimeout(() => setPhase('flicker'), 1100);
    const t2 = setTimeout(() => setPhase('snap'), 3300);
    const t3 = setTimeout(onDone, 4600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [reduce, onDone]);
  useEffect(() => {
    if (phase !== 'flicker') return;
    const i = setInterval(() => setFlick((f) => f + 1), 110);
    return () => clearInterval(i);
  }, [phase]);
  return (
    <div className="relative grid aspect-square w-full max-w-[420px] place-items-center">
      <AnimatePresence mode="wait">
        {phase === 'shake' && (
          <motion.div key="shake" exit={{ opacity: 0, scale: 0.9 }} animate={{ x: [0, -6, 6, -10, 10, -4, 4, 0], rotate: [0, -1.5, 1.5, -2.5, 2.5, -1, 1, 0] }} transition={{ duration: 1.1, ease: 'easeInOut' }}>
            <SealedBox size={320} />
          </motion.div>
        )}
        {phase === 'flicker' && (
          <motion.div key="flicker" className="grid place-items-center gap-4" initial={{ opacity: 0 }} animate={{ opacity: [1, 0.35, 1, 0.6, 1] }} transition={{ duration: 0.5, repeat: Infinity }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={flick % 3 === 0 ? art : '/api/art/sealed'} alt="" className="w-72 rounded-2xl border border-line" style={{ filter: `contrast(${1 + (flick % 4) * 0.4}) blur(${flick % 2 ? 2 : 0}px)` }} />
            <p className="mono text-mute">{CANDIDATES[flick % CANDIDATES.length]}</p>
          </motion.div>
        )}
        {phase === 'snap' && (
          <motion.div key="snap" className="grid place-items-center gap-4" initial={{ scale: 1.15, opacity: 0, filter: 'blur(8px)' }} animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={art} alt={name} className="w-80 rounded-2xl border border-line" />
            <p className="text-xl font-semibold">{name}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Countdown({ to }: { to: string | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  if (!to) return null;
  const s = Math.max(0, Math.floor((new Date(to).getTime() - now) / 1000));
  return <span className="tabular-nums">{String(Math.floor(s / 60)).padStart(2, '0')}:{String(s % 60).padStart(2, '0')}</span>;
}

'use client';
// Small building blocks: rolling numbers, sparkline, progress bar, labels, skeletons, logo.
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/** Rolls each changed character digit by digit when the value changes. */
export function Rolling({ value, className = '' }: { value: string; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <span className={`inline-flex tabular-nums ${className}`} aria-label={value}>
      {value.split('').map((ch, i) => (
        <span key={i} className="relative inline-block overflow-hidden" style={{ height: '1.2em', lineHeight: '1.2em' }}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={`${i}-${ch}`}
              className="inline-block"
              initial={reduce ? { opacity: 0 } : { y: '100%', opacity: 0 }}
              animate={{ y: '0%', opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { y: '-100%', opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              {ch === ' ' ? ' ' : ch}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}

export function Sparkline({ points, width = 96, height = 28 }: { points: number[]; width?: number; height?: number }) {
  if (points.length < 2) return <svg width={width} height={height} aria-hidden><line x1="0" x2={width} y1={height / 2} y2={height / 2} stroke="#262626" strokeWidth="1.5" /></svg>;
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const d = points.map((p, i) => `${(i / (points.length - 1)) * width},${height - 2 - ((p - min) / span) * (height - 4)}`).join(' ');
  const up = points[points.length - 1] >= points[0];
  return (
    <svg width={width} height={height} aria-hidden>
      <motion.polyline points={d} fill="none" stroke={up ? '#22c55e' : '#ef4444'} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.8 }} />
    </svg>
  );
}

export function Progress({ value }: { value: number }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-line2">
        <motion.div className="h-full rounded-full bg-white" initial={{ width: 0 }} animate={{ width: `${v * 100}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
      </div>
      <span className="mono text-mute">{(v * 100).toFixed(0)}%</span>
    </div>
  );
}

export function Change({ value }: { value: number }) {
  const cls = value > 0.05 ? 'text-up' : value < -0.05 ? 'text-down' : 'text-mute';
  return <Rolling value={`${value > 0 ? '+' : ''}${value.toFixed(1)}%`} className={cls} />;
}

export function StateLabel({ state }: { state: string }) {
  const text = state === 'COLLAPSED' ? 'Collapsed' : state === 'COLLAPSING' ? 'Collapsing' : 'Sealed';
  return <span className="pill">{text}</span>;
}

export function FateLabel({ fate }: { fate: string | null }) {
  if (!fate) return <span className="text-sm text-mute">Unknown</span>;
  return <span className={`text-sm font-medium ${fate === 'ALIVE' ? 'text-up' : 'text-down'}`}>{fate === 'ALIVE' ? 'Alive' : 'Dead'}</span>;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

/** The SchrodingerPad mark (public/logo.png). */
export function Logo({ size = 26 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo.png" alt="" width={size} height={size} className="shrink-0" style={{ width: size, height: size }} />;
}

/** A sealed box that breathes. */
export function SealedBox({ size = 260 }: { size?: number }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <motion.div
        className="absolute inset-6 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.18), transparent 65%)' }}
        animate={reduce ? undefined : { opacity: [0.35, 0.8, 0.35], scale: [0.92, 1.04, 0.92] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="0.7" strokeLinejoin="round"
        animate={reduce ? undefined : { y: [0, -4, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}>
        <path d="M12 2.5 L21 7.5 L21 16.5 L12 21.5 L3 16.5 L3 7.5 Z" />
        <path d="M3 7.5 L12 12.5 L21 7.5 M12 12.5 V21.5" />
        <path d="M10.4 10.6 q0-1.6 1.6-1.6 q1.6 0 1.6 1.4 q0 1-1 1.5 q-.6.3-.6 1.1" strokeWidth="0.9" strokeLinecap="round" />
        <circle cx="12" cy="15.3" r="0.45" fill="#fff" stroke="none" />
      </motion.svg>
    </div>
  );
}

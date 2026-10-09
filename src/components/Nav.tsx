'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Menu, X } from 'lucide-react';
import { Logo } from './ui';
import { compactUsd } from '@/lib/format';

const WalletButton = dynamic(() => import('@solana/wallet-adapter-react-ui').then((m) => m.WalletMultiButton), { ssr: false });

const LINKS = [
  { href: '/launch', label: 'Create a token' },
  { href: '/boxes', label: 'Boxes' },
  { href: '/rarest', label: 'Rarest' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/tech', label: 'Tech' },
];

type Hit = { mint: string | null; number: number; ticker: string; name: string | null; image: string; marketCapUsd: number | null };

function SearchBox() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === '/' && !/input|textarea/i.test(el.tagName)) { e.preventDefault(); ref.current?.focus(); }
      if (e.key === 'Escape') { setOpen(false); ref.current?.blur(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (!q.trim()) { setHits([]); return; }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`).then((x) => x.json()).catch(() => []);
      setHits(Array.isArray(r) ? r : []);
    }, 180);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="relative w-full max-w-xs">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
      <input
        ref={ref} value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search boxes" className="h-9 w-full rounded-xl border border-line bg-card pl-9 pr-8 text-sm outline-none transition placeholder:text-mute focus:border-white/30"
        onKeyDown={(e) => { if (e.key === 'Enter' && hits[0]?.mint) router.push(`/box/${hits[0].mint}`); }}
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-line2 px-1.5 text-[10px] text-mute">/</kbd>
      <AnimatePresence>
        {open && hits.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-xl border border-line bg-card shadow-2xl">
            {hits.map((h) => (
              <Link key={h.number} href={h.mint ? `/box/${h.mint}` : '#'} className="flex items-center gap-3 px-3 py-2 text-sm transition hover:bg-raised">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={h.image} alt="" className="h-7 w-7 rounded-md border border-line" />
                <span className="flex-1 truncate">{h.name ?? `Box #${h.number}`} <span className="text-mute">${h.ticker}</span></span>
                <span className="mono text-mute">{compactUsd(h.marketCapUsd)}</span>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M18.9 2H22l-7.2 8.3L23 22h-6.6l-5.2-6.8L5.2 22H2l7.7-8.8L1 2h6.8l4.7 6.2L18.9 2Zm-1.2 18h1.8L6.4 3.9H4.5L17.7 20Z" /></svg>
);

export function Nav({ xHandle }: { xHandle: string }) {
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-black/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <Logo /> <span>SchrodingerPad</span>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={`rounded-lg px-3 py-1.5 text-sm transition ${path === l.href ? 'text-ink' : 'text-mute hover:text-ink'}`}>{l.label}</Link>
          ))}
        </nav>
        <div className="ml-auto hidden flex-1 justify-end md:flex"><SearchBox /></div>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <a href={`https://x.com/${xHandle}`} target="_blank" rel="noopener" aria-label="SchrodingerPad on X" className="grid h-9 w-9 place-items-center rounded-xl border border-line text-mute transition hover:border-white/30 hover:text-ink"><XIcon /></a>
          <WalletButton />
        </div>
        <button className="rounded-lg p-2 text-mute lg:hidden" onClick={() => setMenu(!menu)} aria-label="Menu">{menu ? <X size={18} /> : <Menu size={18} />}</button>
      </div>
      <AnimatePresence>
        {menu && (
          <motion.nav initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-line lg:hidden">
            <div className="flex flex-col gap-1 px-4 py-3">
              <div className="mb-2 md:hidden"><SearchBox /></div>
              {LINKS.map((l) => <Link key={l.href} href={l.href} onClick={() => setMenu(false)} className="rounded-lg px-2 py-2 text-sm text-mute hover:text-ink">{l.label}</Link>)}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

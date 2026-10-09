import Link from 'next/link';
import { Logo } from './ui';

const Github = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 .5C5.7.5.5 5.7.5 12a11.5 11.5 0 0 0 7.9 10.9c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 23.5 12C23.5 5.7 18.3.5 12 .5Z" /></svg>
);
const X = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M18.9 2H22l-7.2 8.3L23 22h-6.6l-5.2-6.8L5.2 22H2l7.7-8.8L1 2h6.8l4.7 6.2L18.9 2Zm-1.2 18h1.8L6.4 3.9H4.5L17.7 20Z" /></svg>
);

export function Footer({ xHandle, github }: { xHandle: string; github: string }) {
  const col = (title: string, links: [string, string][]) => (
    <div>
      <p className="label mb-3">{title}</p>
      <ul className="space-y-2 text-sm">
        {links.map(([href, label]) => <li key={href}><Link href={href} className="text-mute transition hover:text-ink">{label}</Link></li>)}
      </ul>
    </div>
  );
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2 font-semibold"><Logo /> SchrodingerPad</div>
          <p className="mt-3 max-w-xs text-sm text-mute">Every coin is born in a sealed box. The first buy opens it.</p>
          <div className="mt-5 flex gap-3 text-mute">
            <a href={`https://x.com/${xHandle}`} target="_blank" rel="noopener" aria-label="X" className="transition hover:text-ink"><X /></a>
            <a href={github} target="_blank" rel="noopener" aria-label="GitHub" className="transition hover:text-ink"><Github /></a>
          </div>
        </div>
        {col('Launchpad', [['/launch', 'Create a token'], ['/boxes', 'Boxes'], ['/rarest', 'Rarest'], ['/analytics', 'Analytics']])}
        {col('Resources', [['/tech', 'How it works'], ['/tech#verify', 'Verify a collapse'], ['/tech#fees', 'Fees'], ['/api/stats', 'Stats API']])}
        {col('Legal', [['/legal/terms', 'Terms of use'], ['/legal/privacy', 'Privacy'], ['/legal/risk', 'Risk disclosure']])}
      </div>
      <div className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
        <p className="max-w-4xl text-xs leading-relaxed text-mute">
          SchrodingerPad is noncustodial software for launching memecoins on pump.fun. Memecoins can go to zero. Every collapse is random:
          a coin may come out Dead, and creator-fee payouts depend on trading that may never happen. Nothing here is financial advice.
          The on-chain token name is always &quot;SchrodingerPad Box #N&quot;; the collapsed identity, fate and rarity live on this site.
        </p>
        <p className="mt-4 text-xs text-mute">&copy; {new Date().getFullYear()} SchrodingerPad</p>
      </div>
    </footer>
  );
}

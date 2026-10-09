import Link from 'next/link';
import { rarest } from '@/lib/public';
import { compactUsd, rarityText, sol } from '@/lib/format';
import { FateLabel } from '@/components/ui';
import { RARITY_ODDS } from '@/lib/identity';

export const metadata = { title: 'Rarest' };
export const dynamic = 'force-dynamic';

export default async function Rarest() {
  const list = await rarest(50);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Rarest collapses</h1>
      <p className="mt-2 text-mute">
        Ranked by the rarity roll from each revealed seed (lower is rarer). Odds: ultra rare 1 in {1_000_000 / RARITY_ODDS.ULTRA_RARE}, rare {RARITY_ODDS.RARE / 10_000}%, uncommon {RARITY_ODDS.UNCOMMON / 10_000}%.
      </p>
      <div className="card mt-8 overflow-hidden">
        {list.length === 0 && <p className="p-10 text-center text-mute">No collapses yet.</p>}
        {list.map((b, i) => (
          <Link key={b.number} href={b.mint ? `/box/${b.mint}` : '#'} className="flex items-center gap-4 border-b border-line px-4 py-3 transition last:border-0 hover:-translate-y-px hover:bg-raised">
            <span className="mono w-6 text-mute">{i + 1}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.image} alt="" className="h-12 w-12 rounded-lg border border-line" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{b.name}</p>
              <p className="mono text-mute">{b.onchainName} · ${b.ticker}</p>
            </div>
            <span className="pill hidden sm:inline-flex">{rarityText(b.rarity)}</span>
            <FateLabel fate={b.fate} />
            <span className="mono hidden w-20 text-right sm:block">{b.marketCapUsd ? compactUsd(b.marketCapUsd) : sol(b.marketCapSol, 1)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

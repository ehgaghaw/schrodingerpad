import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { TrendingStrip } from '@/components/TrendingStrip';
import { TokenTable } from '@/components/TokenTable';
import { Stats } from '@/components/Stats';
import { SealedBox } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <>
      <TrendingStrip />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <section className="grid items-center gap-10 py-14 md:grid-cols-[1.3fr_1fr] md:py-20">
          <div>
            <p className="label">Quantum launchpad on pump.fun</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">Every coin is born in a sealed box.</h1>
            <p className="mt-5 max-w-xl text-lg text-mute">The first buy opens it. Quantum randomness decides what it becomes. Verified on-chain.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/launch" className="btn-primary h-11 px-5">Create a token <ArrowRight size={16} /></Link>
              <Link href="/tech" className="btn h-11 px-5">How it works</Link>
            </div>
          </div>
          <div className="hidden justify-center md:flex"><SealedBox size={300} /></div>
        </section>
        <Stats />
        <div className="mt-12"><TokenTable /></div>
      </div>
    </>
  );
}

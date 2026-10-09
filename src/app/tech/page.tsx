import { env } from '@/lib/env';
import { RARITY_ODDS } from '@/lib/identity';
import { CommitRevealDiagram, FeesDiagram, QrngDiagram, SuperpositionDiagram } from './Diagrams';

export const metadata = { title: 'Tech' };
export const dynamic = 'force-dynamic';

function Section({ id, n, title, children, diagram }: { id: string; n: string; title: string; children: React.ReactNode; diagram?: React.ReactNode }) {
  return (
    <section id={id} className="grid scroll-mt-24 gap-8 border-t border-line py-14 lg:grid-cols-2">
      <div>
        <p className="mono text-mute">{n}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h2>
        <div className="mt-4 space-y-3 text-mute">{children}</div>
      </div>
      {diagram && <div className="card grid place-items-center p-6">{diagram}</div>}
    </section>
  );
}

export default function Tech() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="label">How it works</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight">Quantum randomness, sealed in a box, verified on Solana.</h1>
      <p className="mt-4 max-w-2xl text-mute">Every SchrodingerPad coin launches sealed. Its future is fixed the moment it is born, nobody can see it, and nobody can change it. The first buy opens the box.</p>

      <Section id="qrng" n="01" title="What a quantum random number generator is" diagram={<QrngDiagram />}>
        <p>A computer cannot invent randomness. Software generators run formulas: they look random but are fully determined by their starting state.</p>
        <p>A quantum random number generator measures a physical process whose outcome quantum mechanics says cannot be predicted, even in principle. The one we use, run by the Australian National University, measures fluctuations of the quantum vacuum and turns them into bits.</p>
        <p>The free service answers about once a minute, so we fetch 1,024 quantum bytes per request and keep them sealed on the server. Each box takes 32 unused bytes, never reused, and its page shows the request they came from and the provider&apos;s timestamp.</p>
        <p>Every box records whether its seed came from the quantum source or, if none was available, from a classical fallback generator. Fallback boxes are labelled as such on their page. We never present one as the other.</p>
      </Section>

      <Section id="box" n="02" title="The sealed box and superposition" diagram={<SuperpositionDiagram />}>
        <p>Schrodinger&apos;s thought experiment puts a cat in a box with a quantum event that may or may not happen. Until someone looks, the honest description includes both outcomes.</p>
        <p>Here, each coin is a box. At launch its seed is drawn and locked away. Until the first buy, the coin shows only &quot;???&quot;: its name, art, rarity and fate exist but are hidden. The first buyer is the observer, and their buy collapses the box. If nobody buys within {env.DECOHERENCE_MINUTES} minutes, the box decoheres and collapses on its own.</p>
        <p>The seed decides everything: a name from word lists, layered art traits, a rarity (ultra rare 1 in {1_000_000 / RARITY_ODDS.ULTRA_RARE}), a line of lore, and a fate, Alive or Dead, with {env.ALIVE_ODDS_PERCENT}% odds of Alive.</p>
      </Section>

      <section id="verify" className="scroll-mt-24 border-t border-line py-14">
        <p className="mono text-mute">03</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Commit, reveal, and how anyone can verify a collapse</h2>
        <div className="mt-4 grid gap-8 lg:grid-cols-2">
          <div className="space-y-3 text-mute">
            <p>If we picked outcomes after seeing who bought, we could cheat. So we commit first. At launch we compute the SHA-256 hash of the seed and write it to Solana in a memo transaction from the launcher wallet. That happens before the coin exists, so the commitment is older than any buy.</p>
            <p>A hash is a one-way fingerprint: you cannot get the seed back from it, but anyone can hash a seed and compare. At collapse we publish the seed.</p>
            <p>On every collapsed coin page, &quot;Verify this collapse&quot; hashes the revealed seed in your own browser, fetches the memo straight from a public Solana node, and checks that all three match: your hash, the on-chain memo and the commitment shown at launch.</p>
          </div>
          <CommitRevealDiagram />
        </div>
      </section>

      <Section id="onchain" n="04" title="What lives on-chain, and what lives on this site">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="card p-4">
            <p className="text-sm font-medium text-ink">On Solana</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
              <li>The token, named &quot;SchrodingerPad Box #N&quot;, forever</li>
              <li>The seed commitment memo</li>
              <li>Every trade, fee collection, payout, buyback and burn</li>
            </ul>
          </div>
          <div className="card p-4">
            <p className="text-sm font-medium text-ink">On this site and its X account</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
              <li>The collapsed name, art, lore and rarity</li>
              <li>The fate, Alive or Dead</li>
              <li>The revealed seed, so anyone can re-derive all of the above</li>
            </ul>
          </div>
        </div>
        <p>The token name never changes after launch. The identity is a deterministic function of the revealed seed, so it can be recomputed by anyone, not just shown by us.</p>
      </Section>

      <Section id="fees" n="05" title="How fees work for Alive and Dead coins" diagram={<FeesDiagram creatorShare={env.CREATOR_FEE_SHARE_PERCENT} />}>
        <p>Every pump.fun trade pays a creator fee. Every {env.FEE_CYCLE_MINUTES} minutes the launcher collects them and assigns the SOL actually received to each coin, in proportion to the creator fees its own trades produced.</p>
        <p>The coin&apos;s creator gets {env.CREATOR_FEE_SHARE_PERCENT}%. The rest depends on fate. Alive coins pay their holders in SOL, in proportion to each wallet&apos;s average balance over the last 60 minutes. Dead coins use it to buy their own token back and burn it.</p>
        <p>Every payout, buyback and burn is a Solana transaction linked on the coin page. Payouts can be paused while something is investigated; paused amounts stay recorded per coin.</p>
      </Section>
    </div>
  );
}

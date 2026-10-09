import { env, cluster } from '@/lib/env';
import { LaunchForm } from './LaunchForm';

export const metadata = { title: 'Create a token' };
export const dynamic = 'force-dynamic';

export default function LaunchPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Create a token</h1>
      <p className="mt-2 max-w-2xl text-mute">Pick a ticker and seal a box. The launcher creates the coin on pump.fun as &quot;SchrodingerPad Box #N&quot;, and you earn {env.CREATOR_FEE_SHARE_PERCENT}% of its creator fees.</p>
      <div className="mt-8">
        <LaunchForm cost={env.LAUNCH_COST_SOL} cluster={cluster} decoherence={env.DECOHERENCE_MINUTES} creatorShare={env.CREATOR_FEE_SHARE_PERCENT} />
      </div>
    </div>
  );
}

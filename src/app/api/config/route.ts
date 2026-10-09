import { env, cluster, publicRpcUrl } from '@/lib/env';
import { launcherAddress } from '@/lib/solana';
import { json } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  return json({
    cluster,
    testMode: env.TEST_MODE,
    publicRpc: publicRpcUrl(),
    launcher: launcherAddress(),
    launchCostSol: env.LAUNCH_COST_SOL,
    creatorSharePercent: env.CREATOR_FEE_SHARE_PERCENT,
    decoherenceMinutes: env.DECOHERENCE_MINUTES,
    aliveOddsPercent: env.ALIVE_ODDS_PERCENT,
  });
}

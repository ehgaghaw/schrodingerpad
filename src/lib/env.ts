// All configuration comes from the environment. Secrets are read here and never logged.
const num = (v: string | undefined, d: number) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const bool = (v: string | undefined) => v === 'true' || v === '1';

export const env = {
  TEST_MODE: bool(process.env.TEST_MODE),
  HELIUS_API_KEY: process.env.HELIUS_API_KEY || '',
  HELIUS_WEBHOOK_SECRET: process.env.HELIUS_WEBHOOK_SECRET || '',
  SOLANA_RPC_URL: process.env.SOLANA_RPC_URL || '',
  QRNG_API_KEY: process.env.QRNG_API_KEY || '',
  CREATOR_FEE_SHARE_PERCENT: Math.min(100, Math.max(0, num(process.env.CREATOR_FEE_SHARE_PERCENT, 20))),
  DECOHERENCE_MINUTES: Math.max(1, num(process.env.DECOHERENCE_MINUTES, 10)),
  ALIVE_ODDS_PERCENT: Math.min(100, Math.max(0, num(process.env.ALIVE_ODDS_PERCENT, 50))),
  LAUNCH_COST_SOL: num(process.env.LAUNCH_COST_SOL, 0.05),
  DEV_BUY_SOL: num(process.env.DEV_BUY_SOL, 0),
  MIN_PAYOUT_SOL: num(process.env.MIN_PAYOUT_SOL, 0.0005),
  FEE_CYCLE_MINUTES: num(process.env.FEE_CYCLE_MINUTES, 10),
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
  SESSION_SECRET: process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || '',
  PUBLIC_URL: (process.env.PUBLIC_URL || '').replace(/\/$/, ''),
  X_POSTING: bool(process.env.X_POSTING),
  X_API_KEY: process.env.X_API_KEY || '',
  X_API_SECRET: process.env.X_API_SECRET || '',
  X_ACCESS_TOKEN: process.env.X_ACCESS_TOKEN || '',
  X_ACCESS_SECRET: process.env.X_ACCESS_SECRET || '',
  X_HANDLE: process.env.X_HANDLE || 'SchrodingerPad',
  GITHUB_URL: process.env.GITHUB_URL || 'https://github.com/ehgaghaw/schrodingerpad',
};

export const cluster = env.TEST_MODE ? 'devnet' : 'mainnet-beta';
export const SITE_NAME = 'SchrodingerPad';
export const boxName = (n: number) => `SchrodingerPad Box #${n}`;

/** Server-side RPC: Helius when a key is set, otherwise SOLANA_RPC_URL, otherwise the public endpoint. */
export function rpcUrl() {
  if (env.SOLANA_RPC_URL) return env.SOLANA_RPC_URL;
  if (env.HELIUS_API_KEY) return `https://${env.TEST_MODE ? 'devnet' : 'mainnet'}.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`;
  return env.TEST_MODE ? 'https://api.devnet.solana.com' : 'https://api.mainnet-beta.solana.com';
}

/** Public RPC used by browsers for independent verification (no keys). */
export const publicRpcUrl = () => (env.TEST_MODE ? 'https://api.devnet.solana.com' : 'https://api.mainnet-beta.solana.com');

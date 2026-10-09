// Holder balances. Every few minutes each Alive coin's holders are snapshotted; payouts use the
// average over the last 60 minutes, so buying right before a payout earns little.
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { prisma } from './db';
import { env, rpcUrl } from './env';
import { connection, launcherAddress } from './solana';
import { getKV } from './kv';

export const AVG_WINDOW_MINUTES = 60;

/** Wallets that never receive holder payouts: the launcher and any program-owned address (curves, pools). */
function excluded(owner: string) {
  if (owner === launcherAddress()) return true;
  try { return !PublicKey.isOnCurve(new PublicKey(owner).toBytes()); } catch { return true; }
}

async function heliusHolders(mint: string): Promise<Map<string, bigint>> {
  const out = new Map<string, bigint>();
  for (let page = 1; page < 50; page++) {
    const r = await fetch(rpcUrl(), {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'h', method: 'getTokenAccounts', params: { mint, page, limit: 1000 } }),
    });
    const j = (await r.json()) as { result?: { token_accounts?: { owner: string; amount: number | string }[] } };
    const list = j.result?.token_accounts ?? [];
    for (const a of list) out.set(a.owner, (out.get(a.owner) ?? 0n) + BigInt(a.amount));
    if (list.length < 1000) break;
  }
  return out;
}

async function rpcHolders(mint: string): Promise<Map<string, bigint>> {
  const out = new Map<string, bigint>();
  for (const program of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    const accts = await connection().getParsedProgramAccounts(program, { filters: [{ memcmp: { offset: 0, bytes: mint } }] }).catch(() => []);
    for (const a of accts) {
      const info = (a.account.data as { parsed?: { info?: { owner: string; tokenAmount: { amount: string } } } }).parsed?.info;
      if (info) out.set(info.owner, (out.get(info.owner) ?? 0n) + BigInt(info.tokenAmount.amount));
    }
  }
  return out;
}

export async function currentHolders(box: { id: string; mint: string | null }): Promise<Map<string, bigint>> {
  if (!box.mint) return new Map();
  let raw: Map<string, bigint>;
  if (env.TEST_MODE) {
    const j = JSON.parse((await getKV(`testHolders:${box.id}`)) || '{}') as Record<string, string>;
    raw = new Map(Object.entries(j).map(([w, a]) => [w, BigInt(a)]));
  } else {
    raw = env.HELIUS_API_KEY ? await heliusHolders(box.mint) : await rpcHolders(box.mint);
  }
  for (const w of [...raw.keys()]) if (excluded(w) || raw.get(w)! <= 0n) raw.delete(w);
  return raw;
}

export async function snapshotHolders(box: { id: string; mint: string | null }, at = new Date()) {
  const h = await currentHolders(box);
  if (h.size) await prisma.holderSnapshot.createMany({ data: [...h].map(([wallet, amount]) => ({ boxId: box.id, wallet, amount, at })) });
  await prisma.holderSnapshot.deleteMany({ where: { boxId: box.id, at: { lt: new Date(Date.now() - 6 * 3600_000) } } });
  return h.size;
}

export async function snapshotAll() {
  const boxes = await prisma.box.findMany({ where: { state: 'COLLAPSED', fate: 'ALIVE', mint: { not: null } }, select: { id: true, mint: true } });
  let n = 0;
  for (const b of boxes) n += await snapshotHolders(b);
  return n;
}

/** Average balance per wallet over the window. A wallet missing from a snapshot counts as 0 for it. */
export async function averageBalances(boxId: string, windowMinutes = AVG_WINDOW_MINUTES): Promise<Map<string, bigint>> {
  const rows = await prisma.holderSnapshot.findMany({ where: { boxId, at: { gte: new Date(Date.now() - windowMinutes * 60_000) } }, select: { wallet: true, amount: true, at: true } });
  const times = new Set(rows.map((r) => r.at.getTime()));
  if (!times.size) return new Map();
  const sum = new Map<string, bigint>();
  for (const r of rows) sum.set(r.wallet, (sum.get(r.wallet) ?? 0n) + r.amount);
  const n = BigInt(times.size);
  return new Map([...sum].map(([w, s]) => [w, s / n]));
}

// Quantum randomness. Seeds come from the ANU Quantum Random Number Generator (measurements of
// vacuum fluctuations). The free ANU endpoint allows roughly one request a minute, so the worker
// pre-fetches 1024 quantum bytes per request and stores them as 32-byte seeds; each launch takes
// one unused seed, atomically, and records exactly which request it came from. If no quantum seed
// is available, the box uses the operating system's CSPRNG and is labelled "classical fallback".
import crypto from 'node:crypto';
import { prisma } from './db';
import { env } from './env';

export type Seed = {
  seed: Buffer; // 32 bytes
  source: 'QUANTUM' | 'CLASSICAL';
  provider: string;
  requestId: string; // id of the request the bytes came from (plus byte offset for pooled seeds)
  sourceTime: string | null; // the provider's own timestamp (HTTP Date header)
  fetchedAt: Date;
  note: string | null;
};

const KEYED = (n: number) => `https://api.quantumnumbers.anu.edu.au?length=${n}&type=uint8`;
const FREE = (n: number) => `https://qrng.anu.edu.au/API/jsonI.php?length=${n}&type=uint8`;
const PROVIDER_KEYED = 'ANU QRNG (api.quantumnumbers.anu.edu.au)';
const PROVIDER_FREE = 'ANU QRNG (qrng.anu.edu.au)';

function parse(j: unknown, n: number): Buffer | null {
  const o = j as { success?: boolean; data?: unknown };
  if (!o || o.success === false || !Array.isArray(o.data) || o.data.length !== n) return null;
  if (!o.data.every((x) => Number.isInteger(x) && x >= 0 && x <= 255)) return null;
  return Buffer.from(o.data as number[]);
}

/** Fetches `n` quantum bytes (n <= 1024). Returns the bytes or an error string. */
export async function fetchQuantumBytes(n: number): Promise<{ bytes: Buffer; provider: string; requestId: string; sourceTime: string | null; fetchedAt: Date } | string> {
  const requestId = crypto.randomUUID();
  const attempts: [string, Record<string, string>, string][] = [];
  if (env.QRNG_API_KEY) attempts.push([KEYED(n), { 'x-api-key': env.QRNG_API_KEY }, PROVIDER_KEYED]);
  attempts.push([FREE(n), {}, PROVIDER_FREE]);
  const errors: string[] = [];
  for (const [url, headers, provider] of attempts) {
    try {
      const r = await fetch(url, { headers: { accept: 'application/json', ...headers }, signal: AbortSignal.timeout(10_000), cache: 'no-store' });
      if (!r.ok) { errors.push(`${provider}: HTTP ${r.status}`); continue; }
      const bytes = parse(await r.json(), n);
      if (!bytes) { errors.push(`${provider}: malformed response`); continue; }
      return { bytes, provider, requestId, sourceTime: r.headers.get('date'), fetchedAt: new Date() };
    } catch (e) {
      errors.push(`${provider}: ${(e as Error).message.slice(0, 80)}`);
    }
  }
  return errors.join('; ');
}

/** Worker: keep at least `min` unused quantum seeds in the pool. */
export async function refillQuantumPool(min = 24): Promise<string> {
  const unused = await prisma.quantumSeed.count({ where: { usedAt: null } });
  if (unused >= min) return `${unused} quantum seeds ready`;
  const got = await fetchQuantumBytes(1024);
  if (typeof got === 'string') return `refill failed (${got}); ${unused} ready`;
  const rows = Array.from({ length: 32 }, (_, i) => ({
    hex: got.bytes.subarray(i * 32, i * 32 + 32).toString('hex'), provider: got.provider, requestId: got.requestId, offset: i * 32, sourceTime: got.sourceTime, fetchedAt: got.fetchedAt,
  }));
  await prisma.quantumSeed.createMany({ data: rows });
  return `added 32 quantum seeds from request ${got.requestId}; ${unused + 32} ready`;
}

/** Takes one unused pooled seed, atomically (two launches can never get the same seed). */
async function takePooled(): Promise<Seed | null> {
  const rows = await prisma.$queryRawUnsafe<{ id: string; hex: string; provider: string; requestId: string; offset: number; sourceTime: string | null; fetchedAt: Date }[]>(
    `UPDATE "QuantumSeed" SET "usedAt" = now()
     WHERE "id" = (SELECT "id" FROM "QuantumSeed" WHERE "usedAt" IS NULL ORDER BY "fetchedAt" ASC, "offset" ASC LIMIT 1 FOR UPDATE SKIP LOCKED)
     RETURNING "id", "hex", "provider", "requestId", "offset", "sourceTime", "fetchedAt"`,
  );
  const r = rows[0];
  if (!r) return null;
  return {
    seed: Buffer.from(r.hex, 'hex'), source: 'QUANTUM', provider: r.provider, requestId: `${r.requestId} (bytes ${r.offset}-${r.offset + 31})`,
    sourceTime: r.sourceTime, fetchedAt: new Date(r.fetchedAt), note: null,
  };
}

export async function quantumSeed(): Promise<Seed> {
  const pooled = await takePooled();
  if (pooled) return pooled;
  const live = await fetchQuantumBytes(32);
  if (typeof live !== 'string') return { seed: live.bytes, source: 'QUANTUM', provider: live.provider, requestId: live.requestId, sourceTime: live.sourceTime, fetchedAt: live.fetchedAt, note: null };
  return {
    seed: crypto.randomBytes(32), source: 'CLASSICAL', provider: 'classical fallback (node crypto.randomBytes)', requestId: crypto.randomUUID(),
    sourceTime: new Date().toUTCString(), fetchedAt: new Date(), note: `quantum source unavailable: ${live}`,
  };
}

/** Marks which box used a pooled seed (audit trail). */
export async function markSeedUsed(seedHex: string, boxNumber: number) {
  await prisma.quantumSeed.updateMany({ where: { hex: seedHex, boxNumber: null }, data: { boxNumber } });
}

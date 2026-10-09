// A small database lease so only one process runs a money job at a time (web + worker, or the
// same job fired twice). Acquired atomically with one INSERT ... ON CONFLICT statement.
import crypto from 'node:crypto';
import { prisma } from './db';

export async function withLease<T>(name: string, ttlSeconds: number, fn: () => Promise<T>): Promise<{ ran: true; value: T } | { ran: false }> {
  const owner = crypto.randomUUID();
  const key = `lease:${name}`;
  const rows = await prisma.$queryRawUnsafe<{ key: string }[]>(
    `INSERT INTO "KV" ("key", "value", "updatedAt") VALUES ($1, $2, now())
     ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = now()
     WHERE "KV"."value" = '' OR "KV"."updatedAt" < now() - ($3 || ' seconds')::interval
     RETURNING "key"`,
    key, owner, String(ttlSeconds),
  );
  if (!rows.length) return { ran: false };
  try {
    return { ran: true, value: await fn() };
  } finally {
    await prisma.$executeRawUnsafe(`UPDATE "KV" SET "value" = '' WHERE "key" = $1 AND "value" = $2`, key, owner);
  }
}

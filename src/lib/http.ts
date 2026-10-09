import { NextResponse } from 'next/server';

/** JSON with BigInt support, never cached. */
export const json = (data: unknown, init?: number | ResponseInit) =>
  new NextResponse(JSON.stringify(data, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)), {
    ...(typeof init === 'number' ? { status: init } : init),
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
export const fail = (msg: string, status = 400) => json({ error: msg }, status);
export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try { return (await req.json()) as T; } catch { return {} as T; }
}

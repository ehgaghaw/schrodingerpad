// Decodes pump.fun TradeEvents from a transaction. pump.fun emits them as Anchor events, either
// as "Program data:" log lines or as self-CPI event instructions; both are handled.
import bs58 from 'bs58';
import { PUMP_SDK } from '@pump-fun/pump-sdk';
import { INITIAL_REAL_TOKEN_RESERVES, TOTAL_SUPPLY } from './pump';

const TRADE_DISC = Buffer.from([189, 219, 127, 211, 78, 230, 97, 238]);
const EVENT_IX_TAG = Buffer.from([0xe4, 0x45, 0xa5, 0x2e, 0x51, 0xcb, 0x9a, 0x1d]);

export type Trade = {
  mint: string; user: string; isBuy: boolean;
  solAmount: bigint; tokenAmount: bigint; creatorFee: bigint;
  priceSol: number; marketCapSol: number; progress: number; complete: boolean; timestamp: number;
};

function toTrade(data: Buffer): Trade | null {
  try {
    const e = PUMP_SDK.decodeTradeEventBc(data) as unknown as Record<string, { toString(): string } & { toBase58?: () => string }> & { isBuy: boolean };
    const vSol = Number(e.virtualSolReserves.toString()) / 1e9;
    const vTok = Number(e.virtualTokenReserves.toString()) / 10 ** 6;
    const price = vTok > 0 ? vSol / vTok : 0;
    const realTok = Number(e.realTokenReserves.toString()) / 10 ** 6;
    const progress = Math.max(0, Math.min(1, 1 - realTok / INITIAL_REAL_TOKEN_RESERVES));
    return {
      mint: e.mint.toBase58!(), user: e.user.toBase58!(), isBuy: !!e.isBuy,
      solAmount: BigInt(e.solAmount.toString()), tokenAmount: BigInt(e.tokenAmount.toString()), creatorFee: BigInt(e.creatorFee?.toString() ?? '0'),
      priceSol: price, marketCapSol: price * TOTAL_SUPPLY, progress, complete: realTok <= 0, timestamp: Number(e.timestamp.toString()),
    };
  } catch { return null; }
}

/** All trade events in a transaction, from log lines and from event CPIs (deduplicated by order). */
export function tradesFromTx(logs: string[] | null | undefined, innerIxData: string[] = []): Trade[] {
  const out: Trade[] = [];
  for (const line of logs ?? []) {
    if (!line.startsWith('Program data: ')) continue;
    const d = Buffer.from(line.slice(14), 'base64');
    if (d.length > 8 && d.subarray(0, 8).equals(TRADE_DISC)) { const t = toTrade(d.subarray(8)); if (t) out.push(t); }
  }
  if (out.length) return out;
  for (const b58 of innerIxData) {
    let d: Buffer;
    try { d = Buffer.from(bs58.decode(b58)); } catch { continue; }
    if (d.length > 16 && d.subarray(0, 8).equals(EVENT_IX_TAG) && d.subarray(8, 16).equals(TRADE_DISC)) { const t = toTrade(d.subarray(16)); if (t) out.push(t); }
  }
  return out;
}

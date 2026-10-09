// Commit-reveal, shared by the server, the tests and the browser (Web Crypto only, no Node APIs).
export const COMMIT_PREFIX = 'SchrodingerPad';

export function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  if (!/^([0-9a-f]{2})+$/i.test(hex)) throw new Error('bad hex');
  return new Uint8Array(hex.match(/../g)!.map((b) => parseInt(b, 16)));
}
export const bytesToHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

/** commitment = sha256(seed bytes), lowercase hex */
export async function commitmentOf(seedHex: string): Promise<string> {
  const d = await globalThis.crypto.subtle.digest('SHA-256', hexToBytes(seedHex));
  return bytesToHex(new Uint8Array(d));
}

/** The exact memo text written on-chain at launch. */
export const commitMemo = (n: number, commitment: string) => `${COMMIT_PREFIX} Box #${n} commitment sha256:${commitment}`;

/** Pulls the sha256 commitment for box `n` out of a memo string, or null. */
export function parseCommitMemo(text: string, n: number): string | null {
  const m = text.match(new RegExp(`${COMMIT_PREFIX} Box #${n} commitment sha256:([0-9a-f]{64})`));
  return m ? m[1] : null;
}

/** Collects memo texts from a getTransaction(jsonParsed) result. */
export function memosFromTx(tx: unknown): string[] {
  const out: string[] = [];
  const t = tx as { transaction?: { message?: { instructions?: unknown[] } }; meta?: { logMessages?: string[] } } | null;
  for (const ix of t?.transaction?.message?.instructions ?? []) {
    const i = ix as { program?: string; parsed?: unknown };
    if (i.program === 'spl-memo' && typeof i.parsed === 'string') out.push(i.parsed);
  }
  for (const l of t?.meta?.logMessages ?? []) {
    const m = l.match(/^Program log: Memo \(len \d+\): "(.*)"$/);
    if (m) out.push(m[1]);
  }
  return out;
}

export type VerifyResult = { ok: boolean; computed: string; onChain: string | null; stored: string; reason?: string };

/**
 * The whole check, as the browser runs it: hash the revealed seed, read the memo from the
 * chain via a public RPC, and compare all three.
 */
export async function verifyCollapse(opts: { seedHex: string; commitment: string; number: number; commitSig: string; rpcUrl: string }): Promise<VerifyResult> {
  const computed = await commitmentOf(opts.seedHex);
  const res = await fetch(opts.rpcUrl, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: [opts.commitSig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }] }),
  });
  const j = await res.json();
  const memos = memosFromTx(j.result);
  const onChain = memos.map((m) => parseCommitMemo(m, opts.number)).find(Boolean) ?? null;
  if (!j.result) return { ok: false, computed, onChain: null, stored: opts.commitment, reason: 'commitment transaction not found on chain' };
  if (!onChain) return { ok: false, computed, onChain, stored: opts.commitment, reason: 'no commitment memo for this box in that transaction' };
  const ok = computed === onChain && onChain === opts.commitment;
  return { ok, computed, onChain, stored: opts.commitment, reason: ok ? undefined : 'hash mismatch' };
}

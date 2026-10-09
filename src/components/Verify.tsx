'use client';
// One-click verify, entirely in the browser: hash the revealed seed with Web Crypto, read the
// commitment memo straight from a public Solana RPC, and compare.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Loader2 } from 'lucide-react';
import { verifyCollapse, type VerifyResult } from '@/lib/verify';

export function VerifyButton(p: { seed: string; commitment: string; number: number; commitSig: string | null; rpc: string }) {
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<VerifyResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const run = async () => {
    if (!p.commitSig) return;
    setBusy(true); setErr(null);
    try { setR(await verifyCollapse({ seedHex: p.seed, commitment: p.commitment, number: p.number, commitSig: p.commitSig, rpcUrl: p.rpc })); }
    catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  return (
    <div className="space-y-3">
      <button className="btn-primary w-full sm:w-auto" onClick={run} disabled={busy || !p.commitSig}>
        {busy ? <Loader2 size={15} className="animate-spin" /> : null} Verify this collapse
      </button>
      {!p.commitSig && <p className="text-sm text-mute">This box has no on-chain commitment (test box).</p>}
      {err && <p className="text-sm text-down">{err}</p>}
      {r && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 rounded-xl border border-line bg-black p-4">
          <p className={`flex items-center gap-2 font-medium ${r.ok ? 'text-up' : 'text-down'}`}>{r.ok ? <Check size={16} /> : <X size={16} />}{r.ok ? 'Verified: the revealed seed matches the on-chain commitment.' : `Not verified: ${r.reason}`}</p>
          <Row k="sha256(seed), computed here" v={r.computed} />
          <Row k="Commitment in the on-chain memo" v={r.onChain ?? 'not found'} />
          <Row k="Commitment published at launch" v={r.stored} />
        </motion.div>
      )}
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div><p className="label">{k}</p><p className="mono break-all">{v}</p></div>
);

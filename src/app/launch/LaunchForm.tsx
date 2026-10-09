'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Check } from 'lucide-react';
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { SealedBox } from '@/components/ui';

const WalletButton = dynamic(() => import('@solana/wallet-adapter-react-ui').then((m) => m.WalletMultiButton), { ssr: false });
const MEMO = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const STEPS = ['Fetching a quantum seed and preparing your box', 'Waiting for your wallet', 'Confirming payment on-chain', 'Writing the commitment on-chain and sealing the box'];

export function LaunchForm({ cost, cluster, decoherence, creatorShare }: { cost: number; cluster: string; decoherence: number; creatorShare: number }) {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const router = useRouter();
  const [ticker, setTicker] = useState('');
  const [step, setStep] = useState(-1);
  const [err, setErr] = useState<string | null>(null);
  const valid = /^[A-Z0-9]{2,10}$/.test(ticker);

  const launch = async () => {
    if (!publicKey || !valid) return;
    setErr(null);
    try {
      setStep(0);
      const r = await fetch('/api/launch/intent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: publicKey.toBase58(), ticker }) });
      const intent = await r.json();
      if (!r.ok) throw new Error(intent.error);
      setStep(1);
      const tx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: new PublicKey(intent.launcher), lamports: BigInt(intent.lamports) }),
        new TransactionInstruction({ programId: MEMO, keys: [{ pubkey: publicKey, isSigner: true, isWritable: false }], data: Buffer.from(intent.memo, 'utf8') }),
      );
      const sig = await sendTransaction(tx, connection);
      setStep(2);
      await connection.confirmTransaction(sig, 'confirmed');
      setStep(3);
      let res: { mint?: string; error?: string } = {};
      for (let i = 0; i < 4; i++) {
        const c = await fetch('/api/launch/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: intent.id, signature: sig }) });
        res = await c.json();
        if (c.ok && res.mint) break;
        if (!/not found/i.test(res.error || '')) break;
        await new Promise((ok) => setTimeout(ok, 2500));
      }
      if (!res.mint) throw new Error(res.error || 'Launch failed.');
      router.push(`/box/${res.mint}`);
    } catch (e) {
      setErr((e as Error).message);
      setStep(-1);
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <div className="card p-6 sm:p-8">
        <p className="label">Ticker</p>
        <input className="input mt-2 text-lg uppercase" maxLength={10} placeholder="BOX" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
        <p className="mt-2 text-xs text-mute">2 to 10 letters or digits. The on-chain name is set for you: &quot;SchrodingerPad Box #N&quot;.</p>
        <div className="mt-6 space-y-2 rounded-xl border border-line p-4 text-sm">
          <div className="flex justify-between"><span className="text-mute">Launch cost</span><span>{cost} SOL</span></div>
          <div className="flex justify-between"><span className="text-mute">Your share of creator fees</span><span>{creatorShare}%</span></div>
          <div className="flex justify-between"><span className="text-mute">Decoherence if nobody buys</span><span>{decoherence} min</span></div>
          <div className="flex justify-between"><span className="text-mute">Network</span><span>{cluster}</span></div>
        </div>
        <div className="mt-6">
          {!publicKey ? <WalletButton /> : <button className="btn-primary h-11 w-full" disabled={!valid || step >= 0} onClick={launch}>{step >= 0 ? <Loader2 size={16} className="animate-spin" /> : null}Seal a box for {cost} SOL</button>}
        </div>
        {err && <p className="mt-4 text-sm text-down">{err}</p>}
        <AnimatePresence>
          {step >= 0 && (
            <motion.ol initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0 }} className="mt-6 space-y-2 text-sm">
              {STEPS.map((s, i) => (
                <li key={i} className={`flex items-center gap-2 ${i < step ? 'text-ink' : i === step ? 'text-ink' : 'text-mute'}`}>
                  {i < step ? <Check size={14} className="text-up" /> : i === step ? <Loader2 size={14} className="animate-spin" /> : <span className="h-3.5 w-3.5 rounded-full border border-line2" />}{s}
                </li>
              ))}
            </motion.ol>
          )}
        </AnimatePresence>
      </div>
      <div className="card grid place-items-center gap-4 p-6 text-center">
        <SealedBox size={240} />
        <p className="text-sm text-mute">Your coin launches sealed. Its identity, fate and rarity are already decided by a quantum seed, committed on-chain before the first buy, and revealed when someone buys.</p>
      </div>
    </div>
  );
}

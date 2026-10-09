'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Check } from 'lucide-react';
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { SealedBox } from '@/components/ui';

const WalletButton = dynamic(() => import('@solana/wallet-adapter-react-ui').then((m) => m.WalletMultiButton), { ssr: false });
const MEMO = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const STEPS = ['Fetching a quantum seed and preparing your box', 'Waiting for your wallet', 'Confirming payment on-chain', 'Writing the commitment on-chain and sealing the box'];

/** Sends a signed transaction through our own RPC (so the wallet's network setting can't misroute it)
 * and waits up to 90 seconds, re-broadcasting every few seconds. */
async function sendAndConfirm(connection: Connection, raw: Uint8Array): Promise<string> {
  const sig = await connection.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 3 });
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const { value } = await connection.getSignatureStatuses([sig]);
    const s = value[0];
    if (s?.err) throw new Error('The payment transaction failed on chain. Nothing was charged beyond the network fee.');
    if (s && (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized')) return sig;
    await new Promise((ok) => setTimeout(ok, 2500));
    connection.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 0 }).catch(() => {});
  }
  throw new Error(`The payment has not confirmed after 90 seconds. Check it on Solscan before retrying: ${sig}`);
}

export function LaunchForm({ cost, cluster, decoherence, creatorShare, testMode }: { cost: number; cluster: string; decoherence: number; creatorShare: number; testMode: boolean }) {
  const { publicKey, sendTransaction, signTransaction } = useWallet();
  const { connection } = useConnection();
  const router = useRouter();
  const [ticker, setTicker] = useState('');
  const [step, setStep] = useState(-1);
  const [err, setErr] = useState<string | null>(null);
  const valid = /^[A-Z0-9]{2,10}$/.test(ticker);

  const launchTest = async () => {
    if (!publicKey || !valid) return;
    setErr(null);
    setStep(3);
    try {
      const r = await fetch('/api/launch/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: publicKey.toBase58(), ticker }) });
      const j = await r.json();
      if (!r.ok || !j.mint) throw new Error(j.error || 'Launch failed.');
      router.push(`/box/${j.mint}`);
    } catch (e) {
      setErr((e as Error).message);
      setStep(-1);
    }
  };

  const launch = async () => {
    if (testMode) return launchTest();
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
      let sig: string;
      if (signTransaction) {
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey;
        const signed = await signTransaction(tx);
        setStep(2);
        sig = await sendAndConfirm(connection, signed.serialize());
      } else {
        sig = await sendTransaction(tx, connection);
        setStep(2);
        await connection.confirmTransaction(sig, 'confirmed');
      }
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
          <div className="flex justify-between"><span className="text-mute">Launch cost</span><span>{testMode ? 'free (test mode)' : `${cost} SOL`}</span></div>
          <div className="flex justify-between"><span className="text-mute">Your share of creator fees</span><span>{creatorShare}%</span></div>
          <div className="flex justify-between"><span className="text-mute">Decoherence if nobody buys</span><span>{decoherence} min</span></div>
          <div className="flex justify-between"><span className="text-mute">Network</span><span>{cluster}</span></div>
        </div>
        <div className="mt-6">
          {!publicKey ? <WalletButton /> : <button className="btn-primary h-11 w-full" disabled={!valid || step >= 0} onClick={launch}>{step >= 0 ? <Loader2 size={16} className="animate-spin" /> : null}{testMode ? 'Seal a test box' : `Seal a box for ${cost} SOL`}</button>}
          {testMode && <p className="mt-3 text-xs text-mute">Test mode: the site runs on Solana devnet. Test boxes are free and no real coin is created on pump.fun; the commitment memo is a real devnet transaction. Your wallet is only used to record you as the creator.</p>}
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

import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction, ComputeBudgetProgram } from '@solana/web3.js';
import bs58 from 'bs58';
import { env, rpcUrl, cluster } from './env';

let _conn: Connection | null = null;
export const connection = () => (_conn ||= new Connection(rpcUrl(), { commitment: 'confirmed' }));

export const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
export const LAMPORTS = 1_000_000_000;

let _launcher: Keypair | null | undefined;
/** The launcher wallet (creates coins, collects fees, pays out). Accepts base58 or a JSON byte array. */
export function launcher(): Keypair {
  if (_launcher) return _launcher;
  const raw = (process.env.LAUNCHER_PRIVATE_KEY || '').trim();
  if (!raw) throw new Error('LAUNCHER_PRIVATE_KEY is not set');
  const bytes = raw.startsWith('[') ? Uint8Array.from(JSON.parse(raw)) : bs58.decode(raw);
  _launcher = Keypair.fromSecretKey(bytes);
  return _launcher;
}
export const launcherAddress = () => { try { return launcher().publicKey.toBase58(); } catch { return ''; } };

export const solscan = {
  tx: (sig: string) => `https://solscan.io/tx/${sig}${cluster === 'devnet' ? '?cluster=devnet' : ''}`,
  account: (a: string) => `https://solscan.io/account/${a}${cluster === 'devnet' ? '?cluster=devnet' : ''}`,
  token: (a: string) => `https://solscan.io/token/${a}${cluster === 'devnet' ? '?cluster=devnet' : ''}`,
};

export const isAddress = (s: string) => { try { new PublicKey(s); return true; } catch { return false; } };

/** Sends instructions from the launcher with a small priority fee and waits for confirmation. */
export async function sendFromLauncher(ixs: TransactionInstruction[], extraSigners: Keypair[] = []) {
  const kp = launcher();
  const tx = new Transaction().add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }), ...ixs);
  return sendAndConfirmTransaction(connection(), tx, [kp, ...extraSigners], { commitment: 'confirmed', maxRetries: 5 });
}

export function memoIx(text: string, signer?: PublicKey) {
  return new TransactionInstruction({ programId: MEMO_PROGRAM, keys: signer ? [{ pubkey: signer, isSigner: true, isWritable: false }] : [], data: Buffer.from(text, 'utf8') });
}

export const sol = (lamports: bigint | number) => Number(lamports) / LAMPORTS;
export const lamportsOf = (s: number) => BigInt(Math.round(s * LAMPORTS));

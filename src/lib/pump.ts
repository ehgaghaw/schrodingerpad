// pump.fun through PumpPortal's local-transaction API: PumpPortal builds the transaction, we sign
// it with the launcher (and the new mint) and send it through our own RPC. In TEST_MODE there is
// no pump.fun on devnet, so these return stand-ins (the commitment memo stays real, on devnet).
import crypto from 'node:crypto';
import { Keypair, PublicKey, VersionedTransaction, ComputeBudgetProgram } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, createBurnCheckedInstruction, getMint, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { env } from './env';
import { connection, launcher, sendFromLauncher } from './solana';

const PUMPPORTAL = 'https://pumpportal.fun/api/trade-local';
export const PUMP_PROGRAM = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
export const TOKEN_DECIMALS = 6;
export const TOTAL_SUPPLY = 1_000_000_000;
/** Tokens a fresh pump.fun curve sells before it graduates (base units / 1e6). */
export const INITIAL_REAL_TOKEN_RESERVES = 793_100_000;

export const bondingCurvePda = (mint: PublicKey) => PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'), mint.toBuffer()], PUMP_PROGRAM)[0];
export const pumpUrl = (mint: string) => `https://pump.fun/coin/${mint}`;
const fakeSig = (tag: string) => `test-${tag}-${crypto.randomBytes(20).toString('hex')}`;

async function portal(body: Record<string, unknown>): Promise<VersionedTransaction> {
  const r = await fetch(PUMPPORTAL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`PumpPortal ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
  return VersionedTransaction.deserialize(new Uint8Array(await r.arrayBuffer()));
}

async function sendSigned(tx: VersionedTransaction): Promise<string> {
  const c = connection();
  const sig = await c.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 5 });
  const { blockhash, lastValidBlockHeight } = await c.getLatestBlockhash('confirmed');
  const res = await c.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
  if (res.value.err) throw new Error(`transaction failed: ${JSON.stringify(res.value.err)}`);
  return sig;
}

/** Pins the image + metadata on pump.fun's IPFS (what pump.fun's own create page uses). */
export async function uploadMetadata(o: { name: string; symbol: string; description: string; image: Buffer; website?: string; twitter?: string }): Promise<string> {
  if (env.TEST_MODE) return `https://example.invalid/test-metadata/${o.symbol}.json`;
  const fd = new FormData();
  fd.append('file', new Blob([new Uint8Array(o.image)], { type: 'image/png' }), 'box.png');
  fd.append('name', o.name); fd.append('symbol', o.symbol); fd.append('description', o.description); fd.append('showName', 'true');
  if (o.website) fd.append('website', o.website);
  if (o.twitter) fd.append('twitter', o.twitter);
  const r = await fetch('https://pump.fun/api/ipfs', { method: 'POST', body: fd, headers: { 'User-Agent': 'Mozilla/5.0', Origin: 'https://pump.fun', Referer: 'https://pump.fun/create' }, signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`pump.fun metadata upload failed: ${r.status}`);
  const j = (await r.json()) as { metadataUri?: string };
  if (!j.metadataUri) throw new Error('pump.fun metadata upload returned no URI');
  return j.metadataUri;
}

/** Creates the coin from the launcher wallet. Returns the mint and signature. */
export async function createCoin(o: { name: string; symbol: string; uri: string; devBuySol: number }): Promise<{ mint: string; sig: string }> {
  const mint = Keypair.generate();
  if (env.TEST_MODE) return { mint: mint.publicKey.toBase58(), sig: fakeSig('create') };
  const kp = launcher();
  const tx = await portal({
    publicKey: kp.publicKey.toBase58(), action: 'create', tokenMetadata: { name: o.name, symbol: o.symbol, uri: o.uri },
    mint: mint.publicKey.toBase58(), denominatedInSol: 'true', amount: o.devBuySol, slippage: 10, priorityFee: 0.0005, pool: 'pump',
  });
  tx.sign([mint, kp]);
  return { mint: mint.publicKey.toBase58(), sig: await sendSigned(tx) };
}

/** Collects all pump.fun creator fees owed to the launcher. Returns lamports actually received. */
export async function collectCreatorFees(testLamports = 0n): Promise<{ sig: string; lamports: bigint } | null> {
  if (env.TEST_MODE) return testLamports > 0n ? { sig: fakeSig('collect'), lamports: testLamports } : null;
  const kp = launcher();
  const tx = await portal({ publicKey: kp.publicKey.toBase58(), action: 'collectCreatorFee', priorityFee: 0.0002, pool: 'pump' });
  tx.sign([kp]);
  const sig = await sendSigned(tx);
  // SOL received = launcher balance change + the fee it paid
  const t = await connection().getTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' });
  if (!t?.meta) throw new Error('collect transaction not found');
  const keys = t.transaction.message.getAccountKeys().staticAccountKeys.map((k) => k.toBase58());
  const i = keys.indexOf(kp.publicKey.toBase58());
  const received = BigInt(t.meta.postBalances[i] - t.meta.preBalances[i] + t.meta.fee);
  return { sig, lamports: received > 0n ? received : 0n };
}

async function tokenProgramOf(mint: PublicKey) {
  const info = await connection().getAccountInfo(mint);
  return info?.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
}

/** Dead coins: buy back with `lamports` from the launcher. Returns tokens received (base units). */
export async function buyBack(mintStr: string, lamports: bigint): Promise<{ sig: string; tokens: bigint }> {
  if (env.TEST_MODE) return { sig: fakeSig('buyback'), tokens: lamports * 30n }; // stand-in rate
  const kp = launcher();
  const mint = new PublicKey(mintStr);
  const prog = await tokenProgramOf(mint);
  const ata = getAssociatedTokenAddressSync(mint, kp.publicKey, false, prog);
  const before = await connection().getTokenAccountBalance(ata).then((b) => BigInt(b.value.amount)).catch(() => 0n);
  const tx = await portal({ publicKey: kp.publicKey.toBase58(), action: 'buy', mint: mintStr, denominatedInSol: 'true', amount: Number(lamports) / 1e9, slippage: 15, priorityFee: 0.0002, pool: 'auto' });
  tx.sign([kp]);
  const sig = await sendSigned(tx);
  const after = await connection().getTokenAccountBalance(ata).then((b) => BigInt(b.value.amount)).catch(() => 0n);
  return { sig, tokens: after > before ? after - before : 0n };
}

/** Burns `tokens` of the mint from the launcher's token account. */
export async function burnTokens(mintStr: string, tokens: bigint): Promise<string> {
  if (env.TEST_MODE) return fakeSig('burn');
  const kp = launcher();
  const mint = new PublicKey(mintStr);
  const prog = await tokenProgramOf(mint);
  const info = await getMint(connection(), mint, 'confirmed', prog);
  const ata = getAssociatedTokenAddressSync(mint, kp.publicKey, false, prog);
  return sendFromLauncher([ComputeBudgetProgram.setComputeUnitLimit({ units: 60_000 }), createBurnCheckedInstruction(ata, mint, kp.publicKey, tokens, info.decimals, [], prog)]);
}

// End-to-end: launch -> commitment memo on devnet -> first buy -> collapse -> seed verifies against
// the on-chain memo (exactly as the browser does) -> fees collected -> an Alive coin pays its holders
// exactly once under 5 simultaneous payout runs -> a Dead coin buys back and burns exactly once.
// Runs in TEST_MODE against a fresh schema created for this run. Usage: npm run e2e
import fs from 'node:fs';
import { execSync } from 'node:child_process';

// ---- environment: .env, TEST_MODE forced, isolated schema ----
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
process.env.TEST_MODE = 'true';
const base = process.env.DATABASE_URL!;
// a fresh schema per run: created here, pushed non-destructively, dropped at the end of this run only
const SCHEMA = `e2e_${Date.now()}`;
process.env.DATABASE_URL = base + (base.includes('?') ? '&' : '?') + `schema=${SCHEMA}`;

let failures = 0;
const ok = (cond: unknown, label: string) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++; };

async function main() {
  execSync('npx prisma db push --skip-generate', { stdio: 'ignore', env: process.env });
  const { prisma } = await import('../src/lib/db');
  const { launchBox } = await import('../src/lib/launch');
  const { simulateTrade } = await import('../src/lib/observe');
  const { decohere } = await import('../src/lib/collapse');
  const { boxDetail } = await import('../src/lib/public');
  const { verifyCollapse, commitmentOf, memosFromTx, parseCommitMemo } = await import('../src/lib/verify');
  const { publicRpcUrl } = await import('../src/lib/env');
  const { setKV } = await import('../src/lib/kv');
  const { snapshotHolders } = await import('../src/lib/holders');
  const { collectAndAllocate, splitShare } = await import('../src/lib/fees');
  const { runDistribution } = await import('../src/lib/payouts');
  const { Keypair } = await import('@solana/web3.js');
  const wallet = () => Keypair.generate().publicKey.toBase58();
  const rpc = publicRpcUrl();

  async function memoOnChain(sig: string, n: number) {
    for (let i = 0; i < 8; i++) {
      const r = await fetch(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: [sig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }] }) });
      const j = await r.json();
      if (j.result) return memosFromTx(j.result).map((m) => parseCommitMemo(m, n)).find(Boolean) ?? null;
      await new Promise((ok2) => setTimeout(ok2, 1500));
    }
    return null;
  }

  // ---- 1. launch until we have one Alive and one Dead box, plus one left sealed for decoherence ----
  const collapsed: Record<'ALIVE' | 'DEAD', string | null> = { ALIVE: null, DEAD: null };
  let sealedForDecoherence: string | null = null;
  let launches = 0;
  while ((!collapsed.ALIVE || !collapsed.DEAD || !sealedForDecoherence) && launches < 10) {
    launches++;
    const box = await launchBox({ ticker: `E2E${launches}`, creatorWallet: wallet() });
    if (launches === 1) {
      ok(box.state === 'SEALED' && !!box.mint, 'launch: box is sealed with a mint');
      ok(!!box.commitSig && !box.commitSig.startsWith('test-'), `launch: commitment memo sent on devnet (${box.commitSig})`);
      const onChain = await memoOnChain(box.commitSig!, box.number);
      ok(onChain === box.commitment, 'commitment: memo on devnet equals the published sha256');
      ok(box.commitment === (await commitmentOf(box.seed)), 'commitment: equals sha256(seed)');
      const pub = await boxDetail(box.mint!);
      ok(pub !== null && pub.seed === null && pub.name === null && pub.fate === null, 'sealed: the API hides seed, name and fate');
      console.log(`      seed source: ${box.seedSource} (${box.seedProvider})${box.seedNote ? ` note: ${box.seedNote}` : ''}`);
    }
    if (!sealedForDecoherence && launches >= 2) { sealedForDecoherence = box.id; continue; }
    const observer = wallet();
    await simulateTrade(box.id, observer, 0.5, true);
    const after = await prisma.box.findUniqueOrThrow({ where: { id: box.id } });
    if (launches === 1) {
      ok(after.state === 'COLLAPSED' && after.collapseReason === 'FIRST_BUY', 'first buy: box collapsed');
      ok(after.observerWallet === observer, 'first buy: buyer recorded as the observer');
      ok(after.verifiedOnChain, 'collapse: server re-checked the seed against the on-chain memo');
      const pub = await boxDetail(after.mint!);
      const v = await verifyCollapse({ seedHex: pub!.seed!, commitment: pub!.commitment, number: pub!.number, commitSig: pub!.commitSig!, rpcUrl: rpc });
      ok(v.ok && v.onChain === v.computed, 'verify: browser-side check passes against devnet');
      const bad = await verifyCollapse({ seedHex: 'ff' + pub!.seed!.slice(2), commitment: pub!.commitment, number: pub!.number, commitSig: pub!.commitSig!, rpcUrl: rpc });
      ok(!bad.ok, 'verify: a tampered seed fails');
      await simulateTrade(box.id, wallet(), 0.4, true);
      ok((await prisma.box.findUniqueOrThrow({ where: { id: box.id } })).observerWallet === observer, 'second buy does not change the observer');
    }
    if (after.fate && !collapsed[after.fate]) collapsed[after.fate] = after.id;
  }
  ok(!!collapsed.ALIVE && !!collapsed.DEAD, `got an Alive and a Dead box in ${launches} launches`);
  if (!collapsed.ALIVE || !collapsed.DEAD) throw new Error('could not get both fates');

  // ---- 2. decoherence ----
  await prisma.box.update({ where: { id: sealedForDecoherence! }, data: { decoheresAt: new Date(Date.now() - 1000) } });
  await decohere();
  const dec = await prisma.box.findUniqueOrThrow({ where: { id: sealedForDecoherence! } });
  ok(dec.state === 'COLLAPSED' && dec.collapseReason === 'DECOHERENCE' && dec.observerWallet === null, 'decoherence: unbought box collapsed on its own');

  // ---- 3. trading -> creator fees -> collection ----
  for (const id of [collapsed.ALIVE, collapsed.DEAD]) for (let i = 0; i < 5; i++) await simulateTrade(id, wallet(), 1 + i, true);
  const before = await prisma.box.findMany({ where: { id: { in: [collapsed.ALIVE, collapsed.DEAD] } } });
  ok(before.every((b) => b.feesAccrued > 0n), 'trades accrued creator fees');
  console.log(`      fees: ${await collectAndAllocate()}`);
  const afterFees = await prisma.box.findMany({ where: { id: { in: [collapsed.ALIVE, collapsed.DEAD] } } });
  for (const b of afterFees) {
    const { creator, pool } = splitShare(b.feesAccrued);
    ok(b.feesAllocated === b.feesAccrued && b.pendingCreator === creator && b.pendingPool === pool, `fees: box #${b.number} allocated ${b.feesAllocated} = ${creator} creator + ${pool} pool`);
  }

  // ---- 4. Alive: holders paid exactly once under 5 simultaneous runs ----
  const alive = afterFees.find((b) => b.id === collapsed.ALIVE)!;
  const holders: Record<string, string> = {};
  for (let i = 0; i < 7; i++) holders[wallet()] = String(1_000_000 * (i + 1));
  await setKV(`testHolders:${alive.id}`, JSON.stringify(holders));
  await snapshotHolders(alive, new Date(Date.now() - 30 * 60_000));
  await snapshotHolders(alive, new Date());
  const runs = await Promise.all([
    runDistribution({ useLease: false }), runDistribution({ useLease: false }), runDistribution({ useLease: false }),
    runDistribution(), runDistribution(),
  ]);
  console.log(`      5 simultaneous runs: ${runs.join(' | ')}`);
  await Promise.all([runDistribution({ useLease: false }), runDistribution({ useLease: false })]); // stragglers, and a second cycle with nothing new
  const hp = await prisma.payout.findMany({ where: { boxId: alive.id, kind: 'HOLDER' } });
  const perWallet = new Map<string, number>();
  for (const p of hp) perWallet.set(p.wallet, (perWallet.get(p.wallet) ?? 0) + 1);
  ok(hp.length === Object.keys(holders).length && [...perWallet.values()].every((n) => n === 1), `alive: ${hp.length} holders, each paid exactly once`);
  ok(hp.every((p) => p.status === 'PAID' && !!p.sig), 'alive: every payout is PAID with a signature');
  const aliveAfter = await prisma.box.findUniqueOrThrow({ where: { id: alive.id } });
  const paidSum = hp.reduce((a, p) => a + p.lamports, 0n);
  ok(paidSum + aliveAfter.pendingPool === alive.pendingPool && aliveAfter.holdersPaid === paidSum, `alive: paid ${paidSum} + dust ${aliveAfter.pendingPool} = pool ${alive.pendingPool}`);
  const cp = await prisma.payout.findMany({ where: { boxId: alive.id, kind: 'CREATOR' } });
  ok(cp.length === 1 && cp[0].lamports === alive.pendingCreator && cp[0].wallet === alive.creatorWallet, 'alive: creator paid its share exactly once');
  const heavy = Object.entries(holders).sort((a, b) => Number(BigInt(b[1]) - BigInt(a[1])))[0][0];
  const light = Object.entries(holders).sort((a, b) => Number(BigInt(a[1]) - BigInt(b[1])))[0][0];
  ok(hp.find((p) => p.wallet === heavy)!.lamports > hp.find((p) => p.wallet === light)!.lamports, 'alive: payouts follow holdings');

  // ---- 5. Dead: buyback + burn exactly once ----
  const dead = afterFees.find((b) => b.id === collapsed.DEAD)!;
  const burns = await prisma.burn.findMany({ where: { boxId: dead.id } });
  ok(burns.length === 1 && burns[0].status === 'BURNED' && burns[0].lamports === dead.pendingPool, `dead: one buyback of ${dead.pendingPool} lamports, burned`);
  ok(!!burns[0]?.buySig && !!burns[0]?.burnSig && burns[0].tokens > 0n, 'dead: buy and burn transactions recorded');
  const deadAfter = await prisma.box.findUniqueOrThrow({ where: { id: dead.id } });
  ok(deadAfter.pendingPool === 0n && deadAfter.tokensBurned === burns[0].tokens, 'dead: pool emptied, tokens burned counted');
  ok((await prisma.payout.count({ where: { boxId: dead.id, kind: 'HOLDER' } })) === 0, 'dead: no holder payouts');
  ok((await prisma.payout.count({ where: { status: { in: ['PENDING', 'SENDING', 'FAILED'] } } })) === 0, 'no payouts left pending, sending or failed');

  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`); // only the schema this run created
  await prisma.$disconnect();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

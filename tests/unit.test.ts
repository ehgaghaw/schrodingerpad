// Unit tests: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { deriveIdentity, RARITY_ODDS } from '../src/lib/identity';
import { commitmentOf, commitMemo, parseCommitMemo, memosFromTx } from '../src/lib/verify';
import { allocate } from '../src/lib/fees';
import { holderShares } from '../src/lib/payouts';

test('identity is deterministic and depends only on the seed', () => {
  const seed = crypto.randomBytes(32).toString('hex');
  assert.deepEqual(deriveIdentity(seed, 50), deriveIdentity(seed, 50));
  assert.notDeepEqual(deriveIdentity(seed, 50).name + deriveIdentity(seed, 50).lore, deriveIdentity(crypto.randomBytes(32).toString('hex'), 50).name + 'x');
});

test('fate and rarity odds hold over many seeds', () => {
  const N = 40_000;
  let alive = 0, ultra = 0, rare = 0, uncommon = 0;
  for (let i = 0; i < N; i++) {
    const id = deriveIdentity(crypto.randomBytes(32).toString('hex'), 50);
    if (id.fate === 'ALIVE') alive++;
    if (id.rarity === 'ULTRA_RARE') ultra++; else if (id.rarity === 'RARE') rare++; else if (id.rarity === 'UNCOMMON') uncommon++;
  }
  assert.ok(Math.abs(alive / N - 0.5) < 0.015, `alive ${alive / N}`);
  assert.ok(Math.abs(rare / N - RARITY_ODDS.RARE / 1e6) < 0.006, `rare ${rare / N}`);
  assert.ok(Math.abs(uncommon / N - RARITY_ODDS.UNCOMMON / 1e6) < 0.01, `uncommon ${uncommon / N}`);
  assert.ok(ultra / N < 0.006, `ultra ${ultra / N}`);
  assert.equal(deriveIdentity('00'.repeat(32), 100).fate, 'ALIVE');
  assert.equal(deriveIdentity('00'.repeat(32), 0).fate, 'DEAD');
});

test('commitment is sha256 of the seed bytes and round-trips through the memo', async () => {
  const seed = crypto.randomBytes(32);
  const c = await commitmentOf(seed.toString('hex'));
  assert.equal(c, crypto.createHash('sha256').update(seed).digest('hex'));
  const memo = commitMemo(42, c);
  assert.equal(parseCommitMemo(memo, 42), c);
  assert.equal(parseCommitMemo(memo, 43), null);
  const tx = { transaction: { message: { instructions: [{ program: 'spl-memo', parsed: memo }] } } };
  assert.deepEqual(memosFromTx(tx), [memo]);
});

test('fee allocation never credits more than was received', () => {
  const u = [{ id: 'a', lamports: 600n }, { id: 'b', lamports: 400n }];
  const full = allocate(1000n, u);
  assert.deepEqual(full.out, u); assert.equal(full.unattributed, 0n);
  const part = allocate(500n, u);
  assert.equal(part.out.reduce((a, b) => a + b.lamports, 0n) + part.unattributed, 500n);
  assert.deepEqual(part.out.map((x) => x.lamports), [300n, 200n]);
  const extra = allocate(1300n, u);
  assert.equal(extra.unattributed, 300n);
});

test('holder shares follow weights and drop dust', () => {
  const s = holderShares(1_000_000n, new Map([['a', 3n], ['b', 1n], ['dust', 0n]]), 1000n);
  assert.equal(s.get('a'), 750_000n); assert.equal(s.get('b'), 250_000n); assert.equal(s.has('dust'), false);
});

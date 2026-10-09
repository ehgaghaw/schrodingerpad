// Turns a revealed seed into a box's identity. Fully deterministic: the same seed always gives
// the same name, art traits, rarity, lore and fate, so anyone can re-derive it from the seed.
// Each property uses its own labelled HMAC-SHA256 stream, so properties are independent.
import crypto from 'node:crypto';

export const IDENTITY_VERSION = 'v1';

export type Rarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'ULTRA_RARE';
export type Fate = 'ALIVE' | 'DEAD';
export type Traits = {
  field: string; // background pattern
  form: string; // body silhouette
  eyes: string;
  mark: string; // forehead/cheek mark
  orbit: number; // number of orbit rings
  inverted: boolean; // ultra-rare: inverted palette
};
export type Identity = { name: string; rarity: Rarity; rarityRoll: number; fate: Fate; lore: string; traits: Traits };

/** Rarity odds, out of 1,000,000: ultra-rare 1 in 500, rare 3%, uncommon 17%, common the rest. */
export const RARITY_ODDS = { ULTRA_RARE: 2_000, RARE: 30_000, UNCOMMON: 170_000 } as const;

const ADJ = ['Entangled', 'Uncertain', 'Superposed', 'Quiet', 'Hollow', 'Tunneling', 'Drifting', 'Phantom', 'Latent', 'Spectral', 'Wandering', 'Observed', 'Faint', 'Restless', 'Folded', 'Coherent', 'Silent', 'Orbiting', 'Fractured', 'Lucid', 'Static', 'Inverted', 'Paradox', 'Recursive', 'Velvet', 'Midnight', 'Patient', 'Curious', 'Clever', 'Distant'];
const NOUN = ['Tabby', 'Whisker', 'Paw', 'Kitten', 'Tom', 'Mouser', 'Purr', 'Shadow', 'Moggy', 'Prowler', 'Stray', 'Sphinx', 'Lynx', 'Ocelot', 'Calico', 'Nibbler', 'Pounce', 'Velvetpaw', 'Gloom', 'Ember', 'Quark', 'Boson', 'Photon', 'Lepton', 'Muon', 'Gluon', 'Fermion', 'Qubit', 'Wavelet', 'Eigen'];
const TITLE = ['the Unobserved', 'the Last Measurement', 'of Both Worlds', 'the Collapsed Crown', 'Beyond the Lid'];
const FIELDS = ['grid', 'rings', 'waves', 'static', 'void', 'lattice'];
const FORMS = ['round', 'tall', 'wide', 'angular', 'small'];
const EYES = ['open', 'narrow', 'wide', 'sleepy', 'spiral'];
const MARKS = ['none', 'dot', 'bar', 'triangle', 'ring', 'double-dot'];
const PLACES = ['a steel box', 'a sealed crate', 'a lab at 3 a.m.', 'a cold vacuum', 'a box nobody opened', 'the space between two outcomes'];
const DEEDS = ['waited out the measurement', 'counted every photon', 'refused to choose a side', 'listened for the lid', 'outlived the probability', 'heard the first buy coming'];
const ENDS_ALIVE = ['and walked out purring.', 'and stepped into the light.', 'and chose to stay.', 'and landed on its feet.'];
const ENDS_DEAD = ['and the wave function went quiet.', 'and the lid closed for good.', 'and became a story instead.', 'and left only the math behind.'];

function stream(seedHex: string, label: string): Buffer {
  return crypto.createHmac('sha256', Buffer.from(seedHex, 'hex')).update(`${IDENTITY_VERSION}:${label}`).digest();
}
/** Uniform integer in [0, n) from a labelled stream (rejection-free: 32-bit value mod small n has negligible bias). */
const pick = (seedHex: string, label: string, n: number) => stream(seedHex, label).readUInt32BE(0) % n;
const from = <T>(seedHex: string, label: string, list: readonly T[]) => list[pick(seedHex, label, list.length)];

export function deriveIdentity(seedHex: string, aliveOddsPercent: number): Identity {
  if (!/^[0-9a-f]{64}$/.test(seedHex)) throw new Error('seed must be 32 bytes of hex');
  const roll = pick(seedHex, 'rarity', 1_000_000);
  const rarity: Rarity = roll < RARITY_ODDS.ULTRA_RARE ? 'ULTRA_RARE' : roll < RARITY_ODDS.ULTRA_RARE + RARITY_ODDS.RARE ? 'RARE' : roll < RARITY_ODDS.ULTRA_RARE + RARITY_ODDS.RARE + RARITY_ODDS.UNCOMMON ? 'UNCOMMON' : 'COMMON';
  const fate: Fate = pick(seedHex, 'fate', 10_000) < Math.round(aliveOddsPercent * 100) ? 'ALIVE' : 'DEAD';
  let name = `${from(seedHex, 'adj', ADJ)} ${from(seedHex, 'noun', NOUN)}`;
  if (rarity === 'RARE' || rarity === 'ULTRA_RARE') name = `${name} ${from(seedHex, 'title', TITLE)}`;
  const traits: Traits = {
    field: from(seedHex, 'field', FIELDS),
    form: from(seedHex, 'form', FORMS),
    eyes: from(seedHex, 'eyes', EYES),
    mark: rarity === 'COMMON' ? 'none' : from(seedHex, 'mark', MARKS.slice(1)),
    orbit: rarity === 'ULTRA_RARE' ? 3 : rarity === 'RARE' ? 2 : rarity === 'UNCOMMON' ? 1 : 0,
    inverted: rarity === 'ULTRA_RARE',
  };
  const lore = `Born in ${from(seedHex, 'place', PLACES)}, it ${from(seedHex, 'deed', DEEDS)} ${fate === 'ALIVE' ? from(seedHex, 'end-a', ENDS_ALIVE) : from(seedHex, 'end-d', ENDS_DEAD)}`;
  return { name, rarity, rarityRoll: roll, fate, lore, traits };
}

export const rarityLabel = (r: Rarity | null | undefined) => (r === 'ULTRA_RARE' ? 'Ultra rare' : r === 'RARE' ? 'Rare' : r === 'UNCOMMON' ? 'Uncommon' : r === 'COMMON' ? 'Common' : '');

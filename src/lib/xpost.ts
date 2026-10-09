// Optional: post each collapse to X (X_POSTING=true plus the four X_* keys). Plain text, no emoji.
import { TwitterApi } from 'twitter-api-v2';
import { prisma } from './db';
import { env, boxName } from './env';
import { rarityLabel, type Rarity } from './identity';
import { log } from './log';

export const xEnabled = () => env.X_POSTING && !!(env.X_API_KEY && env.X_API_SECRET && env.X_ACCESS_TOKEN && env.X_ACCESS_SECRET);

export function collapseText(b: { number: number; name: string | null; fate: string | null; rarity: string | null; seedSource: string; mint: string | null }) {
  const url = env.PUBLIC_URL && b.mint ? `${env.PUBLIC_URL}/box/${b.mint}` : '';
  return [
    `${boxName(b.number)} collapsed.`,
    `${b.name}`,
    `Fate: ${b.fate === 'ALIVE' ? 'Alive' : 'Dead'}. Rarity: ${rarityLabel(b.rarity as Rarity)}.`,
    `Seed: ${b.seedSource === 'QUANTUM' ? 'quantum' : 'classical fallback'}, verified against the on-chain commitment.`,
    url,
  ].filter(Boolean).join('\n');
}

export async function postPendingCollapses() {
  if (!xEnabled()) return 0;
  const client = new TwitterApi({ appKey: env.X_API_KEY, appSecret: env.X_API_SECRET, accessToken: env.X_ACCESS_TOKEN, accessSecret: env.X_ACCESS_SECRET });
  const due = await prisma.box.findMany({ where: { state: 'COLLAPSED', postedAt: null, test: false }, orderBy: { collapsedAt: 'asc' }, take: 3 });
  let n = 0;
  for (const b of due) {
    // claim first so two workers never post the same collapse
    const c = await prisma.box.updateMany({ where: { id: b.id, postedAt: null }, data: { postedAt: new Date() } });
    if (c.count !== 1) continue;
    try {
      const mediaId = b.art ? await client.v1.uploadMedia(Buffer.from(b.art), { mimeType: 'image/png' }) : undefined;
      const t = await client.v2.tweet({ text: collapseText(b), ...(mediaId ? { media: { media_ids: [mediaId] } } : {}) });
      await prisma.box.update({ where: { id: b.id }, data: { postId: t.data.id } });
      n++;
    } catch (e) {
      await log('x', `post for box #${b.number} failed: ${(e as Error).message.slice(0, 200)}`, 'warn');
    }
  }
  return n;
}

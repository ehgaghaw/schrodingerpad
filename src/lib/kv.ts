import { prisma } from './db';

export async function getKV(key: string) { return (await prisma.kV.findUnique({ where: { key } }))?.value ?? null; }
export async function setKV(key: string, value: string) { await prisma.kV.upsert({ where: { key }, create: { key, value }, update: { value } }); }
export const isPaused = async () => (await getKV('paused')) === '1';

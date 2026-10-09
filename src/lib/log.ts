import { prisma } from './db';

/** Console + a capped log table the admin page reads. Never pass secrets in. */
export async function log(scope: string, msg: string, level: 'info' | 'warn' | 'error' = 'info') {
  const line = `[${scope}] ${msg}`;
  if (level === 'error') console.error(line); else if (level === 'warn') console.warn(line); else console.log(line);
  try { await prisma.logEntry.create({ data: { scope, msg: msg.slice(0, 1000), level } }); } catch { /* logging never breaks a job */ }
}

// Seed script: npm run db:seed
// Always: default settings. With TEST_MODE=true and `-- --demo`: launches a few devnet test boxes
// (real commitment memos on devnet) and simulates trading so the site has something to show.
import { prisma } from '../src/lib/db';
import { env } from '../src/lib/env';

async function main() {
  await prisma.kV.upsert({ where: { key: 'paused' }, create: { key: 'paused', value: '0' }, update: {} });
  console.log('settings ready');
  if (!process.argv.includes('--demo')) return;
  if (!env.TEST_MODE) throw new Error('--demo only runs with TEST_MODE=true (devnet)');
  const { launchBox } = await import('../src/lib/launch');
  const { simulateTrade } = await import('../src/lib/observe');
  const { Keypair } = await import('@solana/web3.js');
  const w = () => Keypair.generate().publicKey.toBase58();
  const tickers = ['QBIT', 'PURR', 'LID', 'BOSON', 'TABBY', 'SPIN'];
  for (let i = 0; i < tickers.length; i++) {
    const box = await launchBox({ ticker: tickers[i], creatorWallet: w() });
    if (i < 4) {
      for (let k = 0; k < 4 + i * 2; k++) await simulateTrade(box.id, w(), 0.2 + Math.random() * (1 + i), Math.random() > 0.25);
    }
    console.log(`box #${box.number} ${tickers[i]} ${i < 4 ? 'traded' : 'left sealed'}`);
  }
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });

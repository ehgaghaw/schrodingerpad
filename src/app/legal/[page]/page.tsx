import { notFound } from 'next/navigation';

const PAGES: Record<string, { title: string; body: string[] }> = {
  terms: {
    title: 'Terms of use',
    body: [
      'SchrodingerPad is noncustodial software. You use it at your own risk and are responsible for complying with the laws that apply to you.',
      'Coins are created on pump.fun by the SchrodingerPad launcher wallet on your behalf. The on-chain token name is "SchrodingerPad Box #N". The collapsed name, art, fate and rarity are shown on this site and its X account; they are not written into the token.',
      'Launch fees are not refundable once a coin is created. If a launch fails after payment, contact us on X with your transaction signature.',
      'We may pause payouts and burns at any time, for example to investigate a problem. Paused amounts stay recorded per coin.',
    ],
  },
  privacy: {
    title: 'Privacy',
    body: [
      'We store public blockchain data: wallet addresses, transactions and balances. We do not ask for names, emails or other personal data.',
      'Basic server logs (IP address, user agent) are kept for a short time to keep the service running and to block abuse.',
    ],
  },
  risk: {
    title: 'Risk disclosure',
    body: [
      'Memecoins are highly speculative and can go to zero. Most do.',
      'Every collapse is random. A coin can come out Dead, in which case its fee pool buys back and burns the coin instead of paying holders.',
      'Holder payouts depend on creator fees, which depend on trading volume that may never happen. Nothing is promised.',
      'The quantum random number service can be unavailable. When it is, the seed comes from a classical generator and the coin page says so.',
      'Nothing on this site is financial advice.',
    ],
  },
};

export function generateMetadata({ params }: { params: { page: string } }) {
  return { title: PAGES[params.page]?.title ?? 'Legal' };
}

export default function Legal({ params }: { params: { page: string } }) {
  const p = PAGES[params.page];
  if (!p) notFound();
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{p.title}</h1>
      <div className="mt-6 space-y-4 text-mute">{p.body.map((x, i) => <p key={i}>{x}</p>)}</div>
    </div>
  );
}

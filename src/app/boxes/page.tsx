import { TokenTable } from '@/components/TokenTable';

export const metadata = { title: 'Boxes' };

export default function Boxes() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Boxes</h1>
      <p className="mt-2 text-mute">Every box ever launched, sealed or collapsed.</p>
      <div className="mt-8"><TokenTable initialFilter="new" /></div>
    </div>
  );
}

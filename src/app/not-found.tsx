import Link from 'next/link';
import { SealedBox } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="mx-auto grid max-w-md place-items-center gap-4 px-4 py-24 text-center">
      <SealedBox size={200} />
      <h1 className="text-2xl font-semibold">Nothing in this box</h1>
      <p className="text-mute">The page you are looking for does not exist.</p>
      <Link href="/" className="btn">Back to the launchpad</Link>
    </div>
  );
}

import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { env } from '@/lib/env';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: env.PUBLIC_URL ? new URL(env.PUBLIC_URL) : undefined,
  title: { default: 'SchrodingerPad', template: '%s · SchrodingerPad' },
  description: 'Every coin is born in a sealed box. The first buy opens it. Quantum randomness decides what it becomes. Verified on-chain.',
  openGraph: { title: 'SchrodingerPad', description: 'Every coin is born in a sealed box. The first buy opens it.', siteName: 'SchrodingerPad', type: 'website' },
  twitter: { card: 'summary', title: 'SchrodingerPad', description: 'Every coin is born in a sealed box. The first buy opens it.' },
};
export const viewport: Viewport = { themeColor: '#000000', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-black font-sans text-ink">
        <Providers>
          <Nav xHandle={env.X_HANDLE} />
          <main>{children}</main>
          <Footer xHandle={env.X_HANDLE} github={env.GITHUB_URL} />
        </Providers>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Providers } from '@/components/Providers';
import { BrandedLoader } from '@/components/BrandedLoader';
import { NavDirectionProvider } from '@/components/NavDirectionProvider';
import { CommandPalette } from '@/components/CommandPalette';
import { KeyboardShortcuts } from '@/components/KeyboardShortcuts';
import { ShortcutsHelpOverlay } from '@/components/ShortcutsHelpOverlay';
import { InstallPrompt } from '@/components/InstallPrompt';
import { OfflineBanner } from '@/components/OfflineBanner';
import { CivicaShell } from '@/components/civica/CivicaShell';
import { GovernanceFontProvider } from '@/components/GovernanceFontProvider';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Civica — Cardano Governance Intelligence',
  description:
    'The civic hub for the Cardano Nation. Find your DRep, track governance proposals, and participate in on-chain democracy.',
  keywords: [
    'Cardano',
    'DRep',
    'Governance',
    'Delegation',
    'ADA',
    'Blockchain',
    'Voting',
    'Civica',
    'SPO',
  ],
  openGraph: {
    title: 'Civica — Cardano Governance Intelligence',
    description:
      'The civic hub for Cardano. Find your DRep, track proposals, and take action in governance.',
    type: 'website',
  },
  manifest: '/manifest.json',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'Civica',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#0a0b14',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
          <Providers>
            <NavDirectionProvider>
              <BrandedLoader />
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none"
              >
                Skip to main content
              </a>
              <GovernanceFontProvider />
              <CivicaShell>{children}</CivicaShell>
              <CommandPalette />
              <KeyboardShortcuts />
              <ShortcutsHelpOverlay />
              <InstallPrompt />
              <OfflineBanner />
            </NavDirectionProvider>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}

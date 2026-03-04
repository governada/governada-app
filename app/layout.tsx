import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { HeaderClient } from '@/components/HeaderClient';
import { Footer } from '@/components/Footer';
import { ThemeProvider } from '@/components/theme-provider';
import { Providers } from '@/components/Providers';
import { BrandedLoader } from '@/components/BrandedLoader';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { NavDirectionProvider } from '@/components/NavDirectionProvider';
import { SyncFreshnessBanner } from '@/components/SyncFreshnessBanner';
import { CommandPalette } from '@/components/CommandPalette';
import { KeyboardShortcuts } from '@/components/KeyboardShortcuts';
import { ShortcutsHelpOverlay } from '@/components/ShortcutsHelpOverlay';
import { InstallPrompt } from '@/components/InstallPrompt';
import { OfflineBanner } from '@/components/OfflineBanner';
import { EasterEggs } from '@/components/EasterEggs';
import { CivicaShell } from '@/components/civica/CivicaShell';
import { getFeatureFlag } from '@/lib/featureFlags';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'DRepScore - Find Your Ideal Cardano DRep',
  description:
    'Discover and delegate to Cardano DReps aligned with your values. Compare accountability scores, voting records, and value alignment.',
  keywords: ['Cardano', 'DRep', 'Governance', 'Delegation', 'ADA', 'Blockchain', 'Voting'],
  openGraph: {
    title: 'DRepScore - Find Your Ideal Cardano DRep',
    description: 'Discover and delegate to Cardano DReps aligned with your values',
    type: 'website',
  },
  manifest: '/manifest.json',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'DRepScore',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const civicaEnabled = await getFeatureFlag('civica_frontend', false);

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <Providers>
            <NavDirectionProvider>
              <BrandedLoader />
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none"
              >
                Skip to main content
              </a>
              {civicaEnabled ? (
                <CivicaShell>{children}</CivicaShell>
              ) : (
                <>
                  <HeaderClient />
                  <SyncFreshnessBanner />
                  <main id="main-content" className="min-h-screen pb-16 sm:pb-0" tabIndex={-1}>
                    {children}
                  </main>
                  <Footer />
                  <MobileBottomNav />
                </>
              )}
              <CommandPalette />
              <KeyboardShortcuts />
              <ShortcutsHelpOverlay />
              <InstallPrompt />
              <OfflineBanner />
              {!civicaEnabled && <EasterEggs />}
            </NavDirectionProvider>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}

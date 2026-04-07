import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import { Geist, Space_Grotesk, Fraunces } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Providers } from '@/components/Providers';
import { BrandedLoader } from '@/components/BrandedLoader';
import { NavDirectionProvider } from '@/components/NavDirectionProvider';
import { CommandProvider } from '@/components/providers/CommandProvider';
import { InstallPrompt } from '@/components/InstallPrompt';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Toaster } from '@/components/ui/toaster';
import { GovernadaShell } from '@/components/governada/GovernadaShell';
import { GovernanceFontProvider } from '@/components/GovernanceFontProvider';
import { LocaleProvider } from '@/components/providers/LocaleProvider';
import { ModeProvider } from '@/components/providers/ModeProvider';
import { LOCALE_COOKIE, RTL_LOCALES, resolvePreferredLocale } from '@/lib/i18n/config';

// Nonce-based CSP requires dynamic rendering so Next can attach a request-scoped
// nonce to its inline/bootstrap scripts in production mode.
export const dynamic = 'force-dynamic';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  axes: ['SOFT', 'WONK', 'opsz'],
});

export const metadata: Metadata = {
  title: 'Governada — Cardano Governance Intelligence',
  description:
    'Governance intelligence for Cardano. Find your DRep, track governance proposals, and participate in on-chain democracy.',
  keywords: [
    'Cardano',
    'DRep',
    'Governance',
    'Delegation',
    'ADA',
    'Blockchain',
    'Voting',
    'Governada',
    'SPO',
  ],
  openGraph: {
    title: 'Governada — Cardano Governance Intelligence',
    description:
      'Governance intelligence for Cardano. Find your DRep, track proposals, and take action in governance.',
    type: 'website',
  },
  manifest: '/manifest.json',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'Governada',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#0a0b14',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const cookieStore = await cookies();
  const nonce = headerStore.get('x-nonce') ?? undefined;
  const locale = resolvePreferredLocale({
    cookieLocale: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerStore.get('accept-language'),
  });
  const dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';

  return (
    <html
      lang={locale}
      dir={dir}
      className="dark"
      style={{ colorScheme: 'dark' }}
      suppressHydrationWarning
    >
      <body
        className={`${geistSans.variable} ${spaceGrotesk.variable} ${fraunces.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          disableTransitionOnChange
          nonce={nonce}
        >
          <LocaleProvider initialLocale={locale}>
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
                <ModeProvider>
                  <GovernadaShell>{children}</GovernadaShell>
                </ModeProvider>
                <CommandProvider />
                <Toaster />
                <InstallPrompt />
                <OfflineBanner />
              </NavDirectionProvider>
            </Providers>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

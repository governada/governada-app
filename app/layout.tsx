import type { Metadata, Viewport } from 'next';
import { Geist, Space_Grotesk, Fraunces } from 'next/font/google';
import { headers } from 'next/headers';
import Script from 'next/script';
import { connection } from 'next/server';
import './globals.css';
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
import { DEFAULT_LOCALE, RTL_LOCALES } from '@/lib/i18n/config';
import { MotionStrengthProvider } from '@/lib/motion/motionStrength';

// DD05 route-owned locale contract:
// - Unprefixed routes render canonical English HTML at the document boundary.
// - User-selected locale remains a client-owned preference for translated chrome
//   and formatting until explicit localized route paths exist.
const DOCUMENT_LOCALE = DEFAULT_LOCALE;
const DOCUMENT_DIR = RTL_LOCALES.has(DOCUMENT_LOCALE) ? 'rtl' : 'ltr';
const CSP_DYNAMIC_SCRIPT_NONCE_BOOTSTRAP = `
(function () {
  var currentScript = document.currentScript;
  var nonce = currentScript && currentScript.nonce;
  if (!nonce || window.__governadaCspNoncePatched) return;
  window.__governadaCspNoncePatched = true;
  var createElement = Document.prototype.createElement;
  Document.prototype.createElement = function (tagName, options) {
    var element = createElement.call(this, tagName, options);
    if (String(tagName).toLowerCase() === 'script' && !element.nonce) {
      element.setAttribute('nonce', nonce);
    }
    return element;
  };
})();
`;

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

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Governada â€” Cardano Governance Intelligence',
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
    title: 'Governada â€” Cardano Governance Intelligence',
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
  // Keep the full App Router tree request-bound so CSP nonces are resolved during
  // request-time rendering instead of drifting through prerendered shells.
  await connection();
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html
      lang={DOCUMENT_LOCALE}
      dir={DOCUMENT_DIR}
      className="dark"
      style={{ colorScheme: 'dark' }}
      suppressHydrationWarning
    >
      <body
        className={`${geistSans.variable} ${spaceGrotesk.variable} ${fraunces.variable} antialiased`}
        suppressHydrationWarning
      >
        <Script
          id="governada-csp-dynamic-script-nonce"
          nonce={nonce}
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: CSP_DYNAMIC_SCRIPT_NONCE_BOOTSTRAP }}
        />
        <LocaleProvider initialLocale={DOCUMENT_LOCALE}>
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
              <MotionStrengthProvider>
                <GovernadaShell>{children}</GovernadaShell>
              </MotionStrengthProvider>
              <CommandProvider />
              <Toaster />
              <InstallPrompt />
              <OfflineBanner />
            </NavDirectionProvider>
          </Providers>
        </LocaleProvider>
      </body>
    </html>
  );
}

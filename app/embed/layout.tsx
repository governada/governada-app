import '@/app/globals.css';
import { DEFAULT_LOCALE, RTL_LOCALES } from '@/lib/i18n/config';

/**
 * Embed layout - no header, footer, or nav.
 * These pages are designed to be rendered inside iframes.
 */
const DOCUMENT_LOCALE = DEFAULT_LOCALE;
const DOCUMENT_DIR = RTL_LOCALES.has(DOCUMENT_LOCALE) ? 'rtl' : 'ltr';

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={DOCUMENT_LOCALE} dir={DOCUMENT_DIR} className="dark" suppressHydrationWarning>
      <body className="bg-transparent min-h-0">{children}</body>
    </html>
  );
}

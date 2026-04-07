import '@/app/globals.css';
import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE, RTL_LOCALES, resolvePreferredLocale } from '@/lib/i18n/config';

/**
 * Embed layout - no header, footer, or nav.
 * These pages are designed to be rendered inside iframes.
 */
export default async function EmbedLayout({ children }: { children: React.ReactNode }) {
  const headerStore = await headers();
  const cookieStore = await cookies();
  const locale = resolvePreferredLocale({
    cookieLocale: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerStore.get('accept-language'),
  });
  const dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} className="dark" suppressHydrationWarning>
      <body className="bg-transparent min-h-0">{children}</body>
    </html>
  );
}

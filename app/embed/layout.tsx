import '@/app/globals.css';

/**
 * Embed layout — no header, footer, or nav.
 * These pages are designed to be rendered inside iframes.
 */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="bg-transparent min-h-0">
        {children}
      </body>
    </html>
  );
}

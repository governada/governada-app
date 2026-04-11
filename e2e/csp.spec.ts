import { test, expect } from '@playwright/test';

test.describe('CSP route classes', () => {
  const publicRoutes = [
    '/',
    '/?filter=dreps',
    '/engage',
    '/pulse',
    '/learn',
    '/help/methodology',
    '/match',
  ];
  const nonceRoutes = ['/dev/vote-test', '/dev/delegation-test'];

  for (const route of publicRoutes) {
    test(`${route} uses static public CSP`, async ({ page }) => {
      test.setTimeout(90_000);

      const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      expect(response?.status()).toBeLessThan(400);

      const csp = response?.headers()['content-security-policy'] ?? '';
      expect(csp).toContain("script-src 'self'");
      expect(csp).not.toContain("'strict-dynamic'");
      expect(csp).not.toContain("'nonce-");
    });
  }

  for (const route of nonceRoutes) {
    test(`${route} keeps nonce-based CSP`, async ({ page }) => {
      test.setTimeout(90_000);

      const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      expect(response?.status()).toBeLessThan(400);

      const csp = response?.headers()['content-security-policy'] ?? '';
      expect(csp).toContain("'strict-dynamic'");
      expect(csp).toContain("'nonce-");

      const missingNonceScripts = await page.locator('script').evaluateAll((scripts) =>
        scripts
          .filter((script) => {
            const src = script.getAttribute('src') ?? '';

            if (src.includes('browser_dev_hmr-client')) {
              return false;
            }

            if (script.hasAttribute('data-nextjs-dev-overlay')) {
              return false;
            }

            return !script.nonce;
          })
          .map((script) => script.outerHTML.slice(0, 200)),
      );

      expect(missingNonceScripts).toEqual([]);
    });
  }
});

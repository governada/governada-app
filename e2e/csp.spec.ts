import { test, expect } from '@playwright/test';

test.describe('CSP nonce coverage', () => {
  const routes = [
    '/',
    '/?filter=dreps',
    '/engage',
    '/pulse',
    '/learn',
    '/help/methodology',
    '/?mode=match',
  ];

  for (const route of routes) {
    test(`${route} applies the response nonce to every script tag`, async ({ page }) => {
      test.setTimeout(90_000);

      const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      expect(response?.status()).toBeLessThan(400);
      const csp = response?.headers()['content-security-policy'] ?? '';
      const responseNonce = csp.match(/'nonce-([^']+)'/)?.[1];

      expect(responseNonce).toBeTruthy();

      const scriptNonceMismatches = await page.locator('script').evaluateAll(
        (scripts, expectedNonce) =>
          scripts
            .map((script) => ({
              nonce: script.nonce,
              html: script.outerHTML.slice(0, 200),
            }))
            .filter((script) => script.nonce !== expectedNonce),
        responseNonce,
      );

      expect(scriptNonceMismatches).toEqual([]);
    });
  }
});

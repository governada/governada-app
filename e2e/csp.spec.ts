import { test, expect } from '@playwright/test';

test.describe('CSP nonce coverage', () => {
  const routes = [
    '/',
    '/?filter=dreps',
    '/?match=true',
    '/engage',
    '/pulse',
    '/learn',
    '/help/methodology',
    '/match',
  ];

  for (const route of routes) {
    test(`${route} applies a nonce to every script tag`, async ({ page }) => {
      test.setTimeout(90_000);

      const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      expect(response?.status()).toBeLessThan(400);

      const missingNonceScripts = await page
        .locator('script')
        .evaluateAll((scripts) =>
          scripts.filter((script) => !script.nonce).map((script) => script.outerHTML.slice(0, 200)),
        );

      expect(missingNonceScripts).toEqual([]);
    });
  }
});

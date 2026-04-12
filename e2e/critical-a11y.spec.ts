import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Result } from 'axe-core';

const CRITICAL_PAGES = [
  { name: 'Home', path: '/' },
  { name: 'Discovery', path: '/?filter=dreps' },
  { name: 'Match', path: '/?mode=match' },
];

test.describe('Critical public accessibility', () => {
  for (const { name, path } of CRITICAL_PAGES) {
    test(`${name} has no critical or serious accessibility violations`, async ({ page }) => {
      test.setTimeout(60_000);

      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .exclude('a[href="#main-content"]')
        .exclude('.recharts-wrapper')
        .analyze();

      const critical = results.violations.filter(
        (violation: Result) => violation.impact === 'critical',
      );
      const serious = results.violations.filter(
        (violation: Result) => violation.impact === 'serious',
      );

      expect(critical, `Critical violations on ${name}`).toHaveLength(0);
      expect(serious, `Serious violations on ${name}`).toHaveLength(0);
    });
  }
});

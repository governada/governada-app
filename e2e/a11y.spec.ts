import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility smoke tests using axe-core.
 * Checks WCAG 2.1 AA compliance on key pages.
 * Run: npx playwright test --grep a11y
 */

const KEY_PAGES = [
  { name: 'Home', path: '/' },
  { name: 'Discover', path: '/discover' },
  { name: 'Match', path: '/match' },
  { name: 'Engage', path: '/engage' },
  { name: 'My Gov', path: '/my-gov' },
  { name: 'Pulse', path: '/pulse' },
];

test.describe('a11y: WCAG 2.1 AA audit', () => {
  for (const { name, path } of KEY_PAGES) {
    test(`${name} (${path}) has no critical or serious violations`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      // Wait for main content to be present
      await page.waitForSelector('#main-content', { timeout: 15_000 }).catch(() => {});

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .exclude('.recharts-wrapper') // Third-party chart internals
        .analyze();

      const critical = results.violations.filter((v) => v.impact === 'critical');
      const serious = results.violations.filter((v) => v.impact === 'serious');

      if (critical.length > 0 || serious.length > 0) {
        const summary = [...critical, ...serious]
          .map(
            (v) =>
              `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instance${v.nodes.length !== 1 ? 's' : ''})`,
          )
          .join('\n');
        console.log(`\nA11y violations on ${name} (${path}):\n${summary}\n`);
      }

      expect(critical, `Critical violations on ${name}`).toHaveLength(0);
      expect(serious, `Serious violations on ${name}`).toHaveLength(0);
    });
  }

  test('DRep profile page has no critical or serious violations', async ({ page }) => {
    test.setTimeout(60_000);
    // Navigate to discover and find a DRep link
    await page.goto('/discover', { waitUntil: 'domcontentloaded' });
    const drepLink = page.locator('a[href^="/drep/"]').first();
    const hasLink = await drepLink.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!hasLink) {
      test.skip(true, 'No DRep links found on discover page');
      return;
    }

    const href = await drepLink.getAttribute('href');
    await page.goto(href!, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#main-content', { timeout: 15_000 }).catch(() => {});

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('.recharts-wrapper')
      .analyze();

    const critical = results.violations.filter((v) => v.impact === 'critical');
    const serious = results.violations.filter((v) => v.impact === 'serious');

    expect(critical, 'Critical violations on DRep profile').toHaveLength(0);
    expect(serious, 'Serious violations on DRep profile').toHaveLength(0);
  });

  test('Proposal detail page has no critical or serious violations', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/discover?tab=proposals', { waitUntil: 'domcontentloaded' });
    const proposalLink = page.locator('a[href^="/proposal/"]').first();
    const hasLink = await proposalLink.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!hasLink) {
      test.skip(true, 'No proposal links found on discover page');
      return;
    }

    const href = await proposalLink.getAttribute('href');
    await page.goto(href!, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#main-content', { timeout: 15_000 }).catch(() => {});

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('.recharts-wrapper')
      .analyze();

    const critical = results.violations.filter((v) => v.impact === 'critical');
    const serious = results.violations.filter((v) => v.impact === 'serious');

    expect(critical, 'Critical violations on Proposal page').toHaveLength(0);
    expect(serious, 'Serious violations on Proposal page').toHaveLength(0);
  });
});

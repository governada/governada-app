import { test, expect } from '@playwright/test';

test.describe('Legacy route compatibility', () => {
  test('legacy routes resolve to current destinations', async ({ page }) => {
    const routes = [
      { from: '/discover', to: /filter=dreps/ },
      { from: '/match', to: /\/match$/ },
      { from: '/methodology', to: /\/help\/methodology$/ },
    ];

    for (const { from, to } of routes) {
      await page.goto(from, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(to, { timeout: 30_000 });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
    }
  });
});

test.describe('Page loading', () => {
  const pages = ['/', '/?filter=dreps', '/match', '/pulse', '/learn', '/help/methodology'];

  for (const path of pages) {
    test(`${path} loads without redirect`, async ({ page }) => {
      test.setTimeout(90_000);
      const response = await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      expect(response?.status()).toBeLessThan(400);
      expect(page.url()).toContain(path === '/' ? '/' : path);
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
    });
  }

  test('Pulse page renders overview content', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/pulse', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('button:has-text("Overview")')).toBeVisible({ timeout: 15_000 });
  });

  test('Discover page renders DRep tab content', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/?filter=dreps', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page).toHaveURL(/filter=dreps/);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Console error guard', () => {
  test('no render loops on any page', async ({ page }) => {
    test.setTimeout(120_000);

    const renderLoopErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('Maximum update depth')) {
        renderLoopErrors.push(page.url());
      }
    });

    const routes = ['/', '/?filter=dreps', '/match', '/pulse', '/learn', '/help/methodology'];
    for (const route of routes) {
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForTimeout(3000);
    }

    expect(renderLoopErrors).toHaveLength(0);
  });
});

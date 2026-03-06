import { test, expect } from '@playwright/test';

test.describe('Header navigation', () => {
  test('sequential header link clicks all navigate correctly', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Header nav hidden on mobile');
    test.setTimeout(120_000);

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const routes = [
      { href: '/discover', label: 'Discover' },
      { href: '/pulse', label: 'Pulse' },
      { href: '/', label: 'Home' },
      { href: '/learn', label: 'Learn' },
    ];

    for (const { href } of routes) {
      const link = page.locator(`header nav a[href="${href}"]`);
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(href === '/' ? /^\/$|localhost:\d+\/$/ : new RegExp(href), {
        timeout: 30_000,
      });
      // Wait for main content to appear before next click
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
    }
  });

  test('header nav works after visiting Discover (regression: render loop)', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Header nav hidden on mobile');
    test.setTimeout(120_000);

    // Guards against the useChartDimensions render loop that previously broke
    // navigation after visiting /discover
    await page.goto('/discover', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const pulseLink = page.locator('header nav a[href="/pulse"]');
    await expect(pulseLink).toBeVisible();
    await pulseLink.click();
    await expect(page).toHaveURL(/\/pulse/, { timeout: 30_000 });

    const discoverLink = page.locator('header nav a[href="/discover"]');
    await discoverLink.click();
    await expect(page).toHaveURL(/\/discover/, { timeout: 30_000 });
  });
});

test.describe('Page loading', () => {
  const pages = ['/', '/discover', '/pulse', '/learn', '/methodology'];

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
    await page.goto('/discover', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('button:has-text("DReps"), [class*="grid"]').first()).toBeVisible({
      timeout: 15_000,
    });
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

    const routes = ['/', '/discover', '/pulse', '/learn', '/methodology'];
    for (const route of routes) {
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForTimeout(3000);
    }

    expect(renderLoopErrors).toHaveLength(0);
  });
});

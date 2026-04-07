import { test, expect } from '@playwright/test';

test.describe('Smoke tests', () => {
  test('homepage loads and shows heading', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/Governada/i);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
  });

  test('discovery state loads from the home route', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/?filter=dreps', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/filter=dreps/);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
  });

  test('health API responds', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('status');
  });
});

test.describe('Navigation', () => {
  test('anonymous shell renders the header', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header')).toBeVisible({ timeout: 15000 });
  });

  test('mobile bottom nav is visible on small screens', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only test');
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('nav[aria-label="Mobile navigation"]')).toBeVisible({
      timeout: 15000,
    });
  });
});

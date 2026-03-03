import { test, expect } from '@playwright/test';

test.describe('Smoke tests', () => {
  test('homepage loads and shows heading', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/DRepScore/i);
    await expect(page.locator('main')).toBeVisible();
  });

  test('discover page loads DRep list', async ({ page }) => {
    await page.goto('/discover');
    await expect(page.locator('main')).toBeVisible();
    await page.waitForLoadState('networkidle');
  });

  test('health API returns ok', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});

test.describe('Navigation', () => {
  test('header links are accessible', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('header nav, header');
    await expect(nav).toBeVisible();
  });

  test('mobile bottom nav is visible on small screens', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only test');
    await page.goto('/');
    await expect(page.locator('[data-testid="mobile-bottom-nav"], nav').first()).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

test.describe('Smoke tests', () => {
  test('homepage loads and shows heading', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Civica/i);
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('discover page loads DRep list', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/discover', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('health API responds', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('status');
  });
});

test.describe('Navigation', () => {
  test('header links are accessible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header nav[aria-label="Main navigation"]')).toBeVisible();
  });

  test('mobile bottom nav is visible on small screens', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only test');
    await page.goto('/');
    await expect(page.locator('nav[aria-label="Mobile navigation"]')).toBeVisible();
  });
});

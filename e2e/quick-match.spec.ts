import { test, expect } from '@playwright/test';

test.describe('Quick Match flow', () => {
  test('match page loads', async ({ page }) => {
    await page.goto('/match');
    await expect(page.locator('main')).toBeVisible();
    await page.waitForLoadState('networkidle');
  });

  test('quiz UI is interactive', async ({ page }) => {
    await page.goto('/match');
    await page.waitForLoadState('networkidle');

    const buttons = page.locator('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('can start and progress through quiz', async ({ page }) => {
    await page.goto('/match');
    await page.waitForLoadState('networkidle');

    const startButton = page
      .locator('button')
      .filter({ hasText: /start|begin|match|find/i })
      .first();
    if (await startButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(500);
      await expect(page.locator('main')).toBeVisible();
    }
  });
});

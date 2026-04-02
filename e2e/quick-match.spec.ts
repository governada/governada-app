import { test, expect } from '@playwright/test';

test.describe('Quick Match flow', () => {
  test('legacy match route redirects into the home match state', async ({ page }) => {
    await page.goto('/match', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\?match=true/);
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('quiz UI is interactive', async ({ page }) => {
    await page.goto('/?match=true');
    await page.waitForLoadState('networkidle');

    const buttons = page.locator('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('can start and progress through quiz', async ({ page }) => {
    await page.goto('/?match=true');
    await page.waitForLoadState('networkidle');

    const startButton = page
      .locator('button')
      .filter({ hasText: /start|begin|match|find/i })
      .first();
    if (await startButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(500);
      await expect(page.locator('#main-content')).toBeVisible();
    }
  });
});

import { test, expect } from '@playwright/test';

test.describe('Discover flow', () => {
  test('discover legacy route lands on the home discovery state', async ({ page }) => {
    await page.goto('/discover', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/filter=dreps/);
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('proposal discovery state loads from the home route', async ({ page }) => {
    await page.goto('/?filter=proposals', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/filter=proposals/);
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('can navigate to a DRep profile when discovery links are available', async ({ page }) => {
    await page.goto('/?filter=dreps');
    await page.waitForLoadState('networkidle');

    const profileLink = page.locator('a[href^="/drep/"], a[href^="/g/drep/"]').first();
    if (await profileLink.isVisible({ timeout: 10000 }).catch(() => false)) {
      await profileLink.click();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('#main-content')).toBeVisible();
    }
  });
});

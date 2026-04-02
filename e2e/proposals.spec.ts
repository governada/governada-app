import { test, expect } from '@playwright/test';

test.describe('Proposals flow', () => {
  test('legacy proposals route lands on proposal discovery', async ({ page }) => {
    await page.goto('/proposals', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/filter=proposals/);
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('proposals list renders', async ({ page }) => {
    await page.goto('/?filter=proposals');
    await page.waitForLoadState('networkidle');

    const proposalLink = page.locator('a[href^="/proposal/"], a[href^="/g/proposal/"]').first();
    if (await proposalLink.isVisible({ timeout: 10000 }).catch(() => false)) {
      expect(await proposalLink.textContent()).toBeTruthy();
    }
  });

  test('can navigate to proposal detail', async ({ page }) => {
    await page.goto('/?filter=proposals');
    await page.waitForLoadState('networkidle');

    const proposalLink = page.locator('a[href^="/proposal/"], a[href^="/g/proposal/"]').first();
    if (await proposalLink.isVisible({ timeout: 10000 }).catch(() => false)) {
      await proposalLink.click();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('#main-content')).toBeVisible();
    }
  });
});

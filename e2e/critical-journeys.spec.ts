import { test, expect } from '@playwright/test';

test.describe('Critical journey contracts', () => {
  test('anonymous workspace entry preserves return intent', async ({ page }) => {
    await page.goto('/workspace', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/\?connect=1&returnTo=%2Fworkspace$/);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
  });

  test('anonymous identity entry preserves return intent', async ({ page }) => {
    await page.goto('/you', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/\?connect=1&returnTo=%2Fyou$/);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
  });

  test('homepage owns the canonical quick match flow', async ({ page }) => {
    await page.goto('/match', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/[?&]mode=match/, { timeout: 30000 });
    await expect(page.getByTestId('homepage-match-workspace')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('match-start-button')).toBeVisible({ timeout: 15000 });
  });

  test('proposal discovery can still reach a proposal detail route', async ({ page }) => {
    await page.goto('/?filter=proposals', { waitUntil: 'domcontentloaded' });

    const proposalLink = page.locator('a[href^="/proposal/"], a[href^="/g/proposal/"]').first();
    const hasLink = await proposalLink.isVisible({ timeout: 10000 }).catch(() => false);

    test.skip(!hasLink, 'No proposal links found on the discovery route');

    await proposalLink.click();
    await expect(page).toHaveURL(/\/(proposal|g\/proposal)\//);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
  });
});

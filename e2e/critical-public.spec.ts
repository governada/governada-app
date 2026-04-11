import { test, expect } from '@playwright/test';

test.describe('Critical public journeys', () => {
  test('homepage shell renders for anonymous visitors', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/Governada/i);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
  });

  test('legacy discover route redirects into DRep discovery', async ({ page }) => {
    await page.goto('/discover', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/filter=dreps/, { timeout: 30_000 });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
  });

  test('DRep discovery can open a profile', async ({ page }) => {
    await page.goto('/?filter=dreps', { waitUntil: 'domcontentloaded' });

    const drepLink = page.locator('a[href^="/drep/"]').first();
    const hasLink = await drepLink.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!hasLink, 'No DRep links found on the discovery route');

    await drepLink.click();
    await expect(page).toHaveURL(/\/drep\//, { timeout: 30_000 });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
  });

  test('proposal discovery can open proposal detail', async ({ page }) => {
    await page.goto('/?filter=proposals', { waitUntil: 'domcontentloaded' });

    const proposalLink = page.locator('a[href^="/proposal/"], a[href^="/g/proposal/"]').first();
    const hasLink = await proposalLink.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!hasLink, 'No proposal links found on the discovery route');

    await proposalLink.click();
    await expect(page).toHaveURL(/\/(proposal|g\/proposal)\//, { timeout: 30_000 });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
  });

  test('health endpoint reports operational status', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('status');
    expect(body.status).not.toBe('error');
  });
});

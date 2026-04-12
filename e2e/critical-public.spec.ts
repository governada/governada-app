import { test, expect, type Page } from '@playwright/test';

async function completeHomepageQuickMatch(page: Page) {
  await page.getByTestId('match-start-button').click();
  await expect(page.getByTestId('match-question-treasury')).toBeVisible({ timeout: 15_000 });

  await page.getByTestId('match-answer-treasury-balanced').click();
  await expect(page.getByTestId('match-question-protocol')).toBeVisible({ timeout: 15_000 });

  await page.getByTestId('match-answer-protocol-case_by_case').click();
  await expect(page.getByTestId('match-question-transparency')).toBeVisible({
    timeout: 15_000,
  });

  await page.getByTestId('match-answer-transparency-essential').click();
  await expect(page.getByTestId('match-question-decentralization')).toBeVisible({
    timeout: 15_000,
  });

  await page.getByTestId('match-answer-decentralization-spread_widely').click();
}

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

  test('homepage match workspace can reach a live result state', async ({ page }) => {
    await page.goto('/?mode=match', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('homepage-match-workspace')).toBeVisible({ timeout: 15_000 });

    await completeHomepageQuickMatch(page);
    await expect(page.getByTestId('match-results')).toBeVisible({ timeout: 30_000 });
    await Promise.any([
      page.getByTestId('match-top-result').waitFor({ state: 'visible', timeout: 30_000 }),
      page.getByTestId('match-empty-state').waitFor({ state: 'visible', timeout: 30_000 }),
    ]);
  });

  test('health endpoint reports operational status', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('status');
    expect(body.status).not.toBe('error');
  });
});

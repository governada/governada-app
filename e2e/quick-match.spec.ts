import { test, expect } from '@playwright/test';

test.describe('Quick Match flow', () => {
  test('deprecated /match alias redirects into the homepage match workspace', async ({ page }) => {
    await page.goto('/match', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/[?&]mode=match/, { timeout: 30_000 });
    await expect(page.getByTestId('homepage-match-workspace')).toBeVisible();
  });

  test('legacy query-string entry redirects into the canonical homepage workspace', async ({
    page,
  }) => {
    await page.goto('/?match=true', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/[?&]mode=match/, { timeout: 30_000 });
    await expect(page.getByTestId('homepage-match-workspace')).toBeVisible();
  });

  test('can start and progress through the homepage quiz flow', async ({ page }) => {
    await page.goto('/?mode=match');
    await expect(page.getByTestId('homepage-match-workspace')).toBeVisible();
    await expect(page.getByTestId('match-start-button')).toBeVisible();

    await page.getByTestId('match-start-button').click();
    await expect(page.getByTestId('match-question-treasury')).toBeVisible();

    await page.getByTestId('match-answer-treasury-balanced').click();
    await expect(page.getByTestId('match-question-protocol')).toBeVisible();
  });
});

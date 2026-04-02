import { test, expect } from '@playwright/test';

/**
 * Visual regression tests for key Governada pages.
 *
 * Usage:
 *   npx playwright test e2e/visual-regression.spec.ts
 *   npx playwright test e2e/visual-regression.spec.ts --update-snapshots  # to update baselines
 *
 * Snapshots are stored in e2e/__snapshots__/ and should be committed to git.
 * Run against production (PLAYWRIGHT_BASE_URL=https://governada.io) for stable baselines.
 */

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? '';
const isProduction = baseURL.includes('governada.io');

test.describe('Visual Regression - Key Pages', () => {
  test.skip(!isProduction, 'Visual regression runs against production only');

  test('homepage renders correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: false,
      mask: [
        // Mask dynamic content that changes between epochs
        page.locator('[data-testid="epoch-number"]'),
        page.locator('[data-testid="live-stats"]'),
      ],
    });
  });

  test('discover page renders correctly', async ({ page }) => {
    await page.goto('/?filter=dreps');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('discover.png', {
      fullPage: false,
    });
  });

  test('match page renders correctly', async ({ page }) => {
    await page.goto('/?match=true');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('match.png', {
      fullPage: false,
    });
  });

  test('pulse page renders correctly', async ({ page }) => {
    await page.goto('/pulse');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('pulse.png', {
      fullPage: false,
      mask: [
        // Mask epoch-specific data
        page.locator('[data-testid="ghi-value"]'),
        page.locator('[data-testid="treasury-balance"]'),
      ],
    });
  });

  test('engage page renders correctly', async ({ page }) => {
    await page.goto('/engage');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('engage.png', {
      fullPage: false,
    });
  });
});

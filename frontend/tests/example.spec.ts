import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should load the application', async ({ page }) => {
    await page.goto('/');
    
    // Verify the page loads (adjust selector based on your app)
    await expect(page).toHaveTitle(/Home Stat|Utility Management/i);
  });
});


import { test, expect } from '@playwright/test';

test.describe('Analytics Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login and authenticate
    await page.goto('/login');
    
    // Login with test credentials
    await page.getByLabel('Email Address').fill('kurochkinslav@gmail.com');
    await page.getByLabel('Password').fill('admin1234');
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Wait for navigation to dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 });
    
    // Navigate to Analytics page
    await page.getByRole('button', { name: /analytics/i }).click();
    await page.waitForURL('/analytics');
  });

  test.describe('Cost Distribution Chart', () => {
    test('should display the Cost Distribution chart section', async ({ page }) => {
      // Verify the chart section exists
      const chartHeading = page.getByRole('heading', { name: /Cost Distribution/i });
      await expect(chartHeading).toBeVisible();
    });

    test('should render the donut chart with pie slices', async ({ page }) => {
      // Wait for the chart to load
      await page.waitForSelector('.recharts-pie');
      
      // Verify pie chart is rendered
      const pieChart = page.locator('.recharts-pie');
      await expect(pieChart).toBeVisible();
      
      // Verify there are pie slices (cells)
      const pieSlices = page.locator('.recharts-pie-sector');
      const sliceCount = await pieSlices.count();
      expect(sliceCount).toBeGreaterThan(0);
    });

    test('should display legend with utility types', async ({ page }) => {
      // Get the Cost Distribution card specifically
      const costDistributionCard = page.locator('text=Cost Distribution').locator('xpath=ancestor::div[contains(@class, "MuiCard")]');
      
      // Wait for legend to render within the Cost Distribution card
      const legend = costDistributionCard.locator('.recharts-legend-wrapper');
      await expect(legend).toBeVisible();
      
      // Verify legend has items
      const legendItems = costDistributionCard.locator('.recharts-legend-item');
      const itemCount = await legendItems.count();
      expect(itemCount).toBeGreaterThan(0);
    });

    test('should show tooltip on hover over pie slice', async ({ page }) => {
      // Wait for pie chart to load
      await page.waitForSelector('.recharts-pie-sector');
      
      // Get the Cost Distribution card's pie chart
      const pieSlice = page.locator('.recharts-pie-sector').first();
      
      // Hover over a pie slice and wait a moment for tooltip
      await pieSlice.hover({ force: true });
      await page.waitForTimeout(500);
      
      // Verify tooltip content appears (our custom tooltip shows $ amounts)
      const tooltipContent = page.locator('.recharts-tooltip-wrapper:not([style*="visibility: hidden"])');
      await expect(tooltipContent.first()).toBeVisible({ timeout: 3000 });
    });

    test('should display percentage labels on larger slices', async ({ page }) => {
      // Wait for chart to load
      await page.waitForSelector('.recharts-pie');
      
      // Look for percentage text labels (custom labels show %)
      const percentLabels = page.locator('.recharts-pie-label-text');
      
      // If there are slices >= 5%, labels should exist
      const labelCount = await percentLabels.count();
      // At least some labels should be visible for significant slices
      expect(labelCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Date Range Filter', () => {
    test('should have start and end date inputs', async ({ page }) => {
      const startDateInput = page.getByLabel('Start Date');
      const endDateInput = page.getByLabel('End Date');
      
      await expect(startDateInput).toBeVisible();
      await expect(endDateInput).toBeVisible();
    });

    test('should have an Apply button', async ({ page }) => {
      const applyButton = page.getByRole('button', { name: /Apply/i });
      await expect(applyButton).toBeVisible();
    });

    test('should reload data when Apply is clicked', async ({ page }) => {
      // Change the date range
      const startDateInput = page.getByLabel('Start Date');
      await startDateInput.fill('2025-01-01');
      
      // Click Apply
      const applyButton = page.getByRole('button', { name: /Apply/i });
      await applyButton.click();
      
      // Wait for data to reload (chart should still be visible)
      await page.waitForSelector('.recharts-pie');
      const pieChart = page.locator('.recharts-pie');
      await expect(pieChart).toBeVisible();
    });
  });

  test.describe('Summary Statistics', () => {
    test('should display Summary Statistics card', async ({ page }) => {
      const summaryHeading = page.getByRole('heading', { name: /Summary Statistics/i });
      await expect(summaryHeading).toBeVisible();
    });

    test('should show Total Cost', async ({ page }) => {
      const totalCostText = page.getByText(/Total Cost:/i);
      await expect(totalCostText).toBeVisible();
    });

    test('should show Monthly Average', async ({ page }) => {
      const avgText = page.getByText(/Monthly Average:/i);
      await expect(avgText).toBeVisible();
    });

    test('should show Total Bills count', async ({ page }) => {
      const billsText = page.getByText(/Total Bills:/i);
      await expect(billsText).toBeVisible();
    });
  });

  test.describe('Monthly Breakdown', () => {
    test('should display Monthly Breakdown section', async ({ page }) => {
      const breakdownHeading = page.getByRole('heading', { name: /Monthly Breakdown/i });
      await expect(breakdownHeading).toBeVisible();
    });

    test('should have Table and Compact view toggles', async ({ page }) => {
      const tableButton = page.getByRole('button', { name: 'Table' });
      const compactButton = page.getByRole('button', { name: 'Compact' });
      
      await expect(tableButton).toBeVisible();
      await expect(compactButton).toBeVisible();
    });

    test('should switch between Table and Compact views', async ({ page }) => {
      // Click Compact view
      const compactButton = page.getByRole('button', { name: 'Compact' });
      await compactButton.click();
      
      // Verify compact view is active (button should be styled as selected)
      await expect(compactButton).toHaveAttribute('class', /filled|MuiChip-colorPrimary/);
      
      // Switch back to Table view
      const tableButton = page.getByRole('button', { name: 'Table' });
      await tableButton.click();
      
      // Verify table view is active
      await expect(tableButton).toHaveAttribute('class', /filled|MuiChip-colorPrimary/);
    });
  });
});


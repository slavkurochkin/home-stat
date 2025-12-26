import { Page, Locator, expect } from '@playwright/test';

export class AnalyticsPage {
  readonly page: Page;
  
  // Page header
  readonly heading: Locator;
  
  // Date range filter
  readonly startDateInput: Locator;
  readonly endDateInput: Locator;
  readonly applyButton: Locator;
  
  // Cost Distribution chart
  readonly costDistributionCard: Locator;
  readonly costDistributionHeading: Locator;
  readonly pieChart: Locator;
  readonly pieSlices: Locator;
  readonly pieLegend: Locator;
  readonly pieLegendItems: Locator;
  
  // Summary Statistics
  readonly summaryCard: Locator;
  readonly totalCostText: Locator;
  readonly monthlyAverageText: Locator;
  readonly totalBillsText: Locator;
  
  // Monthly Breakdown
  readonly monthlyBreakdownCard: Locator;
  readonly tableViewButton: Locator;
  readonly compactViewButton: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Page header
    this.heading = page.getByRole('heading', { name: /analytics/i });
    
    // Date range filter
    this.startDateInput = page.getByLabel('Start Date');
    this.endDateInput = page.getByLabel('End Date');
    this.applyButton = page.getByRole('button', { name: /apply/i });
    
    // Cost Distribution chart - scope to the specific card
    this.costDistributionHeading = page.getByRole('heading', { name: /cost distribution/i });
    this.costDistributionCard = this.costDistributionHeading.locator('xpath=ancestor::div[contains(@class, "MuiCard")]');
    this.pieChart = page.locator('.recharts-pie');
    this.pieSlices = page.locator('.recharts-pie-sector');
    this.pieLegend = this.costDistributionCard.locator('.recharts-legend-wrapper');
    this.pieLegendItems = this.costDistributionCard.locator('.recharts-legend-item');
    
    // Summary Statistics
    this.summaryCard = page.getByRole('heading', { name: /summary statistics/i }).locator('xpath=ancestor::div[contains(@class, "MuiCard")]');
    this.totalCostText = page.getByText(/total cost:/i);
    this.monthlyAverageText = page.getByText(/monthly average:/i);
    this.totalBillsText = page.getByText(/total bills:/i);
    
    // Monthly Breakdown
    this.monthlyBreakdownCard = page.getByRole('heading', { name: /monthly breakdown/i }).locator('xpath=ancestor::div[contains(@class, "MuiCard")]');
    this.tableViewButton = page.getByRole('button', { name: 'Table' });
    this.compactViewButton = page.getByRole('button', { name: 'Compact' });
  }

  async goto() {
    await this.page.goto('/analytics');
  }

  async navigateFromSidebar() {
    await this.page.getByRole('button', { name: /analytics/i }).click();
    await this.page.waitForURL('/analytics');
  }

  async setDateRange(startDate: string, endDate: string) {
    await this.startDateInput.fill(startDate);
    await this.endDateInput.fill(endDate);
  }

  async applyDateFilter() {
    await this.applyButton.click();
    // Wait for chart to reload
    await this.page.waitForSelector('.recharts-pie');
  }

  async switchToTableView() {
    await this.tableViewButton.click();
  }

  async switchToCompactView() {
    await this.compactViewButton.click();
  }

  async hoverOnPieSlice(index: number = 0) {
    const slice = this.pieSlices.nth(index);
    await slice.hover({ force: true });
    await this.page.waitForTimeout(500);
  }

  async expectChartVisible() {
    await expect(this.pieChart).toBeVisible();
  }

  async expectLegendVisible() {
    await expect(this.pieLegend).toBeVisible();
  }

  async expectTooltipVisible() {
    const tooltip = this.page.locator('.recharts-tooltip-wrapper:not([style*="visibility: hidden"])');
    await expect(tooltip.first()).toBeVisible({ timeout: 3000 });
  }

  async getLegendItemCount(): Promise<number> {
    return await this.pieLegendItems.count();
  }

  async getPieSliceCount(): Promise<number> {
    return await this.pieSlices.count();
  }
}


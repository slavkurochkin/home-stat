import { Page, Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;
  readonly errorAlert: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel('Email Address');
    this.passwordInput = page.getByLabel('Password');
    this.signInButton = page.getByRole('button', { name: /sign in/i });
    this.errorAlert = page.getByRole('alert');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }

  async loginAsTestUser() {
    await this.login('kurochkinslav@gmail.com', 'admin1234');
    await this.page.waitForURL('/dashboard', { timeout: 10000 });
  }

  async expectError(message?: string) {
    await expect(this.errorAlert).toBeVisible();
    if (message) {
      await expect(this.errorAlert).toContainText(message);
    }
  }
}


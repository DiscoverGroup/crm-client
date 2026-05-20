import { test, expect } from '@playwright/test';

test.describe('CRM smoke checks', () => {
  test('login screen renders', async ({ page }) => {
    await page.goto('/');

    const loginHeading = page.getByRole('heading', { name: 'Welcome Back', exact: true });
    await expect(loginHeading).toBeVisible();
    await expect(page.locator('input[autocomplete="email"]').first()).toBeVisible();
    await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with auth0/i }).first()).toBeVisible();
  });

  test('can switch to sign-up view', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Sign Up' }).first().click();
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
    await expect(page.getByPlaceholder('Full Name')).toBeVisible();
    await expect(page.getByPlaceholder('Username')).toBeVisible();
    await expect(page.locator('button[type="submit"]', { hasText: 'Sign Up' })).toBeVisible();
  });
});

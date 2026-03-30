import { test, expect } from '@playwright/test';

test('homepage has correct title and visible elements', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/hunter\.ai/i);

  // Expect the main hero heading to be visible
  const heroHeading = page.locator('h1').first();
  await expect(heroHeading).toBeVisible();
});

test('login navigation works', async ({ page }) => {
  await page.goto('/');

  // Click the sign-in button
  await page.getByRole('link', { name: /sign in/i }).click();

  // Expect the URL to contain login
  await expect(page).toHaveURL(/.*\/login/);

  // Check that the login form heading exists
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
});

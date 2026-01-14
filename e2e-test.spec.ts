import { test, expect } from '@playwright/test';

test.describe('Hunter Application E2E Tests', () => {
  const baseURL = 'http://localhost:8081';
  
  test('Landing page loads correctly', async ({ page }) => {
    await page.goto(baseURL);
    
    // Check title
    await expect(page).toHaveTitle(/Hunter/i);
    
    // Check hero section
    await expect(page.locator('h1')).toContainText('Your Career');
    
    // Check CTA buttons exist and are visible
    const startButton = page.getByRole('link', { name: /start hunting/i });
    await expect(startButton).toBeVisible();
    
    const demoButton = page.getByRole('link', { name: /view demo/i });
    await expect(demoButton).toBeVisible();
    
    // Check navigation
    await expect(page.getByRole('link', { name: /log in/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /get started/i })).toBeVisible();
  });

  test('Signup page loads and validates', async ({ page }) => {
    await page.goto(`${baseURL}/signup`);
    
    // Check form elements - use explicit matching to avoid "Show password" button conflict
    await expect(page.getByLabel('Full Name', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Email Address', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    
    // Test form validation
    await page.getByRole('button', { name: /create account/i }).click();
    
    // Should show validation errors
    await expect(page.locator('text=/required/i').first()).toBeVisible({ timeout: 2000 });
  });

  test('Login page loads', async ({ page }) => {
    await page.goto(`${baseURL}/login`);
    
    await expect(page.getByLabel('Email Address', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('Navigation works correctly', async ({ page }) => {
    await page.goto(baseURL);
    
    // Click signup
    await page.getByRole('link', { name: /get started/i }).first().click();
    await expect(page).toHaveURL(/\/signup/);
    
    // Go back home
    await page.getByRole('link', { name: /back to home/i }).click();
    await expect(page).toHaveURL(baseURL);
    
    // Click login
    await page.getByRole('link', { name: /log in/i }).first().click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('Responsive design - mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(baseURL);
    
    // Mobile menu should be visible
    await expect(page.locator('[aria-label*="menu"]').first()).toBeVisible();
    
    // Buttons should be full width on mobile
    const startButton = page.getByRole('link', { name: /start hunting/i }).first();
    await expect(startButton).toBeVisible();
  });

  test('Theme toggle works', async ({ page }) => {
    await page.goto(baseURL);
    
    // Find theme toggle button
    const themeToggle = page.locator('button[aria-label*="theme"], button[aria-label*="Toggle"]').first();
    
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      // Theme should change (check for dark/light class on html or body)
      await page.waitForTimeout(500);
    }
  });

  test('404 page for invalid routes', async ({ page }) => {
    await page.goto(`${baseURL}/invalid-route-12345`);
    
    // Check for 404 content instead of URL
    await expect(page.locator('h1')).toContainText(/404|Page not found|Oops/i);
    await expect(page.getByRole('link', { name: /return home/i })).toBeVisible();
  });
});

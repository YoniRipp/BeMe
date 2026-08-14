import { test, expect } from '@playwright/test';

/**
 * The signed-out surface: what the login and signup forms render, and what they refuse.
 *
 * These run without a backend — nothing here submits successfully. Validation is asserted
 * through the browser's own constraint API rather than by watching for an error toast,
 * so the tests stay honest about what they are actually exercising.
 */

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renders the form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'TrackVibe' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();
  });

  test('marks the email field required', async ({ page }) => {
    await page.getByRole('button', { name: /^sign in$/i }).click();

    const valid = await page.getByLabel('Email').evaluate(
      (el: HTMLInputElement) => el.checkValidity()
    );
    expect(valid).toBe(false);
    await expect(page).toHaveURL(/\/login/);
  });

  test('asks for a well-formed email', async ({ page }) => {
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByLabel('Password').fill('somepassword');

    const valid = await page.getByLabel('Email').evaluate(
      (el: HTMLInputElement) => el.checkValidity()
    );
    expect(valid).toBe(false);
  });

  test('offers the social sign-in section', async ({ page }) => {
    await expect(page.getByText(/or continue with/i)).toBeVisible();
  });
});

test.describe('Signup page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/signup');
  });

  test('renders the form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: /create account|sign up/i })).toBeVisible();
  });

  test('will not submit an empty form', async ({ page }) => {
    await page.getByRole('button', { name: /create account|sign up/i }).click();

    await expect(page).toHaveURL(/\/signup/);
  });
});

test.describe('Forgot password page', () => {
  test('renders the reset form', async ({ page }) => {
    await page.goto('/forgot-password');

    await expect(page.getByRole('heading', { name: /reset your password/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });
});

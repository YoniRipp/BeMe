import { test, expect } from '@playwright/test';

/**
 * Public routing and the unauthenticated redirect.
 *
 * The route table is the source of truth here — `src/routes.tsx`. Note that `/welcome`
 * (the marketing Landing page) is deliberately commented out there: commit 8a83a26,
 * "Make /login the default landing route instead of /welcome". Unauthenticated users go
 * to /login, and the Landing component is currently unreachable. If that decision is ever
 * reversed, the `/welcome` case below is the one to re-enable.
 */

const PUBLIC_ROUTES = [
  { path: '/login', name: 'TrackVibe' },
  { path: '/signup', name: 'Create account' },
  { path: '/pricing', name: 'Simple pricing' },
  { path: '/about', name: /about trackvibe/i },
  { path: '/privacy', name: /privacy policy/i },
  { path: '/terms', name: /terms of service/i },
  { path: '/contact', name: /get in touch/i },
] as const;

test.describe('Navigation - public routes', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`serves ${route.path} without authentication`, async ({ page }) => {
      await page.goto(route.path);

      await expect(page).toHaveURL(new RegExp(route.path.replace('/', '\\/')));
      await expect(
        page.getByRole('heading', { name: route.name }).first()
      ).toBeVisible();
    });
  }

  test('serves /forgot-password without authentication', async ({ page }) => {
    await page.goto('/forgot-password');

    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.getByRole('heading', { name: /reset your password/i })).toBeVisible();
  });
});

/** Every app route sits behind the auth guard, which sends signed-out users to /login. */
const PROTECTED_ROUTES = ['/', '/body', '/energy', '/water', '/goals', '/insights', '/settings'];

test.describe('Navigation - protected routes redirect when signed out', () => {
  for (const path of PROTECTED_ROUTES) {
    test(`redirects ${path} to /login`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();
    });
  }
});

test.describe('Navigation - links between public pages', () => {
  test('reaches signup from login', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('link', { name: /sign up/i }).click();

    await expect(page).toHaveURL(/\/signup/);
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
  });

  test('reaches login from signup', async ({ page }) => {
    await page.goto('/signup');

    await page.getByRole('link', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/login/);
  });

  test('reaches forgot-password from login', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('link', { name: /forgot your password/i }).click();

    await expect(page).toHaveURL(/\/forgot-password/);
  });
});

test.describe('Navigation - pricing', () => {
  test('shows both tiers', async ({ page }) => {
    await page.goto('/pricing');

    await expect(page.getByRole('heading', { name: /simple pricing/i })).toBeVisible();
    await expect(page.getByText(/free/i).first()).toBeVisible();
    await expect(page.getByText(/pro/i).first()).toBeVisible();
  });
});

test.describe('Navigation - unknown routes', () => {
  test('sends an unknown path to /login when signed out', async ({ page }) => {
    // Unknown paths fall through to the protected route tree, so the auth guard
    // answers first — a signed-out visitor never reaches the 404 page.
    await page.goto('/this-route-does-not-exist');

    await expect(page).toHaveURL(/\/login/);
  });
});

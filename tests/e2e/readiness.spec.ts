import { test, expect } from '@playwright/test';

test('health endpoint reports honest readiness state', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.ok).toBe(true);
  expect(body.databaseReachable).toBe(true);
  expect(typeof body.readyForPilot).toBe('boolean');
  expect(Array.isArray(body.pilotBlockers)).toBe(true);
});

test('landing page loads without a server error', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/relay/i);
});

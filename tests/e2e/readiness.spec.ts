import { test, expect } from '@playwright/test';

test('health endpoint reports honest readiness state', async ({ request }) => {
  const response = await request.get('/api/health');
  expect([200, 503]).toContain(response.status());
  const body = await response.json();
  expect(body.ok).toBe(body.databaseReachable);
  if (!body.databaseReachable) expect(body.readyForPilot).toBe(false);
  expect(typeof body.readyForPilot).toBe('boolean');
  expect(Array.isArray(body.pilotBlockers)).toBe(true);
});

test('landing page loads without a server error', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/relay/i);
});

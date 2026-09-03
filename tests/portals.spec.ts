import { expect, test } from '@playwright/test';

for (const [path, portalName] of [
  ['/investor', 'Investor'],
  ['/pm', 'Project Manager'],
  ['/client', 'Client'],
] as const) {
  test(`${portalName} portal asks an anonymous visitor to authenticate for that role`, async ({ page }) => {
    await page.goto(path);
    const dialog = page.getByRole('dialog', { name: `${portalName} sign in` });
    await expect(dialog).toBeVisible();
    if (portalName === 'Project Manager') {
      await expect(dialog).toContainText('services@twv-llc.com');
      await expect(dialog.getByLabel('Email')).toHaveValue('services@twv-llc.com');
    } else {
      await expect(dialog).toContainText(`Sign in to your ${portalName} portal`);
    }
    await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}`));
  });
}

test('project invitation preserves the invite flow while requesting authentication', async ({ page }) => {
  await page.goto(`/invite/${'a'.repeat(64)}`);
  await expect(page.getByRole('dialog', { name: 'Welcome to TW Ventures' })).toContainText('email address that received this project invitation');
});

test('public home presents investor project management with direct consultation and portal actions', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Build smarter. Protect your investment/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Portal sign in/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Project Manager sign in/i }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /Can TW Ventures pull permits/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /See the work—not just the promise/i })).toBeVisible();
  await expect(page.getByLabel('Assumed traditional GC markup')).toHaveValue('30');
  await expect(page.getByLabel('Assumed project-management fee')).toHaveValue('5');
  await page.getByRole('button', { name: /Get a project consultation/i }).click();
  await expect(page).toHaveURL(/\/get-started$/);
});

test('get started is a tracked project-intake form', async ({ page }) => {
  await page.goto('/get-started');
  await expect(page.getByRole('heading', { name: /Start with the right delivery model/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Send project request/i })).toBeDisabled();
});

test('CRM deep link is auth-gated for an anonymous visitor', async ({ page }) => {
  await page.goto('/pm?module=crm');
  await expect(page.getByRole('dialog', { name: 'Project Manager sign in' })).toContainText('services@twv-llc.com');
});

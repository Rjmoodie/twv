import { expect, test } from '@playwright/test';

for (const [path, portalName] of [
  ['/investor', 'Investor'],
  ['/pm', 'Project Manager'],
  ['/client', 'Client'],
] as const) {
  test(`${portalName} portal asks an anonymous visitor to authenticate for that role`, async ({ page }) => {
    await page.goto(path);
    const dialog = page.getByRole('dialog', { name: 'Welcome to TW Ventures' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(`Sign in to your ${portalName} portal`);
    await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}`));
  });
}

test('project invitation preserves the invite flow while requesting authentication', async ({ page }) => {
  await page.goto(`/invite/${'a'.repeat(64)}`);
  await expect(page.getByRole('dialog', { name: 'Welcome to TW Ventures' })).toContainText('email address that received this project invitation');
});

test('public home is client-first with direct portal and project actions', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Real estate, managed with clarity/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Access your projects/i })).toBeVisible();
  await page.getByRole('button', { name: /Start a new project/i }).click();
  await expect(page).toHaveURL(/\/get-started$/);
});

test('get started is a tracked project-intake form', async ({ page }) => {
  await page.goto('/get-started');
  await expect(page.getByRole('heading', { name: /Every sound project starts with a clear brief/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Send project request/i })).toBeDisabled();
});

test('CRM deep link is auth-gated for an anonymous visitor', async ({ page }) => {
  await page.goto('/pm?module=crm');
  await expect(page.getByRole('dialog', { name: 'Welcome to TW Ventures' })).toContainText('Project Manager portal');
});

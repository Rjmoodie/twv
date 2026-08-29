import { expect, test } from '@playwright/test';

for (const [path, portalName] of [
  ['/investor', 'Investor'],
  ['/pm', 'Project Manager'],
  ['/client', 'Client'],
] as const) {
  test(`${portalName} portal asks an anonymous visitor to authenticate for that role`, async ({ page }) => {
    await page.goto(path);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(`Sign in to your ${portalName} portal`);
    await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}`));
  });
}

test('project invitation preserves the invite flow while requesting authentication', async ({ page }) => {
  await page.goto(`/invite/${'a'.repeat(64)}`);
  await expect(page.getByRole('heading', { name: 'Sign in to accept your invitation' })).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('email address that received this project invitation');
});

test('client onboarding has direct portal and new-project actions', async ({ page }) => {
  await page.goto('/get-started');
  await expect(page.getByRole('heading', { name: /Welcome to your TWV client experience/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Access client portal/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Start a new project/i })).toHaveAttribute('href', /mailto:services@twv-llc.com/);
});

test('CRM deep link is auth-gated for an anonymous visitor', async ({ page }) => {
  await page.goto('/?module=crm');
  await expect(page.getByRole('dialog')).toContainText('administrator or project manager access');
});

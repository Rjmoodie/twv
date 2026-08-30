import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tw-cookie-consent', JSON.stringify({ state: 'declined', version: '1', ts: Date.now() })));
});

function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test('home primary actions respond without runtime errors', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'How it differs' }).click();
  await expect(page.getByText('A project manager is not simply a lower-cost general contractor.')).toBeInViewport();
  await page.getByRole('button', { name: 'Estimate potential difference' }).click();
  await expect(page.getByText('Potential cost difference')).toBeInViewport();
  await page.getByRole('button', { name: 'Get a project consultation' }).click();
  await expect(page).toHaveURL(/\/get-started$/);

  expect(errors).toEqual([]);
});

test('all fixed public routes render a main screen without horizontal overflow', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  for (const route of ['/', '/investors', '/get-started', '/privacy-policy', '/terms-of-service', '/404']) {
    await page.goto(route);
    await expect(page.locator('main')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, route).toBeLessThanOrEqual(1);
  }
  expect(errors).toEqual([]);
});

test('project-intake requirements are clear and unlock the action when complete', async ({ page }) => {
  await page.goto('/get-started');
  const submit = page.getByRole('button', { name: 'Send project request' });
  await expect(submit).toBeDisabled();
  await expect(page.getByText(/Complete your name, valid email, project type/i)).toBeVisible();

  await page.getByLabel('Full name *').fill('Jordan Investor');
  await page.getByLabel('Email *').fill('jordan@example.com');
  await page.getByLabel('Project type *').click();
  await page.getByRole('option', { name: 'Renovation planning and oversight' }).click();
  await page.getByLabel('What do you need help with? *').fill('Coordinate a Philadelphia renovation project.');

  await expect(page.getByText('Your project request is ready to send.')).toBeVisible();
  await expect(submit).toBeEnabled();
});

import { expect, test, type Page } from '@playwright/test';

const profile = {
  user_id: 'profile-1',
  handle: 'tw-ventures',
  display_name: 'TW Ventures LLC',
  bio: 'Owner-side project management for real estate investors across Philadelphia.',
  avatar_url: null,
};

const entry = {
  id: 'project-1',
  user_id: profile.user_id,
  slug: 'wilder-st',
  title: '2648 Wilder St',
  project_type: 'Full gut renovation',
  location_public: 'Gray’s Ferry, Philadelphia, PA',
  completed_on: '2026-05-01',
  summary: 'A Philadelphia rowhome taken back to the studs and rebuilt.',
  challenge: 'Create a durable, light-filled home while retaining its original character.',
  work_completed: 'The project was managed from demolition through finished interiors.',
  outcomes: 'A more functional plan with durable finishes.',
  services: ['Project management'],
  featured_image_url: '/og-image.jpg',
  gallery: [],
  latitude: 39.94,
  longitude: -75.19,
  article_title: '2648 Wilder St: Rebuilt From the Studs Up',
  article_excerpt: 'A full-gut renovation managed from demolition through closeout.',
  article_body: null,
  seo_title: null,
  seo_description: null,
  published_at: '2026-09-01T00:00:00Z',
};

async function mockPortfolio(page: Page) {
  await page.route('**/rest/v1/public_profiles*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(profile),
  }));
  await page.route('**/rest/v1/pm_portfolio_entries*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(route.request().url().includes('slug=eq.') ? entry : [entry]),
  }));
}

async function expectNoHorizontalOverflow(page: Page) {
  const size = await page.evaluate(() => ({
    viewport: window.innerWidth,
    root: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(size.root).toBeLessThanOrEqual(size.viewport + 1);
  expect(size.body).toBeLessThanOrEqual(size.viewport + 1);
}

test('public portfolio keeps a lean responsive path from work index to case study', async ({ page }) => {
  await mockPortfolio(page);
  await page.addInitScript(() => localStorage.setItem('tw-cookie-consent', JSON.stringify({ state: 'declined', version: '1', ts: Date.now() })));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/professionals/tw-ventures');

  await expect(page.getByRole('heading', { name: 'TW Ventures LLC' })).toBeVisible();
  await expect(page.getByText('1', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Projects delivered with intention.' })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole('link', { name: /2648 Wilder St: Rebuilt From the Studs Up/i }).click();
  await expect(page).toHaveURL(/\/work\/wilder-st$/);
  await expect(page.getByRole('heading', { name: entry.article_title })).toBeVisible();
  await expect(page.getByRole('link', { name: /TW Ventures LLC portfolio/i })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

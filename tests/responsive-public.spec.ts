import { expect, test, type Page } from '@playwright/test';

const routes = ['/', '/get-started', '/investors', '/privacy-policy', '/terms-of-service', '/404'];
const viewports = [
  { name: 'small phone', width: 320, height: 568 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'wide desktop', width: 1440, height: 900 },
] as const;

async function dismissConsent(page: Page) {
  const button = page.getByRole('button', { name: 'Essential only' });
  if (await button.count()) await button.click();
}

async function layoutHealth(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const viewportWidth = window.innerWidth;
    const overflowing = [...document.querySelectorAll<HTMLElement>('main *, header *, footer *')]
      .filter((element) => {
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.position === 'fixed') return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && (rect.left < -1 || rect.right > viewportWidth + 1);
      })
      .slice(0, 10)
      .map((element) => ({ tag: element.tagName, text: element.textContent?.trim().slice(0, 50), className: element.className }));

    return {
      viewportWidth,
      rootScrollWidth: root.scrollWidth,
      bodyScrollWidth: body.scrollWidth,
      pageHeight: Math.max(root.scrollHeight, body.scrollHeight),
      overflowing,
    };
  });
}

test('public routes remain scrollable and responsive at common screen sizes', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('tw-cookie-consent', JSON.stringify({ state: 'declined', version: '1', ts: Date.now() }));
  });

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      await page.goto(route);
      await dismissConsent(page);
      await page.evaluate(() => document.fonts.ready.then(() => true));

      const health = await layoutHealth(page);
      expect(health.rootScrollWidth, `${route} at ${viewport.name}`).toBeLessThanOrEqual(health.viewportWidth + 1);
      expect(health.bodyScrollWidth, `${route} at ${viewport.name}`).toBeLessThanOrEqual(health.viewportWidth + 1);
      expect(health.overflowing, `${route} at ${viewport.name}`).toEqual([]);

      await expect.poll(() => page.evaluate(() => {
        document.documentElement.style.scrollBehavior = 'auto';
        window.scrollTo(0, document.documentElement.scrollHeight);
        return Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 2;
      }), {
        message: `${route} should reach its bottom at ${viewport.name}`,
      }).toBe(true);
    }
  }
});

test('mobile sign-in sheet stays within the viewport and its content can scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await page.goto('/');
  await dismissConsent(page);
  await page.getByRole('button', { name: 'Project access' }).click();

  const dialog = page.getByRole('dialog', { name: 'Welcome to TW Ventures' });
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.evaluate((element) => getComputedStyle(element).transform)).toBe('none');
  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(-1);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(321);
  expect(bounds!.y).toBeGreaterThanOrEqual(-1);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(569);

  const scrollState = await dialog.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowY: getComputedStyle(element).overflowY,
  }));
  expect(['auto', 'scroll']).toContain(scrollState.overflowY);
  if (scrollState.scrollHeight > scrollState.clientHeight) {
    await dialog.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect.poll(() => dialog.evaluate((element) => element.scrollTop > 0)).toBe(true);
  }
});

test('landing comparison and estimator fit a small phone without clipping controls', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await dismissConsent(page);

  await page.getByRole('button', { name: 'Estimate potential difference' }).click();
  await expect(page.getByText('Potential cost difference')).toBeInViewport();

  for (const field of ['Base trade & material budget', 'Assumed traditional GC markup', 'Assumed project-management fee']) {
    const input = page.getByLabel(field);
    await expect(input).toBeVisible();
    const bounds = await input.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  }

  await page.getByRole('button', { name: 'How it differs' }).click();
  await expect(page.getByText('A project manager is not simply a lower-cost general contractor.')).toBeInViewport();
});

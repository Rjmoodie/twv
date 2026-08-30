import { expect, test, type Page } from '@playwright/test';

type Rgb = [number, number, number];

const parseRgb = (value: string): Rgb => {
  const channels = value.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!channels || channels.length !== 3) throw new Error(`Unsupported color: ${value}`);
  return channels as Rgb;
};

const luminance = (rgb: Rgb) => rgb
  .map((channel) => channel / 255)
  .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);

const contrast = (foreground: Rgb, background: Rgb) => {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
}

async function computedColors(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((element) => {
    const style = getComputedStyle(element);
    const placeholder = getComputedStyle(element, '::placeholder');
    return {
      color: style.color,
      background: style.backgroundColor,
      borderRadius: style.borderRadius,
      placeholder: placeholder.color,
    };
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`public project fields remain readable and visually consistent in ${theme} mode`, async ({ page }) => {
    await setTheme(page, theme);
    await page.goto('/get-started');

    const name = page.getByLabel('Full name *');
    const address = page.getByLabel('Property address or target area');
    const details = page.getByLabel('What do you need help with? *');
    const projectType = page.getByLabel('Project type *');

    await name.fill('Jordan Investor');
    await address.fill('Philadelphia, PA');
    await details.fill('Coordinate a renovation project with clear reporting.');

    const input = await computedColors(page, '#project-address');
    const textarea = await computedColors(page, '#project-details');
    const select = await computedColors(page, '#project-type');

    expect(contrast(parseRgb(input.color), parseRgb(input.background))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(parseRgb(input.placeholder), parseRgb(input.background))).toBeGreaterThanOrEqual(4.5);
    expect(textarea.background).toBe(input.background);
    expect(select.background).toBe(input.background);
    expect(textarea.borderRadius).toBe(input.borderRadius);
    expect(select.borderRadius).toBe(input.borderRadius);
    await expect(projectType).toHaveAttribute('data-placeholder', '');
  });
}

test('dark-mode sign-in dialog keeps its fixed-light content readable', async ({ page }) => {
  await setTheme(page, 'dark');
  await page.goto('/');
  const essential = page.getByRole('button', { name: 'Essential only' });
  if (await essential.count()) await essential.click();
  await page.getByRole('button', { name: 'Project access' }).click();

  const email = await computedColors(page, '#auth-email');
  const title = await page.getByRole('heading', { name: 'Welcome to TW Ventures' }).evaluate((element) => getComputedStyle(element).color);
  const dialogBackground = await page.locator('.brand-dialog').evaluate((element) => getComputedStyle(element).backgroundColor);

  expect(contrast(parseRgb(email.color), parseRgb(email.background))).toBeGreaterThanOrEqual(4.5);
  expect(contrast(parseRgb(title), parseRgb(dialogBackground))).toBeGreaterThanOrEqual(4.5);
});

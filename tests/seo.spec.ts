import { test, expect } from '@playwright/test';

/**
 * index.html ships a full set of static SEO tags so a non-JS fetch still sees
 * something, and react-helmet-async re-renders the same tags per route. Helmet
 * only replaces head tags carrying its own `data-rh` marker, so an unmarked
 * static tag survives alongside the rendered one: two canonicals, two
 * descriptions, two og:images — with the generic homepage values first, which
 * is the copy most social scrapers take.
 *
 * These routes render from static route metadata, so the check stays honest
 * without depending on published portfolio data.
 */
const staticRoutes = ['/', '/investors', '/get-started'];

for (const route of staticRoutes) {
  test(`${route} declares each SEO tag exactly once`, async ({ page }) => {
    await page.goto(route);
    await page.waitForSelector('h1', { timeout: 30_000 });
    const head = await page.evaluate(() => {
      const all = (selector: string) => [...document.querySelectorAll(selector)]
        .map((node) => node.getAttribute('content') ?? (node as HTMLLinkElement).href);
      return {
        canonical: all('link[rel="canonical"]'),
        description: all('meta[name="description"]'),
        robots: all('meta[name="robots"]'),
        ogTitle: all('meta[property="og:title"]'),
        ogType: all('meta[property="og:type"]'),
        ogUrl: all('meta[property="og:url"]'),
        ogImage: all('meta[property="og:image"]'),
        twitterTitle: all('meta[name="twitter:title"]'),
      };
    });
    for (const [tag, values] of Object.entries(head)) {
      expect(values, `${tag} on ${route}`).toHaveLength(1);
    }
    expect(head.canonical[0], `canonical on ${route}`).toBe(`https://twv-llc.com${route}`);
    expect(head.ogUrl[0], `og:url on ${route}`).toBe(`https://twv-llc.com${route}`);
  });
}

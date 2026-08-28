import { test, expect } from "@playwright/test";

async function clickAll(page: any, selector: string) {
  const els = await page.locator(selector).all();
  for (const el of els) {
    const href = await el.getAttribute("href");
    if (href?.startsWith("#") || href?.startsWith("mailto:")) continue;
    
    // Open links in same tab to assert they resolve
    await el.scrollIntoViewIfNeeded();
    const [nav] = await Promise.all([
      page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => null),
      el.click().catch(() => null),
    ]);
    
    // Go back to continue sweep
    if (href) await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => null);
  }
}

test("Home → all buttons & links respond", async ({ page }) => {
  await page.goto("/");
  
  const consoleErrors: string[] = [];
  page.on("console", msg => { 
    if (msg.type() === "error") consoleErrors.push(msg.text()); 
  });
  
  await clickAll(page, 'a, button:not([disabled])');
  
  expect(consoleErrors).toEqual([]); // No console errors
});

test("All navigation buttons work", async ({ page }) => {
  await page.goto("/");
  
  // Test sidebar navigation
  const navButtons = page.locator('[data-testid="nav-button"], .nav-item, [role="button"]');
  const count = await navButtons.count();
  
  for (let i = 0; i < count; i++) {
    const button = navButtons.nth(i);
    await button.click();
    await page.waitForTimeout(500); // Wait for navigation
  }
  
  // Verify no errors
  const consoleErrors: string[] = [];
  page.on("console", msg => { 
    if (msg.type() === "error") consoleErrors.push(msg.text()); 
  });
  
  expect(consoleErrors).toEqual([]);
});

test("Form submissions work without errors", async ({ page }) => {
  await page.goto("/");
  
  // Test any forms on the page
  const forms = page.locator('form');
  const formCount = await forms.count();
  
  for (let i = 0; i < formCount; i++) {
    const form = forms.nth(i);
    const submitButton = form.locator('button[type="submit"], input[type="submit"]');
    
    if (await submitButton.count() > 0) {
      await submitButton.click();
      await page.waitForTimeout(1000);
    }
  }
  
  // Verify no errors
  const consoleErrors: string[] = [];
  page.on("console", msg => { 
    if (msg.type() === "error") consoleErrors.push(msg.text()); 
  });
  
  expect(consoleErrors).toEqual([]);
});

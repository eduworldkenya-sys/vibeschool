#!/usr/bin/env node
// Production browser acceptance test for an unauthenticated VibeSchool visitor.
// No application credentials, write operations or seeded data required.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const ORIGIN = (process.env.VIBESCHOOL_ORIGIN || 'https://vibeschool.co.ke').replace(/\/$/, '');
const SCHOOL_ID = 'c51ec2ae-5b70-4f69-887d-54eb9f312db7';
const SCHOOL_PATH = `/schools/${SCHOOL_ID}`;
const sizes = [
  { width: 320, height: 720 }, { width: 360, height: 780 },
  { width: 390, height: 844 }, { width: 412, height: 915 },
  { width: 768, height: 1024 }, { width: 1280, height: 800 }
];
async function verify() {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const size of sizes) {
      const context = await browser.newContext({ viewport: size });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
      const schoolLink = page.locator('a[href="/schools"]').first();
      await schoolLink.waitFor({ timeout: 20000 });
      await schoolLink.click();
      await page.waitForURL(url => url.pathname === '/schools', { timeout: 20000 });
      await page.getByRole('textbox', { name: /school name/i }).fill('Gilgil Township');
      await page.getByRole('button', { name: /search schools/i }).click();
      const result = page.locator(`a[href="${SCHOOL_PATH}"]`);
      await result.waitFor({ timeout: 25000 });
      assert.match(await result.innerText(), /Gilgil Township/i);
      await result.click();
      await page.waitForURL(url => url.pathname === SCHOOL_PATH, { timeout: 20000 });
      await page.getByRole('heading', { name: 'Gilgil Township', exact: true }).waitFor({ timeout: 25000 });
      for (const section of ['About', 'Academics', 'Contact']) {
        const link = page.locator('.siteQuickLinks a').getByText(section, { exact: true });
        await link.waitFor();
        assert.ok((await link.getAttribute('href')).startsWith('#'));
      }
      assert.ok(await page.getByText(/public school profile/i).first().isVisible());
      assert.equal(pageErrors.length, 0, 'Unhandled browser errors: ' + pageErrors.join('; '));
      const dimensions = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth
      }));
      assert.ok(dimensions.scroll <= dimensions.client + 1,
        `Horizontal overflow at ${size.width}px: ${JSON.stringify(dimensions)}`);
      await page.locator('a[href="/schools"]').filter({ hasText: /school directory/i }).first().click();
      await page.waitForURL(url => url.pathname === '/schools', { timeout: 20000 });
      console.log(`PASS ${size.width}x${size.height} — homepage -> search -> school site -> directory`);
      await context.close();
    }
    const page = await browser.newPage();
    await page.goto(ORIGIN + '/schools/not-a-real-school-id', { waitUntil: 'domcontentloaded' });
    await page.getByText(/could not be loaded|not available/i).first().waitFor({ timeout: 20000 });
    await page.close();
    console.log('PASS invalid-school state');
  } finally {
    await browser.close();
  }
}
verify().catch(error => { console.error('SCHOOL PUBLIC BROWSER SMOKE FAILED:', error); process.exitCode = 1; });

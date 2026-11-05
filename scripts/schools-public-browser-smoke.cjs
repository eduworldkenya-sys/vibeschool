#!/usr/bin/env node
// Production browser acceptance test for an unauthenticated VibeSchool visitor.
// No application credentials, write operations or seeded data required.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const ORIGIN = (process.env.VIBESCHOOL_ORIGIN || 'https://vibeschool.co.ke').replace(/\/$/, '');
const SCHOOL_ID = 'c51ec2ae-5b70-4f69-887d-54eb9f312db7';
const SCHOOL_PATH = '/school/gilgiltownship';
const sizes = [
  { width: 320, height: 720 }, { width: 360, height: 780 },
  { width: 390, height: 844 }, { width: 412, height: 915 },
  { width: 768, height: 1024 }, { width: 1280, height: 800 }
];
async function verify() {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_PROXY_SERVER ? { proxy: { server: process.env.PLAYWRIGHT_PROXY_SERVER, bypass: '127.0.0.1,localhost' } } : {}) });
  try {
    for (const size of sizes) {
      const context = await browser.newContext({ viewport: size });
      const page = await context.newPage();
      const pageErrors = [];
      const networkErrors = [];
      page.on('requestfailed', request => { if(request.url().includes('/rest/v1/rpc/')) networkErrors.push(request.url().split('?')[0]+' '+request.failure()?.errorText); });
      page.on('response', async response => { if(response.url().includes('/rest/v1/rpc/') && response.status()>=400) networkErrors.push(response.status()+' '+(await response.text()).slice(0,400)); });
      page.on('pageerror', error => pageErrors.push(error.message));
      await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
      const mobile = size.width <= 1040;
      if (mobile) await page.locator('header details summary').click();
      const schoolLink = mobile
        ? page.locator('header nav[aria-label="Mobile public navigation"] a[href="/schools"]')
        : page.locator('header nav[aria-label="Public navigation"] a[href="/schools"]');
      await schoolLink.click();
      await page.waitForURL(url => url.pathname === '/schools', { timeout: 20000, waitUntil: 'domcontentloaded' });
      await page.getByRole('searchbox', { name: /search schools/i }).fill('Gilgil Township');
      const result = page.locator(`a[href="${SCHOOL_PATH}"]`);
      await result.waitFor({ timeout: 45000 }).catch(async error => { throw new Error(error.message+'\nPage: '+(await page.locator('main').innerText())+'\nBrowser: '+pageErrors.join('; ')+'\nNetwork: '+networkErrors.join('; ')); });
      assert.match(await result.innerText(), /Gilgil Township/i);
      await result.click();
      await page.waitForURL(url => url.pathname === SCHOOL_PATH, { timeout: 20000, waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Gilgil Township', exact: true }).waitFor({ timeout: 25000 });
      for (const section of ['About', 'Academics', 'Contact']) {
        const slug = section.toLowerCase();
        const link = page.locator('nav[aria-label="School pages"] a[href="' + SCHOOL_PATH + '/' + slug + '"]');
        await link.waitFor();
        assert.equal(await link.getAttribute('href'), SCHOOL_PATH + '/' + slug);
      }
      assert.equal(pageErrors.length, 0, 'Unhandled browser errors: ' + pageErrors.join('; '));
      const dimensions = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth
      }));
      assert.ok(dimensions.scroll <= dimensions.client + 1,
        `Horizontal overflow at ${size.width}px: ${JSON.stringify(dimensions)}`);
      await page.locator('nav[aria-label="Breadcrumb"] a[href="/schools"]').first().click();
      await page.waitForURL(url => url.pathname === '/schools', { timeout: 20000, waitUntil: 'domcontentloaded' }).catch(e => { throw new Error(`Schools nav failed from ${page.url()}: ${e.message}`); });
      console.log(`PASS ${size.width}x${size.height} — homepage -> search -> school site -> directory`);
      await context.close();
    }
    const page = await browser.newPage();
    for (const path of ['/school/not-a-real-school','/school/gilgiltownship/invalid','/schools/not-a-real-school-id']) {
      const response=await page.goto(ORIGIN+path,{waitUntil:'domcontentloaded'});
      assert.equal(response.status(),404,'Unknown school/section must 404');
    }
    for (const oldPath of [`/schools/${SCHOOL_ID}`, '/schools/directory/88d921f6-2be1-4abb-ab1b-af82283f07a9?name=wrong-name']) {
      await page.goto(ORIGIN+oldPath,{waitUntil:'domcontentloaded'});
      await page.waitForURL(ORIGIN+SCHOOL_PATH);
      await page.getByRole('heading',{name:'Gilgil Township',exact:true}).waitFor();
    }
    await page.goto(ORIGIN+'/schools',{waitUntil:'domcontentloaded'});
    await page.getByRole('searchbox',{name:/search schools/i}).fill('Municipality Mariakani');
    const mariakani=page.locator('a[href="/school/municipality-mariakani-primary"]');
    await mariakani.waitFor({timeout:25000});
    await mariakani.click();
    await page.getByRole('heading',{name:'2005 Municipality Mariakani Pri Sch',exact:true}).waitFor();
    assert.match(await page.locator('main').innerText(),/Laikipia/);
    for(const section of ['about','academics','news','contact']){
      await page.goto(ORIGIN+'/school/municipality-mariakani-primary/'+section,{waitUntil:'domcontentloaded'});
      await page.getByRole('heading',{name:'2005 Municipality Mariakani Pri Sch',exact:true}).waitFor();
    }
    await page.goto(ORIGIN+'/schools/directory/3bdac02b-99cb-4342-a969-3a060300858e',{waitUntil:'domcontentloaded'});
    await page.waitForURL(ORIGIN+'/school/municipality-mariakani-primary');
    console.log('PASS Mariakani identity, all sections, legacy IDs without name dependency, unknown URL rejection');
    await page.close();
    console.log('PASS invalid-school state');
  } finally {
    await browser.close();
  }
}
verify().catch(error => { console.error('SCHOOL PUBLIC BROWSER SMOKE FAILED:', error); process.exitCode = 1; });

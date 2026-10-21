const { chromium } = require(require.resolve('playwright', { paths: [process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES] }))
const assert = require('node:assert/strict')
;(async () => {
  const browser = await chromium.launch({headless:true})
  const results=[]
  for (const width of [360,390,768,1440]) {
    const context = await browser.newContext({viewport:{width,height:900}})
    const page = await context.newPage()
    const errors=[];page.on('pageerror',e=>errors.push(e.message))
    await page.goto('http://localhost:3000/success-wishes',{waitUntil:'networkidle',timeout:90000})
    await page.getByRole('heading',{name:'Let them know you believe.',exact:true}).waitFor()
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow')
    const config=await page.request.get('http://localhost:3000/api/success-wishes/config')
    assert.equal((await config.json()).enabled,false)
    assert.match(config.headers()['cache-control'],/no-store/)
    await page.screenshot({path:`/tmp/success-wishes-${width}.png`,fullPage:true})
    assert.deepEqual(errors,[])
    results.push({width,overflow:false,pageErrors:errors,disabled:true})
    await context.close()
  }
  process.stdout.write(JSON.stringify({test:'real disabled service UI; no mocked API',results},null,2)+'\n')
  await browser.close()
})().catch(e=>{process.stderr.write(String(e)+"\n");process.exit(1)})

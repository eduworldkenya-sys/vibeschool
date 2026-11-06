import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const base=process.env.PUBLIC_TEST_BASE_URL||'http://127.0.0.1:3000'
const fixture={pathways:[{id:'p1',slug:'stem',name:'STEM'},{id:'p2',slug:'social-sciences',name:'Social Sciences'},{id:'p3',slug:'arts-and-sports-science',name:'Arts & Sports Science'}],pathway_tracks:[{id:'t1',pathway_id:'p1',slug:'pure-sciences',name:'Pure Sciences'},{id:'t2',pathway_id:'p1',slug:'applied-sciences',name:'Applied Sciences'},{id:'t3',pathway_id:'p1',slug:'technical-studies',name:'Technical Studies'},{id:'t4',pathway_id:'p2',slug:'languages-and-literature',name:'Languages & Literature'},{id:'t5',pathway_id:'p3',slug:'arts',name:'Arts'}],pathway_subject_combinations:[{id:'c1',pathway_id:'p1',track_id:'t1',slug:'bio-chem-physics',display_name:'Biology · Chemistry · Physics'}],pathway_combination_subject_claims:['Biology','Chemistry','Physics'].map((subject_name,i)=>({combination_id:'c1',subject_name,subject_order:i+1})),pathway_careers:[{id:'doctor',slug:'doctor',name:'Doctor',summary:'Medical careers apply health sciences.'},{id:'engineer',slug:'engineer',name:'Engineer',summary:'Engineering solves technical problems.'},{id:'journalist',slug:'journalist',name:'Journalist',summary:'Research and communication.'}],pathway_career_links:[{career_id:'doctor',pathway_id:'p1',track_id:'t1',explanation:'Science guidance.'},{career_id:'engineer',pathway_id:'p1',track_id:'t3',explanation:'Technical guidance.'},{career_id:'journalist',pathway_id:'p2',track_id:'t4',explanation:'Language guidance.'}]}
const browser=await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:process.env.PLAYWRIGHT_BROWSER_CHANNEL?{channel:process.env.PLAYWRIGHT_BROWSER_CHANNEL}:{})
try{for(const width of [320,360,390,412,768,1440]){
 const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage()
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 let mode='ok',schoolMode='ok',request
 await page.route('**/rest/v1/**',async route=>{const table=new URL(route.request().url()).pathname.split('/').at(-1)
  if(table==='pathways_search_public_schools_v2'){request=route.request().postDataJSON();return route.fulfill(schoolMode==='error'?{status:503,json:{message:'offline'}}:{json:schoolMode==='empty'?[]:[{school_id:'00000000-0000-0000-0000-000000000001',school_name:'Fixture School',county:'Nakuru',pathway_slug:request.p_pathway_slug,combination_name:'Biology · Chemistry · Physics'}]})}
  if(Object.hasOwn(fixture,table))return route.fulfill(mode==='error'?{status:503,json:{message:'offline'}}:{json:fixture[table]})
  return route.fulfill({json:[]})
 })
 await page.goto(base+'/pathways');await page.getByRole('button',{name:'Doctor',exact:true}).waitFor()
 assert.equal(await page.getByRole('navigation',{name:'Main navigation',exact:true}).count(),0,'global menu must not cover school action')
 const picker=page.getByRole('group',{name:'Choose a pathway'}).filter({visible:true})
 await picker.getByRole('button',{name:'Social Sciences',exact:true}).locator('span').first().click()
 await page.getByRole('button',{name:'Journalist',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Doctor',exact:true}).count(),0)
 await picker.getByRole('button',{name:'STEM',exact:true}).locator('span').first().click()
 await page.getByRole('button',{name:'Biology',exact:true}).click();await page.getByRole('button',{name:'Doctor',exact:true}).click();await page.getByText('Medical careers apply health sciences.',{exact:true}).waitFor()
 await page.getByText('Subject combinations',{exact:true}).click();await page.getByRole('button',{name:'Biology · Chemistry · Physics',exact:true}).click();await page.getByRole('button',{name:'Find schools',exact:true}).click()
 await page.getByRole('link',{name:'Fixture School →'}).waitFor();assert.equal(request.p_pathway_slug,'stem');assert.equal(request.p_combination_slug,'bio-chem-physics')
 await page.getByRole('button',{name:'← Back to subjects',exact:true}).click()
 if(width<=760&&await page.getByRole('button',{name:'Change study area'}).getAttribute('aria-expanded')==='false')await page.getByRole('button',{name:'Change study area'}).click()
 await page.getByRole('button',{name:'Technical Studies',exact:true}).click();await page.getByRole('button',{name:'Engineer',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Doctor',exact:true}).count(),0)
 schoolMode='empty';await page.getByRole('button',{name:'Find schools',exact:true}).click();await page.getByText('No verified school matches yet.',{exact:true}).waitFor();assert.equal(request.p_combination_slug,null)
 await page.getByRole('button',{name:'← Back to subjects',exact:true}).click();schoolMode='error';await page.getByRole('button',{name:'Find schools',exact:true}).click();await page.getByText('Couldn’t load schools.',{exact:true}).waitFor()
 schoolMode='ok';await page.getByRole('button',{name:'Try again',exact:true}).click();await page.getByRole('link',{name:'Fixture School →'}).waitFor()
 mode='error';await page.reload();await page.getByText('Couldn’t load pathways.',{exact:true}).waitFor();mode='ok';await page.getByRole('button',{name:'Try again',exact:true}).click();await page.getByRole('button',{name:'Engineer',exact:true}).waitFor()
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}px horizontal overflow`);assert.deepEqual(errors,[])
 await page.goto(base+'/pathways');await page.getByRole('button',{name:'Doctor',exact:true}).waitFor()
 if(process.env.PATHWAYS_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.PATHWAYS_SCREENSHOT_DIR}/pathways-${width}.png`,fullPage:true})
 console.log(`PASS ${width}px: selections, careers, combinations, schools, empty/error/retry, no overflow`);await context.close()
}}finally{await browser.close()}

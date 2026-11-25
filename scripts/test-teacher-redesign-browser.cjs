#!/usr/bin/env node
// Browser checks of the real shared components, not a production or authentication test.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const deps=process.env.REDESIGN_BROWSER_DEPS;
const load=name=>deps?require(path.join(deps,"node_modules",name)):require(name);
const {chromium}=load("playwright");
const {build}=load("esbuild");
const root=path.resolve(__dirname,"..");
const families=["Buttons","Search","Filters","Forms","Navigation","Overlays","Data display","Feedback","Interactions","Verification"];
async function main(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"vibe-redesign-"));
 let browser;
 try{
  await build({absWorkingDir:root,entryPoints:["scripts/fixtures/teacher-redesign-lab.tsx"],outfile:path.join(dir,"lab.js"),bundle:true,jsx:"automatic",loader:{".module.css":"local-css"},define:{"process.env.NODE_ENV":'"production"'},platform:"browser"});
  fs.writeFileSync(path.join(dir,"index.html"),'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Design Lab test</title><style>html,body,#root{margin:0;height:100%}*{box-sizing:border-box}</style><link rel="stylesheet" href="lab.css"><div id="root"></div><script src="lab.js"></script></html>');
  const url=pathToFileURL(path.join(dir,"index.html")).href;
  browser=await chromium.launch({headless:true});
  const errors=[];
  for(const width of [320,360,390,768,1024,1440]){
   const page=await browser.newPage({viewport:{width,height:850},reducedMotion:"reduce"});
   page.on("pageerror",e=>errors.push(e.message));
   for(const theme of ["light","dark"]){
    await page.goto(url+"?theme="+theme);
    for(const family of families){
     await page.getByRole("tab",{name:family,exact:true}).click();
     const main=page.locator("main");
     assert(await main.evaluate(el=>el.scrollWidth<=el.clientWidth+1),family+" overflows main at "+width+" "+theme);
     assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),family+" overflows page at "+width+" "+theme);
    }
   }
   await page.close();
   console.log("Viewport checked:",width);
  }
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto(url);
  const tab=async name=>page.getByRole("tab",{name,exact:true}).click();
  await page.getByRole("button",{name:"Save sample",exact:true}).click();
  assert(await page.getByRole("button",{name:"Saving…",exact:true}).isDisabled());
  await page.getByRole("button",{name:"Resolve simulated save"}).click();
  await page.getByRole("button",{name:"Delete sample"}).click();
  await page.getByRole("dialog",{name:"Confirm sample action"}).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("dialog[open]").count(),0);
  assert(await page.getByRole("button",{name:"Delete sample"}).evaluate(el=>el===document.activeElement));
  await tab("Search");
  await page.getByRole("button",{name:"Expandable",exact:true}).click();
  await page.getByRole("button",{name:"Search",exact:true}).click();
  const search=page.getByRole("searchbox",{name:"Find a lesson"});
  await search.fill("homophones");
  await page.getByRole("button",{name:/Homophones English/}).waitFor();
  await search.fill("no matching text");
  await page.getByText("No matches",{exact:true}).waitFor();
  await tab("Filters");
  await page.getByRole("button",{name:"Filters (0)"}).click();
  await page.getByRole("dialog").getByRole("checkbox",{name:"Mathematics"}).check();
  await page.getByRole("button",{name:"Show 2 results"}).click();
  await page.getByText("2 matching records",{exact:true}).waitFor();
  await tab("Forms");
  await page.getByRole("button",{name:"Save draft"}).click();
  await page.getByText("Enter a lesson title",{exact:true}).waitFor();
  await page.getByRole("textbox",{name:/Lesson title/}).fill("Sample title");
  await page.getByRole("button",{name:"Save draft"}).click();
  await page.getByText("Lesson draft saved (sample)",{exact:true}).waitFor();
  await tab("Interactions");
  await page.getByRole("button",{name:"Move Homophones down"}).click();
  await page.getByRole("button",{name:"Undo",exact:true}).click();
  await page.getByRole("button",{name:"Move Homophones up"}).isDisabled().then(v=>assert(v));
  const separator=page.getByRole("separator",{name:"Resize side panel"});
  await separator.focus();
  await page.keyboard.press("ArrowLeft");
  assert.equal(await separator.getAttribute("aria-valuenow"),"45");
  await page.getByRole("button",{name:"Hide Resources"}).click();
  assert.equal(await page.getByRole("separator",{name:"Resize side panel"}).count(),0);
  await page.getByRole("checkbox",{name:"Select all shown"}).check();
  await page.getByText("4 of 4 selected",{exact:true}).waitFor();
  await page.getByRole("button",{name:"Complete sample items"}).click();
  await page.getByText("0 of 4 selected",{exact:true}).waitFor();
  await tab("Navigation");
  await page.keyboard.press("Control+k");
  await page.getByRole("dialog",{name:"Find an action"}).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("dialog[open]").count(),0);
  await page.close();
  assert.deepEqual(errors,[]);
  console.log("Design Lab interactions and responsive geometry passed.");
 }finally{if(browser)await browser.close();fs.rmSync(dir,{recursive:true,force:true})}
}
main().catch(error=>{console.error(error);process.exitCode=1});

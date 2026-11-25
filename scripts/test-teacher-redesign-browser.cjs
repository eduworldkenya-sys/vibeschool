#!/usr/bin/env node
// Browser checks of the real shared components, not a production or authentication test.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const http=require("node:http");
const deps=process.env.REDESIGN_BROWSER_DEPS;
const load=name=>deps?require(path.join(deps,"node_modules",name)):require(name);
const {chromium}=load("playwright");
const {build}=load("esbuild");
const root=path.resolve(__dirname,"..");
const families=["Buttons","Search","Filters","Forms","Navigation","Overlays","Data display","Feedback","Interactions","Verification"];

async function todayChecks(browser,dir,errors){
 await build({absWorkingDir:root,entryPoints:["scripts/fixtures/teacher-redesign-today.tsx"],outfile:path.join(dir,"today.js"),bundle:true,jsx:"automatic",loader:{".module.css":"local-css"},define:{"process.env.NODE_ENV":'"production"',"process.env.NEXT_PUBLIC_VIBE_LIVE_ENABLED":'"true"'},platform:"browser",plugins:[{name:"fixture-image",setup(builder){builder.onResolve({filter:new RegExp("^next/image$")},()=>({path:"image",namespace:"fixture"}));builder.onLoad({filter:/.*/,namespace:"fixture"},()=>({contents:'import React from "react";export default function Image(props){return React.createElement("img",props)}',loader:"js",resolveDir:root}))}}]});
 const html='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Teacher Today test</title><style>html,body,#root{margin:0;height:100%}*{box-sizing:border-box}</style><link rel="stylesheet" href="/today.css"><div id="root"></div><script src="/today.js"></script></html>';
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,"http://localhost").pathname;
  if(pathname==="/teacher/redesign"){res.setHeader("Content-Type","text/html");res.end(html);return}
  const files={"/today.js":[path.join(dir,"today.js"),"text/javascript"],"/today.css":[path.join(dir,"today.css"),"text/css"],"/brand/vibeschool-wordmark.svg":[path.join(root,"public/brand/vibeschool-wordmark.svg"),"image/svg+xml"],"/brand/vibeschool-wordmark-dark.svg":[path.join(root,"public/brand/vibeschool-wordmark-dark.svg"),"image/svg+xml"]};
  const file=files[pathname];if(!file||!fs.existsSync(file[0])){res.statusCode=404;res.end();return}res.setHeader("Content-Type",file[1]);res.end(fs.readFileSync(file[0]));
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const origin="http://127.0.0.1:"+server.address().port+"/teacher/redesign";
 try{
  for(const width of [320,360,390,768,1024,1440]){
   for(const colorScheme of ["light","dark"]){
    const p=await browser.newPage({viewport:{width,height:850},colorScheme,reducedMotion:"reduce"});
    p.on("pageerror",e=>errors.push(e.message));
    await p.goto(origin);await p.getByRole("heading",{name:"Today",exact:true}).waitFor();
    assert(await p.locator("main").evaluate(el=>el.scrollWidth<=el.clientWidth+1),"Today overflow "+width+" "+colorScheme);
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"Page overflow "+width+" "+colorScheme);
    const nav=p.getByRole("navigation",{name:"Redesign navigation"});
    await nav.getByRole("button",{name:"Teach",exact:true}).click();
    const selected=nav.getByRole("button",{name:"Teach",exact:true});
    assert.equal(await selected.getAttribute("aria-current"),"page");
    const style=await selected.evaluate(el=>{const s=getComputedStyle(el);return {background:s.backgroundColor,left:s.borderLeftWidth,top:s.borderTopWidth,weight:Number(s.fontWeight),radius:s.borderRadius}});
    assert.equal(style.background,"rgba(0, 0, 0, 0)","Active navigation must remain flat");
    assert.equal(style.left,"0px");assert.equal(style.top,"0px");assert.ok(style.weight>=650);
    if(width>=600)assert.equal(style.radius,"0px","Sidebar must not use selected pills");
    for(const [name,heading] of [["Subjects","Subject Hub"],["Curriculum map","Curriculum Map"],["Scheme of work","Scheme of Work"],["Lesson plans","Lesson Plans"],["Lesson notes","Lesson Notes"]]){
     await p.getByRole("main").getByRole("button",{name,exact:true}).click();
     await p.getByRole("heading",{name:heading,exact:true}).waitFor();
     assert(await p.locator("main").evaluate(el=>el.scrollWidth<=el.clientWidth+1),heading+" overflow "+width+" "+colorScheme);
     await p.getByRole("button",{name:"Back",exact:true}).click();
     await p.getByRole("heading",{name:"Teach",exact:true}).waitFor();
    }
    await p.close();
   }
  }
  const p=await browser.newPage({viewport:{width:390,height:844},reducedMotion:"reduce"});
  p.on("pageerror",e=>errors.push(e.message));
  const button=(name)=>p.getByRole("button",{name,exact:true});
  const home=async()=>p.getByRole("heading",{name:"Today",exact:true}).waitFor();
  const back=async()=>{await button("Back").click();await home()};
  const count=async(name)=>p.getByRole("region",{name:"Sample lesson records"}).getByRole("button",{name,exact:true}).waitFor();
  await p.goto(origin);await home();
  await count("5 To mark");await count("2 Attendance");
  await button("Resources, pending").click();
  assert.match(p.url(),/occurrence=english-today/);
  await p.getByRole("checkbox",{name:"Sample preparation complete"}).check();
  await button("Save and return").click();await home();
  assert.equal(await p.getByRole("progressbar",{name:"Lesson preparation"}).getAttribute("aria-valuenow"),"4");
  await button("Notes, complete").click();await p.getByRole("textbox",{name:"Teacher notes"}).fill("Retained sample draft");await back();
  await button("Notes, complete").click();assert.equal(await p.getByRole("textbox",{name:"Teacher notes"}).inputValue(),"Retained sample draft");await button("Save and return").click();await home();
  await p.locator("summary").filter({hasText:"Teaching context"}).click();
  await p.getByRole("combobox",{name:"Class",exact:true}).selectOption("class-5");
  await p.getByRole("combobox",{name:"Subject",exact:true}).selectOption("english");
  await count("0 Lessons");await p.getByText(/Writing sentences/).waitFor();
  await p.getByRole("combobox",{name:"Class",exact:true}).selectOption("all");
  await p.locator("summary").filter({hasText:"Teaching context"}).click();
  await count("4 Lessons");await count("5 To mark");
  await p.getByRole("region",{name:"Sample lesson records"}).getByRole("button",{name:"5 To mark",exact:true}).click();
  const queue=p.getByRole("region",{name:"Homework marking queue"});
  await queue.getByRole("heading",{name:"Place value",exact:true}).waitFor();
  assert.equal(await queue.getByRole("heading",{name:"Place value",exact:true}).count(),1);
  assert.equal(await queue.getByRole("listitem").count(),5);
  const firstRow=queue.getByRole("listitem").first();
  const geometry=await firstRow.evaluate(el=>({row:el.getBoundingClientRect().width,button:el.querySelector("button").getBoundingClientRect().width,height:el.getBoundingClientRect().height,border:getComputedStyle(el).borderRadius}));
  assert.ok(geometry.button<geometry.row/2,"Row action must not stretch across the workspace");
  assert.ok(geometry.height<100,"Queue row must remain compact");
  assert.equal(geometry.border,"0px");
  const search=queue.getByRole("searchbox",{name:"Find homework submissions"});
  await search.fill("learner B");assert.equal(await queue.getByRole("listitem").count(),1);
  await search.fill("");assert.equal(await queue.getByRole("listitem").count(),5);
  await p.getByRole("button",{name:"Mark sample submission",exact:true}).first().click();
  await queue.getByRole("tab",{name:"Marked 1",exact:true}).click();
  assert.equal(await queue.getByRole("listitem").count(),1);
  await queue.getByRole("tab",{name:"Assignments",exact:true}).click();
  await queue.getByRole("button",{name:"Open queue",exact:false}).first().waitFor();
  await queue.getByRole("tab",{name:"Results",exact:true}).click();
  await queue.getByText("Marking progress only · No scores recorded in this preview.",{exact:true}).waitFor();
  assert.equal(await queue.getByRole("progressbar").count(),2);
  await queue.getByRole("tab",{name:"To mark 4",exact:true}).click();
  await queue.getByRole("combobox",{name:"Class",exact:true}).selectOption("class-5");
  assert.equal(await queue.getByRole("listitem").count(),1);
  await queue.getByRole("combobox",{name:"Class",exact:true}).selectOption("all");
  assert.equal(await queue.getByRole("listitem").count(),4);
  await back();await count("4 To mark");
  await p.getByRole("region",{name:"Sample lesson records"}).getByRole("button",{name:"2 Attendance",exact:true}).click();
  await p.getByRole("button",{name:"Complete sample attendance",exact:true}).first().click();await back();await count("1 Attendance");
  await button("Go Live").click();await button("Start sample class").click();await button("Pause sample class").click();
  await button("Resume sample class").click();await button("End sample class").click();await home();await button("Go Live").waitFor();
  await button("Past").click();await p.getByText(/Ended \(sample\)/).waitFor();await back();
  await button("Appearance settings").click();
  await p.getByRole("combobox",{name:"Preview lesson state"}).selectOption("error");
  await button("Close").click();await home();await button("Retry").click();await button("Resources, complete").waitFor();
  await button("Appearance settings").click();await button("Reset preview").click();await button("Close").click();await home();await count("5 To mark");await count("2 Attendance");
  await p.goto(origin+"?panel=stage%3A2&occurrence=english-tomorrow");
  await p.getByRole("heading",{name:"Notes",exact:true}).waitFor();await p.getByText("Writing sentences",{exact:true}).waitFor();
  await p.goto(origin+"?panel=stage%3A2&occurrence=bad");await home();
  await p.goto(origin+"?tab=teach&panel=curriculum&classId=class-4&subjectId=english&unitId=unit-reading");
  await p.getByRole("heading",{name:"Curriculum Map",exact:true}).waitFor();
  await p.getByText("Reading comprehension",{exact:true}).waitFor();
  await p.getByRole("checkbox",{name:"Answer questions using evidence from the passage."}).uncheck();
  await button("Add to Term 3, Week 11").click();
  await button("Open linked scheme").click();
  await p.getByRole("heading",{name:"Scheme of Work",exact:true}).waitFor();
  await p.getByText("Reading comprehension",{exact:true}).waitFor();
  await p.locator("summary").filter({hasText:"Lesson details"}).click();
  await p.getByRole("textbox",{name:"Unscheduled lesson draft"}).fill("Sample introduction");
  await button("Save draft").click();
  await p.getByText("Sample draft saved; no lesson scheduled.",{exact:true}).waitFor();
  await p.goto(origin+"?tab=teach&panel=scheme&classId=class-4&subjectId=english&unitId=unit-homophones");
  await p.getByRole("heading",{name:"Scheme of Work",exact:true}).waitFor();
  await button("Prepare lesson").click();
  assert.match(p.url(),/occurrence=english-today/);
  await p.getByRole("heading",{name:"Plan",exact:true}).waitFor();
  const objectives=p.getByRole("textbox",{name:"Learning objectives",exact:true});
  const originalObjectives=await objectives.inputValue();
  await objectives.fill("");
  await button("Save plan").click();
  await p.getByText("Sample plan saved · Needs review",{exact:true}).waitFor();
  await p.getByRole("button",{name:"Today",exact:true}).click();await home();
  await button("Plan, pending").click();
  await p.getByRole("textbox",{name:"Learning objectives",exact:true}).fill(originalObjectives);
  await button("Save and return").click();await home();
  await button("Plan, complete").waitFor();
  await p.goto(origin+"?tab=teach&panel=plans");
  await p.getByRole("heading",{name:"Lesson Plans",exact:true}).waitFor();
  await p.getByRole("searchbox",{name:"Find lesson plans"}).fill("Writing sentences");
  await button("Create plan").click();
  assert.match(p.url(),/occurrence=english-tomorrow/);
  await button("Save plan").click();
  await p.getByText("Sample plan saved · Needs review",{exact:true}).waitFor();
  await p.close();console.log("Today and Teach: six widths and two themes; scoped preparation, curriculum and plan saves, readiness, notes and dated handoff.");
 }finally{await new Promise(resolve=>server.close(resolve))}
}

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
  await todayChecks(browser,dir,errors);
  assert.deepEqual(errors,[]);
  console.log("Design Lab interactions and responsive geometry passed.");
 }finally{if(browser)await browser.close();fs.rmSync(dir,{recursive:true,force:true})}
}
main().catch(error=>{console.error(error);process.exitCode=1});

import assert from "node:assert/strict";
import {test} from "node:test";
import {parseDestination,destinationSearch,openingFor,toolPanel} from "../app/teacher/redesign/destination.ts";
import {teacherTabs,teacherTools} from "../components/teacher/navigation.ts";
test("all primary destinations round trip",()=>{
 for(const {id:tab} of teacherTabs){const d={tab,panel:null};assert.deepEqual(parseDestination(destinationSearch(d)),d)}
});
test("all five preparation steps round trip",()=>{
 for(let index=0;index<5;index++){const d={tab:"today",panel:{kind:"stage",index}};assert.deepEqual(parseDestination(destinationSearch(d)),d);assert.equal(openingFor(d.panel),"workspace")}
});
test("registered tools round trip without leaving redesign",()=>{
 for(const {id:tab} of teacherTabs)for(const t of teacherTools[tab]){const d={tab,panel:toolPanel(t.href,t.label)};assert.deepEqual(parseDestination(destinationSearch(d)),d)}
});
test("invalid and unknown URLs safely resolve to known destinations",()=>{
 for(const query of ["?tab=admin","?panel=stage:5","?panel=stage:","?panel=stage:-1","?panel=stage:01","?panel=tool:https://example.com","?panel=unknown"]){assert.deepEqual(parseDestination(query),{tab:"today",panel:null})}
});
test("quick sheets, dedicated workspaces and immersive Live are distinct",()=>{
 for(const kind of ["settings","tools","notifications"])assert.equal(openingFor({kind}),"sheet");
 for(const kind of ["teach","studio","timetable","mark","attendance","past"])assert.equal(openingFor({kind}),"workspace");
 assert.equal(openingFor({kind:"live"}),"immersive");
});

import {readFileSync} from "node:fs";
const css=readFileSync(new URL("../app/teacher/redesign/redesign.module.css",import.meta.url),"utf8");
function colorTokens(selector){
 const rule=css.split(selector+"{")[1]?.split("}")[0];
 assert.ok(rule,"Missing token rule "+selector);
 return Object.fromEntries([...rule.matchAll(/--([\w-]+):\s*(#[0-9a-f]{3,6})(?=;|\s|$)/gi)].map(x=>[x[1],x[2]]));
}
function luminance(hex){
 assert.match(hex,/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i);
 let h=hex.slice(1);if(h.length===3)h=[...h].map(x=>x+x).join("");
 return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4).reduce((sum,x,i)=>sum+x*[0.2126,0.7152,0.0722][i],0);
}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)}
test("white-first surfaces, semantic contrast, and every accent in both themes",()=>{
 const base=colorTokens(".shell"),dark={...base,...colorTokens(".shell[data-theme=dark]")};
 assert.equal(base.surface,"#fff");
 assert.match(css,/\.hero\{[^}]*background:var\(--surface\);color:var\(--ink\)/);
 assert.match(css,/\.fullWorkspace\[data-opening=immersive\]\{[^}]*background:var\(--immersive\)/);
 for(const [theme,t] of [["light",base],["dark",dark]]){
  const check=(colors,fg,bg,min,context)=>assert.ok(contrast(colors[fg],colors[bg])>=min,context+": "+fg+"/"+bg+" < "+min);
  for(const [fg,bg,min] of [["ink","surface",4.5],["muted","surface",4.5],["muted","base",4.5],["control","surface",3],["control","base",3],["success","success-bg",4.5],["warning","warning-bg",4.5],["danger","danger-bg",4.5],["immersive-ink","immersive",4.5],["immersive-muted","immersive",4.5],["immersive-control","immersive",3]])check(t,fg,bg,min,theme);
  for(const accent of ["blue","indigo","teal","emerald","neutral"]){
   const a=accent==="blue"?t:{...t,...colorTokens(".shell[data-accent="+accent+"]"),...(theme==="dark"?colorTokens(".shell[data-theme=dark][data-accent="+accent+"]"):{})};
   for(const [fg,bg,min] of [["onblue","blue",4.5],["selected","soft",4.5],["selected","surface",4.5],["selected","base",3]])check(a,fg,bg,min,theme+"/"+accent);
  }
 }
 const system=colorTokens(".shell[data-theme=system]");
 for(const key of ["base","surface","ink","muted","control","warning","success-bg","warning-bg","danger-bg","selected"])assert.equal(system[key],dark[key],key+" system dark mismatch");
 for(const accent of ["indigo","teal","emerald","neutral"])assert.deepEqual(colorTokens(".shell[data-theme=system][data-accent="+accent+"]"),colorTokens(".shell[data-theme=dark][data-accent="+accent+"]"));
});

import {matchItems,rememberSearch,moveItem,filterRecords,initialFilter,activeFilterCount,monthDays} from "../app/teacher/redesign/component-logic.ts";
test("Design Lab is a deep-linkable dedicated workspace",()=>{
 const d={tab:"me",panel:{kind:"lab"}};
 assert.deepEqual(parseDestination(destinationSearch(d)),d);
 assert.equal(openingFor(d.panel),"workspace");
});
test("canonical search ranks matching labels and respects all query words",()=>{
 const items=[{id:"1",label:"Lesson plans",category:"Teach"},{id:"2",label:"Plans",category:"Teach"},{id:"3",label:"Mathematics",category:"Classes",keywords:"Lesson plans"}];
 assert.deepEqual(matchItems(items,"plans").map(x=>x.id),["2","1","3"]);
 assert.deepEqual(matchItems(items,"teach lesson").map(x=>x.id),["1"]);
 assert.deepEqual(matchItems(items,"unavailable"),[]);
 assert.deepEqual(matchItems(items,"  "),items);
});
test("recent searches are bounded, deduplicated and newest first",()=>{
 assert.deepEqual(rememberSearch(["English","Maths","Science"]," english ",2),["english","Maths"]);
 assert.deepEqual(rememberSearch(["English"]," "),["English"]);
});
test("filters combine class, subject and state without changing source records",()=>{
 const rows=[{label:"B",grade:"4",subject:"English",status:"Ready"},{label:"A",grade:"4",subject:"Mathematics",status:"Draft"},{label:"C",grade:"5",subject:"English",status:"Ready"}];
 const filter={grade:"4",subjects:["English","Mathematics"],status:"Ready",sort:"desc"};
 assert.equal(activeFilterCount(filter),5);
 assert.deepEqual(filterRecords(rows,filter).map(r=>r.label),["B"]);
 assert.deepEqual(filterRecords(rows,initialFilter).map(r=>r.label),["A","B","C"]);
 assert.deepEqual(rows.map(r=>r.label),["B","A","C"]);
 assert.equal(activeFilterCount(initialFilter),0);
});
test("reorder is immutable, safe at boundaries, and works both directions",()=>{
 const initial=["a","b","c"];
 assert.deepEqual(moveItem(initial,0,2),["b","c","a"]);
 assert.deepEqual(moveItem(initial,2,0),["c","a","b"]);
 assert.deepEqual(moveItem(initial,-1,1),initial);
 assert.deepEqual(moveItem(initial,1,9),initial);
 assert.deepEqual(initial,["a","b","c"]);
});
test("calendar handles leap years and month boundaries",()=>{
 assert.equal(monthDays(2024,1).filter(x=>x!==null).length,29);
 assert.equal(monthDays(2025,1).filter(x=>x!==null).length,28);
 assert.equal(monthDays(2026,10).filter(x=>x!==null).length,30);
 assert.equal(monthDays(2026,11).at(-1),31);
});
test("component samples and Teacher Home share the same primitives",()=>{
 const read=name=>readFileSync(new URL("../app/teacher/redesign/"+name,import.meta.url),"utf8");
 const lab=read("design-lab.tsx"),home=read("page.tsx");
 for(const label of ["Buttons","Search","Filters","Forms","Navigation","Overlays","Data display","Feedback","Interactions","Verification"])assert.ok(lab.includes('"'+label+'"'),label);
 assert.match(home,/<DesignLab\/>/);
 assert.match(home,/<SmartSearch mode="filtered"/);
 assert.match(home,/<ActionButton/);
 assert.match(lab,/<ActionButton/);
 assert.match(lab,/<SmartSearch/);
});

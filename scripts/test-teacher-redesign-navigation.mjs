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

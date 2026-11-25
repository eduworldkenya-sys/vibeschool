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

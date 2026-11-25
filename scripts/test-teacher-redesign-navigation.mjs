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

import {createPreviewState,previewReducer,todayView,notifications,previewDate} from "../app/teacher/redesign/preview-state.ts";
const all={classId:"all",subjectId:"all"};
test("Today derives counts and next dated occurrence from shared records",()=>{
 const state=createPreviewState(),view=todayView(state,all);
 assert.equal(view.lessons.length,4);assert.equal(view.next.id,"english-today");assert.equal(view.submissions.length,5);assert.equal(view.attendance.length,2);
 const scoped=todayView(state,{classId:"class-5",subjectId:"english"});
 assert.equal(scoped.lessons.length,0);assert.equal(scoped.next.id,"english-tomorrow");assert.equal(scoped.attendance.length,0);assert.equal(scoped.submissions.length,0);
 const independent=todayView(state,{classId:"independent",subjectId:"all"});
 assert.equal(independent.next,null);assert.equal(independent.submissions.length,0);
 assert.equal(view.next.date,previewDate);
});
test("exact lesson identity round trips, and unknown IDs cannot select a foreign record",()=>{
 for(const kind of ["stage","teach","studio","live"]){
  const panel={kind,occurrenceId:"english-tomorrow",...(kind==="stage"?{index:2}:{})};
  const d={tab:"today",panel};assert.deepEqual(parseDestination(destinationSearch(d)),d);
 }
 assert.deepEqual(parseDestination("?panel=stage:2&occurrence=other-school"),{tab:"today",panel:null});
 assert.equal(openingFor({kind:"homework-mark"}),"workspace");
 assert.deepEqual(parseDestination("?panel=homework-mark"),{tab:"today",panel:{kind:"homework-mark"}});
 assert.equal(toolPanel("/teacher/assessment/marking","Mark submissions").kind,"mark");
});
test("preparation drafts are scoped to exact occurrence and validation preserves input",()=>{
 const initial=createPreviewState();
 let state=previewReducer(initial,{type:"draft",id:"english-today",index:3,checked:true});
 assert.equal(todayView(state,all).next.preparation[3],"pending");
 state=previewReducer(state,{type:"savePreparation",id:"english-today",index:3});
 assert.equal(todayView(state,all).next.preparation[3],"done");
 assert.deepEqual(todayView(state,all).next.resourceIds,["resource-1"]);
 assert.equal(state.occurrences.find(x=>x.id==="english-tomorrow").preparation[3],"pending");
 assert.equal(initial.occurrences.find(x=>x.id==="english-today").preparation[3],"pending");
 state=previewReducer(state,{type:"draft",id:"english-today",notes:"  ",index:2,checked:true});
 assert.equal(previewReducer(state,{type:"savePreparation",id:"english-today",index:2}),state);
 assert.equal(state.drafts["english-today"].notes,"  ");
 state=previewReducer(state,{type:"draft",id:"english-today",notes:"New notes"});
 state=previewReducer(state,{type:"savePreparation",id:"english-today",index:2});
 assert.equal(todayView(state,all).next.notes,"New notes");assert.equal(state.drafts["english-today"].notes,undefined);
});
test("attendance and homework counts change only for the addressed record",()=>{
 const original=createPreviewState(),before=todayView(original,all);
 let state=previewReducer(original,{type:"recordAttendance",id:"english-today"});
 state=previewReducer(state,{type:"markSubmission",id:"submission-1"});
 let view=todayView(state,all);
 assert.equal(view.attendance.length,before.attendance.length-1);assert.equal(view.submissions.length,before.submissions.length-1);
 state=previewReducer(state,{type:"recordAttendance",id:"english-today"});
 state=previewReducer(state,{type:"markSubmission",id:"submission-1"});
 view=todayView(state,all);
 assert.equal(view.attendance.length,1);assert.equal(view.submissions.length,4);
 assert.equal(todayView(state,{classId:"class-5",subjectId:"all"}).submissions.length,1);
});
test("delivery cannot be inferred from preparation or start a future occurrence",()=>{
 let state=createPreviewState();
 state=previewReducer(state,{type:"finishTeaching",id:"english-today"});
 assert.equal(todayView(state,all).next.delivery,"scheduled");
 state=previewReducer(state,{type:"startTeaching",id:"english-tomorrow"});
 assert.equal(state.occurrences.find(x=>x.id==="english-tomorrow").delivery,"scheduled");
 state=previewReducer(state,{type:"startTeaching",id:"english-today"});
 assert.equal(todayView(state,all).next.delivery,"teaching");
 state=previewReducer(state,{type:"finishTeaching",id:"english-today"});
 assert.equal(todayView(state,all).next.id,"english-tomorrow");
});
test("instant mock Live, pause/resume, end and duplicate protection",()=>{
 let state=createPreviewState();
 state=previewReducer(state,{type:"startSession",audience:"class-4",occurrenceId:"english-today"});
 const id=todayView(state,all).active.id;
 assert.equal(todayView(state,all).active.occurrenceId,"english-today");
 assert.equal(previewReducer(state,{type:"startSession",audience:"open",occurrenceId:null}),state);
 state=previewReducer(state,{type:"pauseSession",id});assert.equal(todayView(state,all).active.status,"paused");
 state=previewReducer(state,{type:"resumeSession",id});assert.equal(todayView(state,all).active.status,"active");
 state=previewReducer(state,{type:"endSession",id});assert.equal(todayView(state,all).active,null);
 state=previewReducer(state,{type:"resumeSession",id});assert.equal(todayView(state,all).active,null);
 state=previewReducer(state,{type:"startSession",audience:"tuition",occurrenceId:"english-today"});
 assert.equal(todayView(state,all).active.occurrenceId,null);assert.notEqual(todayView(state,all).active.id,id);
 assert.deepEqual(previewReducer(state,{type:"reset"}),createPreviewState());
});
test("notifications are derived from tasks and can be read without completing tasks",()=>{
 let state=createPreviewState(),items=notifications(state,all);
 assert.equal(items.length,8);assert.ok(items.every(x=>!x.read));
 state=previewReducer(state,{type:"readNotification",id:items[0].id});
 assert.equal(notifications(state,all).filter(x=>x.read).length,1);
 assert.equal(todayView(state,all).submissions.length,5);
 state=previewReducer(state,{type:"markSubmission",id:"submission-1"});
 assert.equal(notifications(state,all).length,7);
});

import {curriculumUnits,suggestedUnits} from "../app/teacher/redesign/teach-data.ts";
test("Teach registry uses three dedicated workspaces, with scoped links and safe invalid context",()=>{
 for(const [href,kind] of [["/teacher/subjecthub","subjects"],["/teacher/curriculum","curriculum"],["/teacher/scheme","scheme"]]){
  assert.equal(toolPanel(href,"Tool").kind,kind);
  const d={tab:"teach",panel:{kind,classId:"class-4",subjectId:"english",unitId:"unit-homophones"}};
  assert.deepEqual(parseDestination(destinationSearch(d)),d);
  assert.equal(openingFor(d.panel),"workspace");
 }
 assert.deepEqual(parseDestination("?tab=teach&panel=curriculum&classId=class-5&subjectId=english&unitId=unit-homophones"),{tab:"teach",panel:null});
});
test("subject assignment changes are isolated, duplicate-safe and preserve linked records",()=>{
 const original=createPreviewState(),scope={classId:"class-5",subjectId:"math"};
 const added=previewReducer(original,{type:"addAssignment",scope});
 assert.equal(added.assignments.length,original.assignments.length+1);
 assert.equal(previewReducer(added,{type:"addAssignment",scope}),added);
 assert.deepEqual(previewReducer(added,{type:"removeAssignment",scope}),original);
 assert.equal(previewReducer(original,{type:"removeAssignment",scope:{classId:"class-4",subjectId:"english"}}),original);
 assert.equal(previewReducer(original,{type:"addAssignment",scope:{classId:"foreign",subjectId:"math"}}),original);
});
test("selected curriculum outcomes become a saved scheme row without inventing a scheduled occurrence",()=>{
 const original=createPreviewState(),scope={classId:"class-4",subjectId:"english"},unit=curriculumUnits.find(x=>x.id==="unit-reading");
 const action={type:"saveSchemeUnit",scope,unitId:unit.id,outcomeIds:[unit.outcomes[0].id],term:3,week:12};
 assert.equal(previewReducer(original,{...action,outcomeIds:[]}),original);
 assert.equal(previewReducer(original,{...action,outcomeIds:["unknown"]}),original);
 assert.equal(previewReducer(original,{...action,scope:{classId:"class-5",subjectId:"english"}}),original);
 assert.equal(previewReducer(original,{...action,week:14}),original);
 const saved=previewReducer(original,action),row=saved.scheme.at(-1);
 assert.equal(row.week,12);assert.equal(row.occurrenceId,null);assert.deepEqual(row.outcomeIds,action.outcomeIds);
 assert.equal(saved.occurrences,original.occurrences);
 assert.equal(previewReducer(saved,action),saved);
 assert.equal(suggestedUnits(saved.scheme,scope,3).some(x=>x.id===unit.id),false);
 assert.equal(suggestedUnits(saved.scheme,scope,2).some(x=>x.id===unit.id),true);
 assert.equal(todayView(saved,all).lessons.length,4);
 const drafted=previewReducer(saved,{type:"schemePlanDraft",id:row.id,text:"Sample introduction"});
 assert.equal(drafted.scheme.at(-1).planDraft,"Sample introduction");
 assert.equal(drafted.occurrences,original.occurrences);
});
test("custom scheme status and reflection are not delivery evidence; dated state is authoritative",()=>{
 let state=createPreviewState();
 const scope={classId:"class-4",subjectId:"english"};
 assert.equal(previewReducer(state,{type:"addSchemeItem",scope,term:3,week:11,topic:" ",strand:""}),state);
 state=previewReducer(state,{type:"addSchemeItem",scope,term:3,week:11,topic:"Sample practice",strand:"Grammar"});
 const id=state.scheme.at(-1).id;
 state=previewReducer(state,{type:"schemeReflection",id,text:"Review examples"});
 state=previewReducer(state,{type:"schemeStatus",id,status:"done"});
 assert.equal(state.scheme.at(-1).status,"done");assert.equal(state.scheme.at(-1).reflection,"Review examples");
 assert.equal(todayView(state,all).next.delivery,"scheduled");
 assert.equal(previewReducer(state,{type:"schemeStatus",id:"scheme-english-today",status:"done"}),state);
 state=previewReducer(state,{type:"draft",id:"english-today",index:0,checked:false});
 state=previewReducer(state,{type:"savePreparation",id:"english-today",index:0});
 assert.equal(todayView(state,all).next.schemeId,"scheme-english-today");
 assert.equal(todayView(state,all).next.preparation[0],"done");
 state=previewReducer(state,{type:"startTeaching",id:"english-today"});
 assert.equal(state.scheme.find(x=>x.id==="scheme-english-today").status,"teaching");
 state=previewReducer(state,{type:"finishTeaching",id:"english-today"});
 assert.equal(state.scheme.find(x=>x.id==="scheme-english-today").status,"done");
});

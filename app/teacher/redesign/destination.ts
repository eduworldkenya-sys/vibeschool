import {createPreviewState,sampleClasses,sampleSubjects} from "./preview-state";
import {curriculumUnits} from "./teach-data";
export type TeachingPanel={kind:"subjects"|"curriculum"|"scheme";classId?:string;subjectId?:string;unitId?:string};
import {teacherTabs,teacherTools,type TeacherTab} from "@/components/teacher/navigation";

export type Panel =
 | TeachingPanel
 | {kind:"stage";index:number;occurrenceId?:string}
 | {kind:"live"|"studio"|"teach";occurrenceId?:string}
 | {kind:"past"|"mark"|"homework-mark"|"attendance"|"settings"|"notifications"|"tools"|"timetable"|"lab"}
 | {kind:"pending";label:string;href:string};
export type Destination={tab:TeacherTab;panel:Panel|null};
export type Opening="sheet"|"workspace"|"immersive";

const tools=Object.values(teacherTools).flat();
const kinds=["live","studio","past","mark","homework-mark","attendance","settings","notifications","teach","tools","timetable","lab","subjects","curriculum","scheme"] as const;
export function toolPanel(href:string,label:string):Panel {
 const index=["","/teacher/lessonplan","/teacher/lesson-notes","/teacher/resources"].indexOf(href);
 if(index>=0)return {kind:"stage",index};
 switch(href){
 case "/teacher/subjecthub":return {kind:"subjects"};
 case "/teacher/curriculum":return {kind:"curriculum"};
 case "/teacher/scheme":return {kind:"scheme"};
 case "/teacher/live-studio":return {kind:"studio"};
 case "/teacher/attendance":return {kind:"attendance"};
 case "/teacher/assessment/marking":return {kind:"mark"};
 case "/teacher/timetable":return {kind:"timetable"};
 case "/teacher/settings":return {kind:"settings"};
 case "/teacher/notifications":return {kind:"notifications"};
 case "/teacher/teach-today":return {kind:"teach"};
 case "/teacher/more":return {kind:"tools"};
 default:return {kind:"pending",href,label};
 }
}
export function openingFor(panel:Panel|null):Opening {
 if(panel?.kind==="live")return "immersive";
 if(panel&&["stage","studio","teach","timetable","mark","homework-mark","attendance","pending","past","lab","subjects","curriculum","scheme"].includes(panel.kind))return "workspace";
 return "sheet";
}
export function parseDestination(search:string):Destination {
 const q=new URLSearchParams(search);
 const tab=teacherTabs.find(t=>t.id===q.get("tab"))?.id??"today";
 const key=q.get("panel");
 const rawId=q.get("occurrence");
 const occurrenceId=createPreviewState().occurrences.find(x=>x.id===rawId)?.id;
 if(rawId!==null&&!occurrenceId)return {tab,panel:null};
 const scoped=occurrenceId?{occurrenceId}:{};
 if(key?.startsWith("stage:")){
  const index=Number(key.slice(6));
  if(Number.isInteger(index)&&index>=0&&index<5&&key==="stage:"+index)return {tab,panel:{kind:"stage",index,...scoped}};
 }
 if(key?.startsWith("tool:")){
  const tool=tools.find(t=>t.href===key.slice(5));
  if(tool)return {tab,panel:toolPanel(tool.href,tool.label)};
 }
 const kind=kinds.find(k=>k===key);
 if(kind==="subjects"||kind==="curriculum"||kind==="scheme"){
  const classId=q.get("classId"),subjectId=q.get("subjectId"),unitId=q.get("unitId");
  if((classId||subjectId)&&(!sampleClasses.some(x=>x.id===classId)||!sampleSubjects.some(x=>x.id===subjectId)))return {tab,panel:null};
  if(unitId&&!curriculumUnits.some(x=>x.id===unitId&&x.classId===classId&&x.subjectId===subjectId))return {tab,panel:null};
  return {tab,panel:{kind,...(classId&&subjectId?{classId,subjectId}:{}),...(unitId?{unitId}:{})}};
 }
 return {tab,panel:kind?(kind==="live"||kind==="teach"||kind==="studio"?{kind,...scoped}:{kind}):null};
}
export function destinationSearch({tab,panel}:Destination):string {
 const q=new URLSearchParams();
 if(tab!=="today")q.set("tab",tab);
 if(panel)q.set("panel",panel.kind==="stage"?"stage:"+panel.index:panel.kind==="pending"?"tool:"+panel.href:panel.kind);
 if(panel&&"occurrenceId" in panel&&panel.occurrenceId)q.set("occurrence",panel.occurrenceId);
 if(panel&&(panel.kind==="subjects"||panel.kind==="curriculum"||panel.kind==="scheme")&&panel.classId&&panel.subjectId){q.set("classId",panel.classId);q.set("subjectId",panel.subjectId);if(panel.unitId)q.set("unitId",panel.unitId)}
 const value=q.toString();return value?"?"+value:"";
}

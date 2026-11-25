// Deterministic, synthetic preview data only. No external services or persistence.
export const previewDate="2026-11-25";
export const previewTime="13:50";
export type Readiness="done"|"pending"|"unknown";
export type StageIndex=0|1|2|3|4;
export type Scope={classId:string;subjectId:string};
export type Occurrence=Scope & {id:string;slotId:string;date:string;start:string;end:string;topic:string;planId:string|null;schemeId:string|null;preparation:Readiness[];notes:string;resourceIds:string[];slideIds:string[];delivery:"scheduled"|"teaching"|"taught";attendance:"pending"|"completed"};
export type Submission=Scope & {id:string;homeworkId:string;learnerId:string;title:string;status:"pending"|"marked"};
export type Session={id:string;audience:string;occurrenceId:string|null;title:string;status:"active"|"paused"|"ended"};
export type PreviewState={occurrences:Occurrence[];submissions:Submission[];sessions:Session[];drafts:Record<string,{checks:Partial<Record<number,boolean>>;notes?:string}>;readNotifications:string[];sequence:number};
export const sampleClasses=[{id:"class-4",label:"Grade 4 · Kilimanjaro"},{id:"class-5",label:"Grade 5 · Aberdare"}];
export const sampleSubjects=[{id:"english",label:"English"},{id:"math",label:"Mathematics"},{id:"science",label:"Science"},{id:"social",label:"Social Studies"}];
export const sampleAssignments=[{classId:"class-4",subjectId:"english"},{classId:"class-4",subjectId:"math"},{classId:"class-4",subjectId:"science"},{classId:"class-5",subjectId:"social"},{classId:"class-5",subjectId:"english"}];
export const sampleLearners=[{id:"learner-1",classId:"class-4",label:"Sample learner A"},{id:"learner-2",classId:"class-4",label:"Sample learner B"},{id:"learner-3",classId:"class-4",label:"Sample learner C"},{id:"learner-4",classId:"class-5",label:"Sample learner D"},{id:"learner-5",classId:"class-4",label:"Sample learner E"}];
export const sampleResources=[{id:"resource-1",subjectId:"english",title:"Sample English reading"},{id:"resource-2",subjectId:"math",title:"Sample place value activity"},{id:"resource-3",subjectId:"science",title:"Sample plant observation"},{id:"resource-4",subjectId:"social",title:"Sample compass activity"}];
export const sampleSlides=[{id:"slide-1",occurrenceId:"english-today",title:"Homophones example"},{id:"slide-2",occurrenceId:"math-today",title:"Place value example"},{id:"slide-3",occurrenceId:"science-today",title:"Plant observation"},{id:"slide-4",occurrenceId:"social-today",title:"Compass directions"},{id:"slide-5",occurrenceId:"english-tomorrow",title:"Sentence examples"}];
export const sampleAssessments=[{id:"assessment-1",classId:"class-4",subjectId:"english",title:"Sample language exercise",max:10}];
export const classLabel=(id:string)=>sampleClasses.find(x=>x.id===id)?.label??"Unknown class";
export const subjectLabel=(id:string)=>sampleSubjects.find(x=>x.id===id)?.label??"Unknown subject";
export const matchesScope=(x:Scope,scope:Scope)=>(scope.classId==="all"||x.classId===scope.classId)&&(scope.subjectId==="all"||x.subjectId===scope.subjectId);
function occurrence(id:string,classId:string,subjectId:string,date:string,start:string,end:string,topic:string,preparation:Readiness[],attendance:Occurrence["attendance"],delivery:Occurrence["delivery"]):Occurrence{
 return {id,slotId:"slot-"+id,date,start,end,classId,subjectId,topic,planId:preparation[1]==="done"?"plan-"+id:null,schemeId:preparation[0]==="done"?"scheme-"+id:null,preparation,notes:preparation[2]==="done"?(id==="english-today"?"Identify homophones in short sentences.":"Review sample examples of "+topic.toLowerCase()+"."):"",resourceIds:preparation[3]==="done"?sampleResources.filter(x=>x.subjectId===subjectId).map(x=>x.id):[],slideIds:preparation[4]==="done"?sampleSlides.filter(x=>x.occurrenceId===id).map(x=>x.id):[],attendance,delivery};
}
export function createPreviewState():PreviewState{
 return {occurrences:[
 occurrence("math-today","class-4","math",previewDate,"08:00","08:35","Place value",["done","done","done","done","unknown"],"pending","taught"),
 occurrence("science-today","class-4","science",previewDate,"09:00","09:35","Plants",["done","done","done","pending","unknown"],"completed","taught"),
 occurrence("social-today","class-5","social",previewDate,"11:00","11:35","Compass directions",["done","done","done","pending","unknown"],"completed","taught"),
 occurrence("english-today","class-4","english",previewDate,"14:00","14:35","Homophones",["done","done","done","pending","pending"],"pending","scheduled"),
 occurrence("english-tomorrow","class-5","english","2026-11-26","08:00","08:35","Writing sentences",["done","pending","pending","pending","unknown"],"pending","scheduled")],
 submissions:sampleLearners.map((l,i)=>({id:"submission-"+(i+1),homeworkId:l.classId==="class-4"?"homework-place-value":"homework-directions",learnerId:l.id,classId:l.classId,subjectId:l.classId==="class-4"?"math":"social",title:l.classId==="class-4"?"Place value":"Compass directions",status:"pending"})),
 sessions:[],drafts:{},readNotifications:[],sequence:0};
}
export function todayView(state:PreviewState,scope:Scope,date=previewDate,now=previewTime){
 const all=state.occurrences.filter(x=>matchesScope(x,scope)).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
 const lessons=all.filter(x=>x.date===date);
 const next=lessons.find(x=>x.delivery==="teaching")??lessons.find(x=>x.delivery==="scheduled"&&x.end>=now)??all.find(x=>x.date>date&&x.delivery==="scheduled")??null;
 const submissions=state.submissions.filter(x=>matchesScope(x,scope)&&x.status==="pending");
 const attendance=lessons.filter(x=>x.attendance==="pending");
 return {lessons,next,submissions,attendance,active:state.sessions.find(x=>x.status!=="ended")??null};
}
export type PreviewAction=
 | {type:"reset"}
 | {type:"draft";id:string;index?:number;checked?:boolean;notes?:string}
 | {type:"savePreparation";id:string;index:number}
 | {type:"recordAttendance";id:string}
 | {type:"markSubmission";id:string}
 | {type:"startTeaching"|"finishTeaching";id:string}
 | {type:"startSession";audience:string;occurrenceId:string|null}
 | {type:"pauseSession"|"resumeSession"|"endSession";id:string}
 | {type:"readNotification";id:string};
export function previewReducer(state:PreviewState,action:PreviewAction):PreviewState{
 if(action.type==="reset")return createPreviewState();
 if(action.type==="draft"){
  if(!state.occurrences.some(x=>x.id===action.id))return state;
  const draft=state.drafts[action.id]??{checks:{}};
  return {...state,drafts:{...state.drafts,[action.id]:{...draft,...(action.notes!==undefined?{notes:action.notes}:{}),checks:{...draft.checks,...(action.index!==undefined&&action.index>=0&&action.index<5&&action.checked!==undefined?{[action.index]:action.checked}:{})}}}};
 }
 if(action.type==="savePreparation"){
  if(!Number.isInteger(action.index)||action.index<0||action.index>4)return state;
  const row=state.occurrences.find(x=>x.id===action.id);if(!row)return state;
  const draft=state.drafts[row.id],checked=draft?.checks[action.index];
  const notes=action.index===2?draft?.notes??row.notes:row.notes;
  if(action.index===2&&checked===true&&!notes.trim())return state;
  const next:Occurrence={...row,notes,preparation:row.preparation.map((v,i)=>i===action.index&&checked!==undefined?(checked?"done":"pending"):v)};
  if(action.index===0&&checked!==undefined)next.schemeId=checked?"scheme-"+row.id:null;
  if(action.index===1&&checked!==undefined)next.planId=checked?"plan-"+row.id:null;
  if(action.index===3&&checked!==undefined)next.resourceIds=checked?sampleResources.filter(x=>x.subjectId===row.subjectId).map(x=>x.id):[];
  if(action.index===4&&checked!==undefined)next.slideIds=checked?sampleSlides.filter(x=>x.occurrenceId===row.id).map(x=>x.id):[];
  const checks={...draft?.checks};delete checks[action.index];
  return {...state,occurrences:state.occurrences.map(x=>x.id===row.id?next:x),drafts:{...state.drafts,[row.id]:{checks,...(action.index!==2&&draft?.notes!==undefined?{notes:draft.notes}:{})}}};
 }
 if(action.type==="recordAttendance")return {...state,occurrences:state.occurrences.map(x=>x.id===action.id?{...x,attendance:"completed"}:x)};
 if(action.type==="markSubmission")return {...state,submissions:state.submissions.map(x=>x.id===action.id?{...x,status:"marked"}:x)};
 if(action.type==="startTeaching"||action.type==="finishTeaching")return {...state,occurrences:state.occurrences.map(x=>x.id===action.id&&(action.type==="startTeaching"?x.delivery==="scheduled"&&x.date===previewDate:x.delivery==="teaching")?{...x,delivery:action.type==="startTeaching"?"teaching":"taught"}:x)};
 if(action.type==="startSession"){
  if(state.sessions.some(x=>x.status!=="ended")||(!sampleClasses.some(x=>x.id===action.audience)&&!["tuition","open"].includes(action.audience)))return state;
  const lesson=state.occurrences.find(x=>x.id===action.occurrenceId&&x.classId===action.audience);
  return {...state,sequence:state.sequence+1,sessions:[{id:"session-"+(state.sequence+1),audience:action.audience,occurrenceId:lesson?.id??null,title:lesson?.topic??"Sample online lesson",status:"active"},...state.sessions]};
 }
 if(action.type==="pauseSession"||action.type==="resumeSession"||action.type==="endSession"){
  return {...state,sessions:state.sessions.map(x=>x.id!==action.id||x.status==="ended"?x:action.type==="pauseSession"&&x.status==="active"?{...x,status:"paused"}:action.type==="resumeSession"&&x.status==="paused"?{...x,status:"active"}:action.type==="endSession"?{...x,status:"ended"}:x)};
 }
 if(action.type==="readNotification")return {...state,readNotifications:[...new Set([...state.readNotifications,action.id])]};
 return state;
}
export function notifications(state:PreviewState,scope:Scope){
 const view=todayView(state,scope);
 return [...view.submissions.map(x=>({id:"mark:"+x.id,label:"Mark "+x.title,kind:"mark" as const})),...view.attendance.map(x=>({id:"attendance:"+x.id,label:"Attendance · "+subjectLabel(x.subjectId),kind:"attendance" as const})),...(view.next&&view.next.preparation.some(x=>x!=="done")?[{id:"prep:"+view.next.id,label:"Prepare "+view.next.topic,kind:"teach" as const}]:[])].map(x=>({...x,read:state.readNotifications.includes(x.id)}));
}

"use client";
import {useEffect,useState} from "react";
import {BookOpen,CheckCircle2,ChevronRight,ClipboardCheck,ClipboardList,History,Layers,Library,NotebookPen,Presentation,SlidersHorizontal,LayoutGrid,Search,CheckCheck} from "lucide-react";
import {teacherTools} from "./navigation";
import type {PulseSnapshot,Slot,PriorityTask} from "@/lib/types";
import {nairobiDateStr} from "@/lib/time";
import {supabase} from "@/lib/supabase";
import {evaluateLessonReadiness} from "@/lib/teaching/lessonReadiness";
import {parseLessonPlanBody} from "@/lib/teaching/lessonPlanCodec";
import styles from "./TeacherTodayV09.module.css";

const registry=Object.values(teacherTools).flat().filter(t=>!["/teacher/pulse","/teacher/more"].includes(t.href));
const defaults=["/teacher/lessonplan","/teacher/lesson-notes","/teacher/scheme","/teacher/timetable","/teacher/live-studio","/teacher/resources","/teacher/attendance","/teacher/homework","/teacher/assessment","/teacher/assessment/marking","/teacher/students"];
const labels:Record<string,string>={"/teacher/lessonplan":"Plan","/teacher/lesson-notes":"Notes","/teacher/scheme":"Scheme","/teacher/live-studio":"Studio","/teacher/resources":"Library","/teacher/assessment":"Assess","/teacher/assessment/marking":"Marking","/teacher/students":"Learners"};
type Status="done"|"pending"|"unknown";
type Preparation={key:string;scheme:Status;plan:Status;notes:Status;resources:Status};
function cleanPins(value:unknown):string[]{return Array.isArray(value)?Array.from(new Set(value.filter((v):v is string=>typeof v==="string"&&registry.some(t=>t.href===v)))).slice(0,11):defaults.filter(v=>registry.some(t=>t.href===v))}
function clock(value:string){return value.slice(0,5)}
export default function TeacherTodayV09({snap,slot,focusClassId,focusSubjectId,name,offline,refreshing,tasks,onNavigate}:{snap:PulseSnapshot;slot?:Slot;focusClassId:string;focusSubjectId:string;name:string;offline:boolean;refreshing:boolean;tasks:PriorityTask[];onNavigate:(href:string)=>void}){
 const [prefs,setPrefs]=useState<{key:string;pins:string[]}|null>(null);
 const [editing,setEditing]=useState(false),[search,setSearch]=useState("");
 const [audienceChoice,setAudienceChoice]=useState("");
 const [prep,setPrep]=useState<Preparation|null>(null);
 const [active,setActive]=useState<{key:string;id:string;title:string}|null>(null);
 const prefKey="vibeschool.teacher.dashboard.tools.v09."+snap.userId;
 const pins=prefs?.key===prefKey?prefs.pins:cleanPins(defaults);
 useEffect(()=>{try{const raw=localStorage.getItem(prefKey);setPrefs({key:prefKey,pins:cleanPins(raw?JSON.parse(raw):defaults)})}catch{setPrefs({key:prefKey,pins:cleanPins(defaults)})}},[prefKey]);
 function savePins(next:string[]){const valid=cleanPins(next);setPrefs({key:prefKey,pins:valid});try{localStorage.setItem(prefKey,JSON.stringify(valid))}catch{/* usable in memory */}}
 const context=new URLSearchParams({classId:slot?.class_id||focusClassId,subjectId:slot?.subject_id||focusSubjectId});
 const occurrence=new URLSearchParams(context);
 if(slot){occurrence.set("timetableSlotId",slot.id);occurrence.set("date",slot.teaching_workspace?.key.occurrenceDate??nairobiDateStr())}
 const planId=slot?.teaching_workspace?.lessonPlanId??null;
 const prepKey=[snap.userId,snap.schoolId,slot?.id,slot?.teaching_workspace?.key.occurrenceDate,planId].join(":");
 const notesQuery=new URLSearchParams(context);
 if(planId)notesQuery.set("lessonPlanId",planId);
 if(slot?.teaching_workspace?.occurrenceId)notesQuery.set("occurrenceId",slot.teaching_workspace.occurrenceId);
 const planHref="/teacher/lessonplan?"+occurrence;
 const notesHref="/teacher/lesson-notes?"+notesQuery;
 const liveEnabled=process.env.NEXT_PUBLIC_VIBE_LIVE_ENABLED==="true";
 const classes=Array.from(new Map(snap.myClasses.map(c=>[c.class_id,c])).values());
 const audience=audienceChoice==="tuition"||audienceChoice==="open"||classes.some(c=>c.class_id===audienceChoice)?audienceChoice:classes.some(c=>c.class_id===focusClassId)?focusClassId:"tuition";
 const schoolLive=audience!=="tuition"&&audience!=="open";
 const liveBase=schoolLive?"/teacher/classhub/"+encodeURIComponent(audience)+"/live":"/teacher/tutoring/live";
 const liveParams=new URLSearchParams();if(!schoolLive)liveParams.set("mode",audience);
 if(schoolLive&&planId&&slot?.class_id===audience)liveParams.set("lessonPlanId",planId);
 const liveKey=[snap.userId,snap.schoolId,audience].join(":");
 const current=active?.key===liveKey&&!offline?active:null;
 function liveHref(extra?:Record<string,string>){const q=new URLSearchParams(liveParams);Object.entries(extra??{}).forEach(([k,v])=>q.set(k,v));return liveBase+(q.size?"?"+q:"")}
 useEffect(()=>{
  let cancelled=false;setActive(null);
  if(!liveEnabled||offline)return;
  const load=async()=>{try{const {data,error}=await supabase.rpc("vibe_live_command",{p_action:"list",p_class_id:schoolLive?audience:null,p_session_id:null,p_version:null,p_payload:{host:true}});
   if(error||!Array.isArray(data))return;
   const room=data.find((v)=>v&&v.own===true&&v.mode===(schoolLive?"school":audience)&&["active","paused"].includes(v.status)&&typeof v.id==="string"&&typeof v.title==="string");
   if(!cancelled)setActive(room?{key:liveKey,id:room.id,title:room.title}:null);
  }catch{if(!cancelled)setActive(null)}};
  void load();window.addEventListener("focus",load);
  return()=>{cancelled=true;window.removeEventListener("focus",load)}
 },[liveEnabled,offline,schoolLive,audience,liveKey,snap]);
 useEffect(()=>{
  let cancelled=false;setPrep(null);
  if(!slot||offline||!planId)return;
  const load=async()=>{try{
   const {data:row,error}=await supabase.from("lesson_plans").select("id,body,scheme_id").eq("id",planId).eq("teacher_id",snap.userId).eq("class_id",slot.class_id).eq("subject_id",slot.subject_id).maybeSingle();
   if(error||!row||cancelled)return;
   const body=String(row.body??"");const readiness=evaluateLessonReadiness(body);const parsed=parseLessonPlanBody(body);
   const schemePromise=row.scheme_id?supabase.from("scheme_of_work").select("id").eq("id",row.scheme_id).eq("teacher_id",snap.userId).eq("class_id",slot.class_id).eq("subject_id",slot.subject_id).maybeSingle():Promise.resolve({data:null,error:null});
   const [scheme,resources]=await Promise.all([schemePromise,supabase.rpc("list_teaching_resources",{p_target_type:"lesson_plan",p_target_id:planId})]);
   const payload=resources.data as {ok?:boolean;resources?:Array<{link_id?:string;resource_id?:string}>}|null;
   if(!cancelled)setPrep({key:prepKey,scheme:scheme.error?"unknown":scheme.data?"done":"pending",plan:readiness.ready?"done":"pending",notes:parsed&&!readiness.reasons.some(reason=>reason.startsWith("Teacher notes need"))?"done":"pending",resources:resources.error||!payload?.ok||!Array.isArray(payload.resources)?"unknown":payload.resources.some(item=>item.link_id&&item.resource_id)?"done":"pending"});
  }catch{/* leave unverified rather than show false readiness */}};
  void load();return()=>{cancelled=true}
 },[prepKey,planId,slot,offline,snap]);
 const verified=prep?.key===prepKey&&!offline?prep:null;
 const missing:Status=slot?.teaching_workspace&&!planId&&!offline?"pending":"unknown";
 const stages=[
  {label:"Scheme",Icon:Layers,status:verified?.scheme??"unknown",href:"/teacher/scheme?"+context},
  {label:"Plan",Icon:ClipboardList,status:verified?.plan??missing,href:planHref},
  {label:"Notes",Icon:NotebookPen,status:verified?.notes??missing,href:notesHref},
  {label:"Resources",Icon:Library,status:verified?.resources??missing,href:"/teacher/resources?"+context},
  {label:"Slides",Icon:Presentation,status:"unknown" as Status,href:liveEnabled?liveHref({studio:"1"}):"/teacher/lessonplan?"+occurrence},
 ] as const;
 const complete=stages.filter(s=>s.status==="done").length;
 const attendance=snap.todaySlots.filter(s=>s.attendance_status!=="completed");
 const toMark=snap.homeworkUngraded.reduce((n,h)=>n+h.count,0);
 const firstHomework=snap.homeworkUngraded[0];
 const markingHref=firstHomework?"/teacher/classhub/"+encodeURIComponent(firstHomework.class_id)+"/homework/"+encodeURIComponent(firstHomework.homework_id):"/teacher/homework";
 const a=attendance[0];
 const attendanceHref=a?"/teacher/attendance?"+new URLSearchParams({mode:"lesson",classId:a.class_id,subjectId:a.subject_id,timetableSlotId:a.id,date:a.teaching_workspace?.key.occurrenceDate??nairobiDateStr()}):"/teacher/attendance";
 function toolHref(href:string){
  if(href==="/teacher/lessonplan")return planHref;
  if(href==="/teacher/lesson-notes")return notesHref;
  if(href==="/teacher/live-studio")return liveHref({studio:"1"});
  if(href==="/teacher/attendance")return attendanceHref;
  if(href==="/teacher/assessment/marking"&&firstHomework)return markingHref;
  if(["/teacher/scheme","/teacher/resources","/teacher/teacher-guide","/teacher/progress","/teacher/vibelearn"].includes(href))return href+"?"+context;
  return href;
 }
 const firstIncomplete=stages.find(s=>s.status==="pending")??stages.find(s=>s.status==="unknown"&&s.label!=="Slides");
 const nextAction=slot?.teaching_workspace?.primaryAction;
 const primaryLabel=nextAction==="continue_lesson"?"Resume teaching":nextAction==="review_lesson"?"Review lesson":nextAction==="record_progress"?"Record progress":nextAction==="none"?"View lesson":"Teach now";
 const nextTasks=tasks.filter(t=>!slot||!t.href.includes("timetableSlotId="+encodeURIComponent(slot.id))).slice(0,3);
 return <div className={styles.dashboard}>
  <section className={styles.hero} aria-label="Next lesson">
   <div className={styles.greeting}><strong>{name?"Hello, "+name:"Teacher Today"}</strong><small>{offline?"Offline · cached":refreshing?"Updating…":new Intl.DateTimeFormat("en-KE",{weekday:"short",day:"numeric",month:"short",timeZone:"Africa/Nairobi"}).format(new Date())}</small></div>
   {slot?<div className={styles.lesson}><div className={styles.lessonLine}><span>Next lesson</span><strong title={slot.subject}>{slot.subject}</strong><time>{clock(slot.start_time)}</time></div><small>{slot.class_name}</small>
   <div className={styles.prepLine}><span>Preparation</span><small>{complete}/5 verified · {5-complete} remaining</small></div>
   <div className={styles.stages}>{stages.map(s=><button type="button" key={s.label} data-status={s.status} title={s.status==="unknown"?s.label==="Slides"?"No verified lesson-linked deck":"Status not verified":s.status==="done"?"Verified":"Needs preparation"} aria-label={s.label+": "+s.status} onClick={()=>onNavigate(s.href)}>{s.status==="done"?<CheckCircle2 size={18}/>:<s.Icon size={18}/>}<span>{s.label}</span></button>)}</div>
   <div className={styles.lessonActions}><button type="button" onClick={()=>onNavigate(firstIncomplete?.href??planHref)}> {complete===5?"View preparation":"Continue preparation"}</button><button type="button" onClick={()=>onNavigate(planHref)}>{primaryLabel} ↗</button></div>
   </div>:<div className={styles.lesson}><strong>No lesson scheduled in this context</strong><div className={styles.lessonActions}><button onClick={()=>onNavigate(planHref)}>Prepare lesson</button><button onClick={()=>onNavigate("/teacher/timetable")}>Timetable</button></div></div>}
  </section>
  {liveEnabled&&<section className={styles.live} aria-label="VibeSchool Live"><div className={styles.liveRow}><Presentation size={30} aria-hidden="true"/><div><strong>VibeSchool Live</strong><small>{current?current.title:"Online classroom"}</small></div><button type="button" onClick={()=>onNavigate(current?liveHref({resumeRoom:current.id}):liveHref())}>{current?"Resume":"Go Live"}</button></div><div className={styles.liveControls}><select aria-label="Choose live audience" value={audience} onChange={e=>setAudienceChoice(e.target.value)}>{classes.map(c=><option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}<option value="tuition">Invited learners</option><option value="open">Public class</option></select><button type="button" onClick={()=>onNavigate(liveHref({studio:"1"}))}><Presentation size={16}/> Studio</button><button type="button" onClick={()=>onNavigate(liveHref({past:"1"}))}><History size={16}/> Past classes</button></div></section>}
  <section className={styles.counts} aria-label="Today's recorded evidence">{[[snap.todaySlots.length,"Lessons","/teacher/timetable"],[toMark,"To mark",markingHref],[attendance.length,"Attendance",attendanceHref]].map(([n,label,href])=><button key={label} type="button" onClick={()=>onNavigate(String(href))}><strong>{n}</strong><span>{label}</span></button>)}</section>
  <section aria-label="Your workspace"><div className={styles.sectionHead}><h2>Your workspace</h2><button type="button" aria-expanded={editing} onClick={()=>setEditing(v=>!v)}><SlidersHorizontal size={18}/>{editing?"Done":"Edit"}</button></div>
  {editing?<div className={styles.filter}><label><Search size={16}/><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find tools" aria-label="Find tools"/></label><small>{pins.length}/11 shortcuts · saved on this device</small><div className={styles.choices}>{registry.filter(t=>t.label.toLowerCase().includes(search.toLowerCase())).map(t=><label key={t.href}><input type="checkbox" checked={pins.includes(t.href)} disabled={!pins.includes(t.href)&&pins.length>=11} onChange={e=>savePins(e.target.checked?[...pins,t.href]:pins.filter(p=>p!==t.href))}/>{t.label}</label>)}</div><button type="button" onClick={()=>savePins(defaults)}>Reset shortcuts</button></div>:<div className={styles.tools}>{pins.map(href=>{const t=registry.find(t=>t.href===href);if(!t)return null;const Icon=t.icon;return <button key={href} type="button" onClick={()=>onNavigate(toolHref(href))}><span><Icon size={21}/></span><small>{labels[href]??t.label}</small></button>})}<button type="button" onClick={()=>onNavigate("/teacher/more")}><span><LayoutGrid size={21}/></span><small>All tools</small></button></div>}
  </section>
  <section aria-label="Action centre"><div className={styles.sectionHead}><h2>Action centre</h2></div><div className={styles.queue}>{firstHomework&&<button type="button" onClick={()=>onNavigate(markingHref)}><CheckCheck size={18}/><span>Mark {toMark} submission{toMark===1?"":"s"}<small>{firstHomework.title}</small></span><ChevronRight size={17}/></button>}{a&&<button type="button" onClick={()=>onNavigate(attendanceHref)}><ClipboardCheck size={18}/><span>Record attendance<small>{a.class_name} · {a.subject}</small></span><ChevronRight size={17}/></button>}{nextTasks.filter(t=>t.href!==markingHref&&t.href!==attendanceHref).map(t=><button key={t.id} type="button" onClick={()=>onNavigate(t.href)}><BookOpen size={18}/><span>{t.label}<small>{t.detail}</small></span><ChevronRight size={17}/></button>)}{!firstHomework&&!a&&!nextTasks.length&&<p>No pending actions in the current snapshot.</p>}</div></section>
 </div>
}

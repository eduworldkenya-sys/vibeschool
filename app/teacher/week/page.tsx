"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { C } from "@/components/teacher/ui";
import { loadTeacherWorkspaceWeek, type TeacherWorkspaceWeek, type TeacherWorkspaceOccurrence } from "@/lib/teacher/workspace";
import { nairobiDateStr } from "@/lib/time";

const DAY = ["","Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function lessonState(o: TeacherWorkspaceOccurrence) {
  const t=o.teaching;
  if(!t) return {label:"Not prepared",tone:"#92400e",bg:"#fef3c7",next:"Prepare lesson"};
  if(t.lifecycle==="completed") return {label:"Completed",tone:"#065f46",bg:"#d1fae5",next:"Review"};
  if(t.lifecycle==="in_progress") return {label:"In progress",tone:"#1d4ed8",bg:"#dbeafe",next:"Continue teaching"};
  if(t.lifecycle==="missed") return {label:"Needs recovery",tone:"#991b1b",bg:"#fee2e2",next:"Recover lesson"};
  if(!t.lessonPlanId) return {label:"Plan needed",tone:"#92400e",bg:"#fef3c7",next:"Prepare lesson"};
  if(t.attendance.state!=="complete" && o.occurrenceDate<nairobiDateStr()) return {label:"Attendance unfinished",tone:"#991b1b",bg:"#fee2e2",next:"Close lesson"};
  if(!t.reflection.completed && o.occurrenceDate<nairobiDateStr()) return {label:"Reflection due",tone:"#92400e",bg:"#fef3c7",next:"Close lesson"};
  return {label:"Ready",tone:"#065f46",bg:"#d1fae5",next:"Open lesson"};
}

function hrefFor(o:TeacherWorkspaceOccurrence){
  const q=new URLSearchParams({classId:o.assignment.classId,subjectId:o.assignment.subjectId,timetableSlotId:o.timetableSlotId,occurrenceDate:o.occurrenceDate});
  return "/teacher/lessonplan?"+q.toString();
}

export default function TeacherWeekViewPage(){
 const router=useRouter();
 const [offset,setOffset]=useState(0);
 const [week,setWeek]=useState<TeacherWorkspaceWeek|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");

 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const {data:{user}}=await supabase.auth.getUser();
   if(!user){router.replace("/?role=teacher");return}
   // Resolve the same canonical school context used by onboarding before building
   // the occurrence-driven week. The workspace loader independently enforces it.
   const {data:schoolContext,error:schoolContextError}=await supabase.rpc("get_my_teacher_school_context");
   if(schoolContextError)throw schoolContextError;
   if(!(schoolContext as {active_school_id?:string|null}|null)?.active_school_id){setWeek(null);return}
   const value=await loadTeacherWorkspaceWeek({teacherId:user.id,weekOffset:offset});
   setWeek(value);
  }catch(e){setError(e instanceof Error?e.message:"Your teaching week could not be loaded.")}
  finally{setLoading(false)}
 },[offset,router]);

 useEffect(()=>{void load()},[load]);

 const today=nairobiDateStr();
 const ordered=useMemo(()=>[...(week?.occurrences??[])].sort((a,b)=>(a.occurrenceDate+a.startTime).localeCompare(b.occurrenceDate+b.startTime)),[week]);
 const attention=ordered.filter(o=>{const s=lessonState(o);return ["Plan needed","Attendance unfinished","Reflection due","Needs recovery","Not prepared"].includes(s.label)});
 const completed=ordered.filter(o=>o.teaching?.lifecycle==="completed").length;

 if(loading)return <main style={{padding:16,color:C.textMuted}}>Building your teaching week…</main>;
 if(error)return <main style={{padding:16}}><div style={{padding:14,borderRadius:12,background:"#fef2f2",color:"#991b1b"}}>{error}</div><button onClick={()=>void load()} style={secondary}>Retry</button></main>;
 if(!week)return <main style={{padding:16}}><section style={card}><h1 style={{fontSize:20}}>Connect your school</h1><p style={muted}>Your week is generated from your active school, teaching assignments and timetable.</p><button style={primary} onClick={()=>router.push("/teacher/onboarding/school")}>Connect school</button></section></main>;

 return <main style={{minHeight:"100vh",background:C.surface,paddingBottom:96}}>
  <header style={{padding:"18px 16px",background:"#fff",borderBottom:`1px solid ${C.border}`}}>
   <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
    <button aria-label="Previous week" onClick={()=>setOffset(v=>v-1)} style={nav}>‹</button>
    <div style={{textAlign:"center"}}><div style={{fontSize:21,fontWeight:900,color:C.textPrimary}}>My Week</div><div style={muted}>{week.weekNumber?`Week ${week.weekNumber}`:"School week"} · {week.weekStart} – {week.weekEnd}</div></div>
    <button aria-label="Next week" onClick={()=>setOffset(v=>v+1)} style={nav}>›</button>
   </div>
   {offset!==0&&<button onClick={()=>setOffset(0)} style={{...secondary,display:"block",margin:"10px auto 0"}}>This week</button>}
  </header>

  <section style={{padding:"12px 16px 0",display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8}}>
   <div style={metric}><b>{ordered.length}</b><span>Lessons</span></div>
   <div style={metric}><b>{completed}</b><span>Completed</span></div>
   <div style={metric}><b>{attention.length}</b><span>Need attention</span></div>
  </section>

  {attention.length>0&&<section style={{padding:"14px 16px 0"}}>
   <div style={label}>NEEDS ATTENTION</div>
   <div style={{display:"grid",gap:8}}>{attention.slice(0,4).map(o=>{const s=lessonState(o);return <button key={o.timetableSlotId+o.occurrenceDate} onClick={()=>router.push(hrefFor(o))} style={attentionRow}><span><b>{o.assignment.subjectName} · {o.assignment.className}{o.assignment.stream?` ${o.assignment.stream}`:""}</b><small>{DAY[o.dayOfWeek]} {o.startTime.slice(0,5)} · {s.label}</small></span><strong>{s.next} ›</strong></button>})}</div>
  </section>}

  <section style={{padding:"16px"}}>
   <div style={label}>TEACHING PLAN</div>
   {ordered.length===0?<div style={card}><b>No scheduled lessons this week.</b><p style={muted}>Your week follows the authoritative timetable. Add or correct timetable slots instead of creating duplicate weekly tasks.</p><button style={secondary} onClick={()=>router.push("/teacher/timetable")}>Open timetable</button></div>:
   <div style={{display:"grid",gap:10}}>{ordered.map(o=>{const s=lessonState(o);const isToday=o.occurrenceDate===today;return <article key={o.timetableSlotId+o.occurrenceDate} style={{...card,border:isToday?"1.5px solid #10b981":`1px solid ${C.border}`}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start"}}><div><div style={{fontSize:11,fontWeight:900,color:isToday?"#047857":C.textMuted}}>{isToday?"TODAY":DAY[o.dayOfWeek].toUpperCase()} · {o.startTime.slice(0,5)}–{o.endTime.slice(0,5)}</div><h2 style={{fontSize:16,margin:"4px 0 2px",color:C.textPrimary}}>{o.assignment.subjectName}</h2><div style={muted}>{o.assignment.className}{o.assignment.stream?` ${o.assignment.stream}`:""}</div></div><span style={{fontSize:10,fontWeight:800,padding:"5px 8px",borderRadius:999,color:s.tone,background:s.bg}}>{s.label}</span></div>
    {o.teaching&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}><span style={chip}>{o.teaching.lessonPlanId?"Plan ✓":"Plan —"}</span><span style={chip}>Attendance {o.teaching.attendance.state==="complete"?"✓":"—"}</span><span style={chip}>Evidence {o.teaching.evidence.count||"—"}</span><span style={chip}>Homework {o.teaching.homework.issued?"✓":"—"}</span><span style={chip}>Reflection {o.teaching.reflection.completed?"✓":"—"}</span></div>}
    <button onClick={()=>router.push(hrefFor(o))} style={{...primary,width:"100%",marginTop:12}}>{s.next} →</button>
   </article>})}</div>}
  </section>
 </main>
}
const card:React.CSSProperties={background:"#fff",border:"1px solid #e5e7eb",borderRadius:16,padding:14,boxShadow:"0 1px 3px rgba(15,23,42,.05)"};
const muted:React.CSSProperties={fontSize:12,color:C.textMuted,margin:"4px 0",lineHeight:1.45};
const label:React.CSSProperties={fontSize:10,fontWeight:900,letterSpacing:1.2,color:C.textMuted,marginBottom:8};
const primary:React.CSSProperties={border:0,borderRadius:10,padding:"10px 14px",background:C.accent,color:"#fff",fontWeight:800,fontFamily:"inherit",cursor:"pointer"};
const secondary:React.CSSProperties={border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 12px",background:"#fff",color:C.textPrimary,fontWeight:800,fontFamily:"inherit",cursor:"pointer",marginTop:8};
const nav:React.CSSProperties={width:40,height:40,borderRadius:12,border:`1px solid ${C.border}`,background:"#fff",fontSize:24,cursor:"pointer"};
const metric:React.CSSProperties={background:"#fff",border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 8px",display:"grid",gap:2,textAlign:"center",color:C.textPrimary};
const chip:React.CSSProperties={fontSize:10,padding:"4px 7px",borderRadius:999,background:"#f1f5f9",color:"#475569",fontWeight:700};
const attentionRow:React.CSSProperties={width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,textAlign:"left",padding:12,borderRadius:12,border:"1px solid #fde68a",background:"#fffbeb",fontFamily:"inherit",cursor:"pointer"};

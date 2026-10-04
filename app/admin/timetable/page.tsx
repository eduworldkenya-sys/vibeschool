"use client";
import { useEffect,useMemo,useState } from "react";
import { supabase } from "@/lib/supabase";
import { getAdminSchoolAuthority } from "@/lib/admin/authority";
import { createTimetableRelease, updateTimetableReleaseStatus, suggestSchoolTimetableCandidates, type SuggestedPlacement } from "@/lib/timetable/operations";
import { nairobiDateAdd, nairobiDateStr } from "@/lib/time";

type Row={id:string;name:string}; type C={id:string;name:string;stream:string|null}; type T={id:string;full_name:string};
type Slot={id:string;teacher_id:string;class_id:string;subject_id:string;day_of_week:number;start_time:string;end_time:string;room:string|null;allocation_units:number};
type Period={id:string;schedule_day:number;period_number:number;label:string;start_time:string;end_time:string;kind:string;protected:boolean};
type ClassPreference={school_id:string;class_id:string;lesson_minutes:number;preferred_day_part:"morning"|"afternoon"|null};
type CalendarException={id:string;exception_date:string;kind:"holiday"|"closure"|"exam"|"event";label:string;suppress_ordinary_teaching:boolean};
type Occurrence={id:string;timetable_slot_id:string;occurrence_date:string;teacher_id:string;actual_teacher_id:string|null;class_id:string;subject_id:string;lifecycle:string;exception_reason:string|null};
const D=["","Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

export default function AdminTimetablePage(){
 const [sid,setSid]=useState(""); const [slots,setSlots]=useState<Slot[]>([]); const [classes,setClasses]=useState<C[]>([]); const [subjects,setSubjects]=useState<Row[]>([]); const [teachers,setTeachers]=useState<T[]>([]); const [periods,setPeriods]=useState<Period[]>([]);
 const [preferences,setPreferences]=useState<ClassPreference[]>([]); const [exceptions,setExceptions]=useState<CalendarException[]>([]); const [occurrences,setOccurrences]=useState<Occurrence[]>([]);
 const [block,setBlock]=useState({scheduleDay:0,periodNumber:1,label:"Period 1",startTime:"08:00",endTime:"08:40",kind:"lesson"});
 const [classPreference,setClassPreference]=useState({classId:"",lessonMinutes:40,preferredDayPart:"" as ""|"morning"|"afternoon"});
 const [exceptionDraft,setExceptionDraft]=useState({date:nairobiDateStr(),kind:"event" as "holiday"|"closure"|"exam"|"event",label:"",suppress:true});
 const [substitute,setSubstitute]=useState({occurrenceId:"",teacherId:"",reason:""});
 const [pick,setPick]=useState({classId:"",subjectId:"",teacherId:""}); const [suggestions,setSuggestions]=useState<SuggestedPlacement[]>([]); const [msg,setMsg]=useState(""); const [busy,setBusy]=useState(false);
 useEffect(()=>{void load()},[]);
 async function load(){setBusy(true);try{const a=await getAdminSchoolAuthority();setSid(a.schoolId);const today=nairobiDateStr();const horizon=nairobiDateAdd(today,30);
  const [s,c,u,m,sp,cp,ex,oc]=await Promise.all([
   supabase.from("timetable_slots").select("id,teacher_id,class_id,subject_id,day_of_week,start_time,end_time,room,allocation_units").eq("school_id",a.schoolId).lte("effective_from",today).or(`effective_until.is.null,effective_until.gte.${today}`),
   supabase.from("classes").select("id,name,stream").eq("school_id",a.schoolId),
   supabase.from("subjects").select("id,name").eq("school_id",a.schoolId),
   supabase.from("school_members").select("profile_id").eq("school_id",a.schoolId).eq("role","teacher"),
   supabase.from("school_periods").select("id,schedule_day,period_number,label,start_time,end_time,kind,protected").eq("school_id",a.schoolId).order("schedule_day").order("start_time"),
   supabase.from("class_timetable_preferences").select("school_id,class_id,lesson_minutes,preferred_day_part").eq("school_id",a.schoolId),
   supabase.from("school_calendar_exceptions").select("id,exception_date,kind,label,suppress_ordinary_teaching").eq("school_id",a.schoolId).gte("exception_date",today).lte("exception_date",horizon).order("exception_date"),
   supabase.from("teaching_occurrences").select("id,timetable_slot_id,occurrence_date,teacher_id,actual_teacher_id,class_id,subject_id,lifecycle,exception_reason").eq("school_id",a.schoolId).gte("occurrence_date",today).lte("occurrence_date",horizon).in("lifecycle",["planned","ready"]).order("occurrence_date")
  ]); if(s.error||c.error||u.error||m.error||sp.error||cp.error||ex.error||oc.error) throw s.error||c.error||u.error||m.error||sp.error||cp.error||ex.error||oc.error;
  const ids=(m.data??[]).map(x=>x.profile_id); const p=ids.length?await supabase.from("profiles").select("id,full_name").in("id",ids):{data:[],error:null};
  if(p.error)throw p.error; setSlots((s.data??[]) as Slot[]);setClasses((c.data??[]) as C[]);setSubjects((u.data??[]) as Row[]);setTeachers((p.data??[]) as T[]);setPeriods((sp.data??[]) as Period[]);setPreferences((cp.data??[]) as ClassPreference[]);setExceptions((ex.data??[]) as CalendarException[]);setOccurrences((oc.data??[]) as Occurrence[]);
 }catch(e){setMsg(e instanceof Error?e.message:"Could not load timetable")}finally{setBusy(false)}}
 async function suggest(){if(!pick.classId||!pick.subjectId||!pick.teacherId)return;setBusy(true);try{setSuggestions(await suggestSchoolTimetableCandidates({schoolId:sid,...pick}));setMsg("")}catch(e){setMsg(e instanceof Error?e.message:"Could not suggest slots")}finally{setBusy(false)}}
 async function add(x:SuggestedPlacement){setBusy(true);try{const {error}=await supabase.rpc("create_school_timetable_slot",{p_school_id:sid,p_teacher_id:pick.teacherId,p_class_id:pick.classId,p_subject_id:pick.subjectId,p_day_of_week:x.day_of_week,p_start_time:x.start_time,p_end_time:x.end_time,p_room:null,p_effective_from:new Date().toISOString().slice(0,10),p_effective_until:null,p_allocation_units:1,p_period_id:x.period_id});if(error)throw error;setSuggestions([]);await load();setMsg("Lesson added.")}catch(e){setMsg(e instanceof Error?e.message:"Could not add lesson")}finally{setBusy(false)}}
 async function addSchoolBlock(){
  if(!sid||!block.label.trim()||block.startTime>=block.endTime)return;
  setBusy(true);try{
   const {error}=await supabase.from("school_periods").insert({
    school_id:sid,schedule_day:block.scheduleDay,period_number:block.periodNumber,
    label:block.label.trim(),start_time:block.startTime,end_time:block.endTime,
    kind:block.kind,protected:block.kind!=="lesson"
   }); if(error)throw error; await load(); setMsg("School-day block added.");
  }catch(e){setMsg(e instanceof Error?e.message:"Could not add school-day block")}finally{setBusy(false)}
 }
 async function removeSchoolBlock(id:string){
  setBusy(true);try{const {error}=await supabase.from("school_periods").delete().eq("id",id).eq("school_id",sid);if(error)throw error;await load();setMsg("School-day block removed.");}catch(e){setMsg(e instanceof Error?e.message:"Could not remove block")}finally{setBusy(false)}
 }
 async function saveClassPreference(){
  if(!sid||!classPreference.classId||classPreference.lessonMinutes<20||classPreference.lessonMinutes>120)return;
  setBusy(true);try{const {error}=await supabase.from("class_timetable_preferences").upsert({
   school_id:sid,class_id:classPreference.classId,lesson_minutes:classPreference.lessonMinutes,
   preferred_day_part:classPreference.preferredDayPart||null
  },{onConflict:"school_id,class_id"});if(error)throw error;await load();setMsg("Class duration guidance saved. Bell periods remain the actual timetable authority.");}catch(e){setMsg(e instanceof Error?e.message:"Could not save class guidance")}finally{setBusy(false)}
 }
 async function addException(){
  if(!sid||!exceptionDraft.date||!exceptionDraft.label.trim())return;
  setBusy(true);try{const {error}=await supabase.from("school_calendar_exceptions").insert({
   school_id:sid,exception_date:exceptionDraft.date,kind:exceptionDraft.kind,label:exceptionDraft.label.trim(),suppress_ordinary_teaching:exceptionDraft.suppress
  });if(error)throw error;setExceptionDraft({...exceptionDraft,label:""});await load();setMsg("School exception added.");}catch(e){setMsg(e instanceof Error?e.message:"Could not add exception")}finally{setBusy(false)}
 }
 async function removeException(id:string){
  setBusy(true);try{const {error}=await supabase.from("school_calendar_exceptions").delete().eq("id",id).eq("school_id",sid);if(error)throw error;await load();setMsg("School exception removed.");}catch(e){setMsg(e instanceof Error?e.message:"Could not remove exception")}finally{setBusy(false)}
 }
 async function assignSubstitute(){
  if(!substitute.occurrenceId||!substitute.teacherId)return;
  setBusy(true);try{const {error}=await supabase.rpc("assign_occurrence_substitute",{p_occurrence_id:substitute.occurrenceId,p_substitute_teacher_id:substitute.teacherId,p_reason:substitute.reason.trim()||null});if(error)throw error;setSubstitute({occurrenceId:"",teacherId:"",reason:""});await load();setMsg("Substitute assigned to the exact lesson occurrence.");}catch(e){setMsg(e instanceof Error?e.message:"Could not assign substitute")}finally{setBusy(false)}
 }
 async function startRelease(){setBusy(true);try{const label=`Timetable ${new Date().toLocaleDateString()}`;const r=await createTimetableRelease({schoolId:sid,label,effectiveFrom:nairobiDateStr()});await updateTimetableReleaseStatus(r.id,"review");setMsg("Draft created and submitted for review.")}catch(e){setMsg(e instanceof Error?e.message:"Could not create release")}finally{setBusy(false)}}
 const cm=useMemo(()=>new Map(classes.map(x=>[x.id,x.name+(x.stream?` ${x.stream}`:"")])),[classes]), sm=useMemo(()=>new Map(subjects.map(x=>[x.id,x.name])),[subjects]),tm=useMemo(()=>new Map(teachers.map(x=>[x.id,x.full_name])),[teachers]);
 const box={padding:12,border:"1px solid #e2e8f0",borderRadius:12,background:"white"} as const;
 return <main style={{maxWidth:1050,margin:"0 auto",display:"grid",gap:16}}>
  <header><h1 style={{margin:0}}>Smart timetable</h1><p style={{color:"#64748b"}}>Build, validate, review and publish the school's recurring teaching plan.</p></header>
  {msg&&<div role="status" style={box}>{msg}</div>}
  <section style={box}>
   <h2 style={{fontSize:16}}>School day & bell schedule</h2>
   <p style={{color:"#64748b",fontSize:13}}>Define the real teaching day once. Lessons may be any duration; breaks, lunch and assembly are protected from lesson placement.</p>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8}}>
    <select value={block.scheduleDay} onChange={e=>setBlock({...block,scheduleDay:Number(e.target.value)})}><option value={0}>All days</option>{D.slice(1).map((d,i)=><option key={i+1} value={i+1}>{d}</option>)}</select>
    <input type="number" min={1} value={block.periodNumber} onChange={e=>setBlock({...block,periodNumber:Number(e.target.value)||1})} aria-label="Period number"/>
    <input value={block.label} onChange={e=>setBlock({...block,label:e.target.value})} placeholder="Label"/>
    <input type="time" value={block.startTime} onChange={e=>setBlock({...block,startTime:e.target.value})}/>
    <input type="time" value={block.endTime} onChange={e=>setBlock({...block,endTime:e.target.value})}/>
    <select value={block.kind} onChange={e=>setBlock({...block,kind:e.target.value})}>
     {["lesson","break","lunch","assembly","games","club","prep","staff_meeting","guidance","examination","school_event","free","custom"].map(k=><option key={k} value={k}>{k.replaceAll("_"," ")}</option>)}
    </select>
    <button disabled={busy} onClick={()=>void addSchoolBlock()}>Add block</button>
   </div>
   <div style={{marginTop:10}}>
    {periods.map(p=><div key={p.id} style={{display:"grid",gridTemplateColumns:"80px 1fr 110px 100px auto",gap:8,padding:"8px 0",borderBottom:"1px solid #eee",alignItems:"center"}}>
     <strong>{p.schedule_day===0?"All":D[p.schedule_day]}</strong><span>{p.label}</span><span>{p.start_time.slice(0,5)}–{p.end_time.slice(0,5)}</span><span style={{textTransform:"capitalize"}}>{p.kind.replaceAll("_"," ")}</span><button disabled={busy} onClick={()=>void removeSchoolBlock(p.id)}>Remove</button>
    </div>)}
   </div>
   <div style={{marginTop:16,paddingTop:14,borderTop:"1px solid #e5e7eb"}}>
    <h3 style={{fontSize:14,margin:"0 0 4px"}}>Class duration guidance</h3>
    <p style={{color:"#64748b",fontSize:12,margin:"0 0 10px"}}>Use this when a class or grade normally has a different lesson length. It guides planning and suggestions; the bell schedule above remains the actual time authority.</p>
    <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr auto",gap:8}}>
     <select value={classPreference.classId} onChange={e=>{const id=e.target.value;const existing=preferences.find(x=>x.class_id===id);setClassPreference({classId:id,lessonMinutes:existing?.lesson_minutes??40,preferredDayPart:existing?.preferred_day_part??""})}}><option value="">Class</option>{classes.map(x=><option key={x.id} value={x.id}>{cm.get(x.id)}</option>)}</select>
     <input type="number" min={20} max={120} value={classPreference.lessonMinutes} onChange={e=>setClassPreference({...classPreference,lessonMinutes:Number(e.target.value)||40})} aria-label="Lesson minutes"/>
     <select value={classPreference.preferredDayPart} onChange={e=>setClassPreference({...classPreference,preferredDayPart:e.target.value as ""|"morning"|"afternoon"})}><option value="">Any time</option><option value="morning">Prefer morning</option><option value="afternoon">Prefer afternoon</option></select>
     <button disabled={busy||!classPreference.classId} onClick={()=>void saveClassPreference()}>Save</button>
    </div>
   </div>
  </section>
  <section style={box}>
   <h2 style={{fontSize:16}}>Events & timetable exceptions</h2>
   <p style={{color:"#64748b",fontSize:13}}>Record holidays, exams, closures and special events without deleting the normal timetable.</p>
   <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 2fr auto auto",gap:8}}>
    <input type="date" value={exceptionDraft.date} onChange={e=>setExceptionDraft({...exceptionDraft,date:e.target.value})}/>
    <select value={exceptionDraft.kind} onChange={e=>setExceptionDraft({...exceptionDraft,kind:e.target.value as CalendarException["kind"]})}><option value="event">Event</option><option value="exam">Exam</option><option value="holiday">Holiday</option><option value="closure">Closure</option></select>
    <input value={exceptionDraft.label} onChange={e=>setExceptionDraft({...exceptionDraft,label:e.target.value})} placeholder="Sports day, exams, public holiday…"/>
    <label style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}><input type="checkbox" checked={exceptionDraft.suppress} onChange={e=>setExceptionDraft({...exceptionDraft,suppress:e.target.checked})}/> Pause lessons</label>
    <button disabled={busy||!exceptionDraft.label.trim()} onClick={()=>void addException()}>Add</button>
   </div>
   {exceptions.map(x=><div key={x.id} style={{display:"grid",gridTemplateColumns:"110px 1fr auto",gap:8,padding:"8px 0",borderBottom:"1px solid #eee"}}><strong>{x.exception_date}</strong><span>{x.label} · {x.kind}{x.suppress_ordinary_teaching?" · ordinary lessons paused":""}</span><button disabled={busy} onClick={()=>void removeException(x.id)}>Remove</button></div>)}
  </section>
  <section style={box}>
   <h2 style={{fontSize:16}}>Substitutions</h2>
   <p style={{color:"#64748b",fontSize:13}}>Assign a substitute to one generated lesson occurrence. The recurring timetable stays unchanged.</p>
   {!occurrences.length?<p style={{fontSize:13,color:"#64748b"}}>No upcoming planned lesson occurrences are available yet.</p>:<div style={{display:"grid",gridTemplateColumns:"2fr 2fr 2fr auto",gap:8}}>
    <select value={substitute.occurrenceId} onChange={e=>setSubstitute({...substitute,occurrenceId:e.target.value})}><option value="">Lesson occurrence</option>{occurrences.map(o=><option key={o.id} value={o.id}>{o.occurrence_date} · {cm.get(o.class_id)??"Class"} · {sm.get(o.subject_id)??"Subject"}{o.actual_teacher_id?" · substitute set":""}</option>)}</select>
    <select value={substitute.teacherId} onChange={e=>setSubstitute({...substitute,teacherId:e.target.value})}><option value="">Substitute teacher</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</select>
    <input value={substitute.reason} onChange={e=>setSubstitute({...substitute,reason:e.target.value})} placeholder="Reason (optional)"/>
    <button disabled={busy||!substitute.occurrenceId||!substitute.teacherId} onClick={()=>void assignSubstitute()}>Assign</button>
   </div>}
  </section>
  <section style={box}><h2 style={{fontSize:16}}>Smart placement</h2><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8}}>
   <select value={pick.classId} onChange={e=>setPick({...pick,classId:e.target.value})}><option value="">Class</option>{classes.map(x=><option key={x.id} value={x.id}>{cm.get(x.id)}</option>)}</select>
   <select value={pick.subjectId} onChange={e=>setPick({...pick,subjectId:e.target.value})}><option value="">Subject</option>{subjects.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
   <select value={pick.teacherId} onChange={e=>setPick({...pick,teacherId:e.target.value})}><option value="">Teacher</option>{teachers.map(x=><option key={x.id} value={x.id}>{x.full_name}</option>)}</select>
   <button disabled={busy} onClick={()=>void suggest()}>Suggest best slots</button>
  </div>{suggestions.slice(0,6).map(x=><button key={x.period_id+"-"+x.day_of_week} onClick={()=>void add(x)} style={{display:"block",width:"100%",textAlign:"left",marginTop:8,padding:10}}><strong>{D[x.day_of_week]} {x.start_time.slice(0,5)}–{x.end_time.slice(0,5)}</strong> · {x.explanation}</button>)}</section>
  <section style={box}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h2 style={{fontSize:16}}>Master timetable</h2><button disabled={busy||!slots.length} onClick={()=>void startRelease()}>Create review release</button></div>
   {!slots.length?<p>No active timetable slots.</p>:slots.sort((a,b)=>a.day_of_week-b.day_of_week||a.start_time.localeCompare(b.start_time)).map(x=><article key={x.id} style={{padding:"9px 0",borderBottom:"1px solid #eee",display:"grid",gridTemplateColumns:"120px 1fr auto",gap:8}}><strong>{D[x.day_of_week]} {x.start_time.slice(0,5)}</strong><span>{cm.get(x.class_id)} · {sm.get(x.subject_id)} · {tm.get(x.teacher_id)}</span><span>{x.allocation_units>1?`${x.allocation_units} units`:x.room||""}</span></article>)}
  </section>
 </main>
}
"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  clearCanonicalExamResult,
  getCanonicalExamSubjectPolicy,
  saveCanonicalExamResult,
  saveCanonicalExamResults,
  setCanonicalExamSubjectPolicy,
} from "@/lib/teacher/examResultAuthority";
import { examResultStateLabel, normalizeExamResultState, type CanonicalExamResult, type ExamResultState, type ExamSubjectPolicy } from "@/lib/assessment/exam-results";
import ProfessionalMarkbook from "@/components/teacher/ProfessionalMarkbook";
import AssessmentIntelligenceConsole from "@/components/teacher/AssessmentIntelligenceConsole";
import type { Database } from "@/lib/database.types";

type ExamInsert = Database["public"]["Tables"]["exams"]["Insert"];

interface Exam {
  id: string;
  name: string;
  term: number;
  academic_year: number;
  exam_type: string;
  pass_mark: number;
  is_locked: boolean;
  created_by: string;
}
interface ClassOption { id: string; name: string; stream: string }
interface SubjectOption { id: string; name: string }
interface Student { id: string; name: string; source: "db" | "manual"; class_name?: string }
type Result = CanonicalExamResult;
type Tier = 1 | 2 | 3;

const FINAL_STATES = new Set<ExamResultState>(["entered", "absent", "not_assessed", "exempt", "transferred"]);

function Skeleton({ h = 56 }: { h?: number }) {
  return <div style={{ height: h, borderRadius: 12, background: "linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)", backgroundSize: "200% 100%" }} />;
}
const W = { bg:"#FFFBF5", card:"#FFF8EF", border:"#EDE0CE", borderSoft:"#F5ECD9", text:"#1c1917", textSoft:"#78716c", textMuted:"#a8998a", gold:"#C8A84B", font:"Jost, sans-serif" };
const inputStyle: React.CSSProperties = { width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${W.border}`, fontSize:13, color:W.text, background:W.card, outline:"none", boxSizing:"border-box", fontFamily:W.font };
const labelStyle: React.CSSProperties = { display:"block", fontSize:12, fontWeight:600, color:W.textSoft, marginBottom:6, fontFamily:W.font };
const btnPrimary: React.CSSProperties = { width:"100%", padding:"13px 0", borderRadius:14, border:"none", cursor:"pointer", fontSize:14, fontWeight:700, background:W.gold, color:"#fff", fontFamily:W.font };
function pill(active:boolean, accent=W.gold):React.CSSProperties { return { flexShrink:0, padding:"6px 14px", borderRadius:20, border:"none", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:W.font, background:active?accent:W.borderSoft, color:active?"#fff":W.textSoft }; }

function friendlySaveError(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : "";
  if (message.includes("result_changed_review_again")) return "This result changed in another tab. Reload before editing it again.";
  if (message.includes("exam_locked")) return "This exam is locked. Results can no longer be changed.";
  if (message.includes("marks_outside_exam_maximum")) return "The score is outside this exam's allowed range.";
  if (message.includes("teacher_subject_not_authorized")) return "You no longer have permission to edit this class and subject.";
  if (message.includes("active_school_changed")) return "Your active school changed. Reload this page before saving.";
  return message || "This result could not be saved. Your entry is still on this screen.";
}

function ResultsInner() {
  const searchParams = useSearchParams();
  const [teacherId,setTeacherId]=useState<string|null>(null);
  const [schoolId,setSchoolId]=useState<string|null>(null);
  const [tier,setTier]=useState<Tier|null>(null);
  const [classes,setClasses]=useState<ClassOption[]>([]);
  const [subjects,setSubjects]=useState<SubjectOption[]>([]);
  const [activeClassIdx,setActiveClassIdx]=useState(0);
  const [activeSubjectIdx,setActiveSubjectIdx]=useState(0);
  const [exams,setExams]=useState<Exam[]>([]);
  const [activeExam,setActiveExam]=useState<Exam|null>(null);
  const [policy,setPolicy]=useState<ExamSubjectPolicy|null>(null);
  const [policyLoading,setPolicyLoading]=useState(false);
  const [showPolicyEditor,setShowPolicyEditor]=useState(false);
  const [policyMax,setPolicyMax]=useState(100);
  const [policyPass,setPolicyPass]=useState(50);
  const [policyError,setPolicyError]=useState<string|null>(null);
  const [savingPolicy,setSavingPolicy]=useState(false);
  const [showExamSheet,setShowExamSheet]=useState(false);
  const [newExamName,setNewExamName]=useState("");
  const [newExamType,setNewExamType]=useState("summative");
  const [newExamTerm,setNewExamTerm]=useState(1);
  const [newExamYear,setNewExamYear]=useState(new Date().getFullYear());
  const [newExamMax,setNewExamMax]=useState(100);
  const [newExamPass,setNewExamPass]=useState(50);
  const [creatingExam,setCreatingExam]=useState(false);
  const [examError,setExamError]=useState<string|null>(null);
  const [students,setStudents]=useState<Student[]>([]);
  const [results,setResults]=useState<Result[]>([]);
  const [draftMarks,setDraftMarks]=useState<Record<string,string>>({});
  const [savingId,setSavingId]=useState<string|null>(null);
  const [savedId,setSavedId]=useState<string|null>(null);
  const [savingAll,setSavingAll]=useState(false);
  const [errorByStudent,setErrorByStudent]=useState<Record<string,string>>({});
  const [activeTab,setActiveTab]=useState<"entry"|"analysis">("entry");
  const [booting,setBooting]=useState(true);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const loadIdRef=useRef(0);

  useEffect(()=>{ void boot(); },[]);

  async function boot() {
    setBooting(true); setError(null);
    const { data:{user}, error:authErr } = await supabase.auth.getUser();
    if (authErr || !user) { setError("Not signed in."); setBooting(false); return; }
    setTeacherId(user.id);
    const {data:contextData,error:contextError}=await supabase.rpc("teacher_get_operating_context");
    if(contextError){setError("Teacher operating context could not be loaded.");setBooting(false);return;}
    const context=contextData as {school_id?:string|null;classes?:Array<{class_id:string;class_name:string;stream?:string|null;subject_id:string;subject_name:string}>}|null;
    const sid=context?.school_id??null;
    setSchoolId(sid);
    if (!sid) { setTier(3); await loadExams(user.id,null); setBooting(false); return; }
    const assignments=context?.classes??[];
    if (assignments.length===0) { setTier(2); await loadExams(user.id,sid); setBooting(false); return; }
    setTier(1);
    const loadedClasses=Array.from(new Map(assignments.map(a=>[a.class_id,{id:a.class_id,name:a.class_name,stream:a.stream??""}])).values()) as ClassOption[];
    const loadedSubjects=Array.from(new Map(assignments.map(a=>[a.subject_id,{id:a.subject_id,name:a.subject_name}])).values()) as SubjectOption[];
    let ci=0,si=0;
    const urlClassId=searchParams.get("classId"); const urlSubjectId=searchParams.get("subjectId");
    if (urlClassId) { const i=loadedClasses.findIndex(c=>c.id===urlClassId); if (i!==-1) ci=i; }
    if (urlSubjectId) { const i=loadedSubjects.findIndex(s=>s.id===urlSubjectId); if (i!==-1) si=i; }
    setClasses(loadedClasses); setSubjects(loadedSubjects); setActiveClassIdx(ci); setActiveSubjectIdx(si);
    await loadExams(user.id,sid);
    setBooting(false);
  }

  async function loadExams(tid:string,sid:string|null) {
    const query=sid
      ? supabase.from("exams").select("*").or(`created_by.eq.${tid},school_id.eq.${sid}`).order("created_at",{ascending:false})
      : supabase.from("exams").select("*").eq("created_by",tid).order("created_at",{ascending:false});
    const {data}=await query;
    const loaded=(data??[]) as Exam[];
    setExams(loaded);
    setActiveExam(loaded.find(e=>e.id===searchParams.get("examId"))??loaded[0]??null);
  }

  useEffect(()=>{
    if (tier!==1) { setStudents([]); return; }
    const classId=classes[activeClassIdx]?.id;
    if (!classId) return;
    const id=++loadIdRef.current;
    void loadTier1Students(id,classId);
  },[tier,activeClassIdx,classes]);

  async function loadTier1Students(loadId:number,classId:string) {
    setLoading(true);
    const {data:scRows,error:rosterError}=await supabase.from("student_classes").select("student_id").eq("school_id",schoolId!).eq("class_id",classId).eq("is_current",true);
    if(rosterError){if(loadId===loadIdRef.current){setError("Class roster could not be loaded.");setLoading(false);}return;}
    if (loadId!==loadIdRef.current) return;
    const ids=(scRows??[]).map((r:{student_id:string})=>r.student_id);
    if (ids.length===0) { setStudents([]); setLoading(false); return; }
    const {data:studs}=await supabase.from("students").select("id, name").in("id",ids);
    if (loadId!==loadIdRef.current) return;
    setStudents(((studs??[]) as {id:string;name:string}[]).sort((a,b)=>a.name.localeCompare(b.name)).map(s=>({...s,source:"db" as const})));
    setLoading(false);
  }

  useEffect(()=>{
    const classId=classes[activeClassIdx]?.id,subjectId=subjects[activeSubjectIdx]?.id;
    if(!activeExam||!schoolId||!classId||!subjectId){setPolicy(null);return;}
    let active=true;
    setPolicyLoading(true);setPolicyError(null);
    void getCanonicalExamSubjectPolicy({examId:activeExam.id,schoolId,classId,subjectId})
      .then(next=>{if(active){setPolicy(next);setPolicyMax(next.max_marks);setPolicyPass(next.pass_mark);}})
      .catch(cause=>{if(active){setPolicy(null);setPolicyError(friendlySaveError(cause));}})
      .finally(()=>{if(active)setPolicyLoading(false);});
    return()=>{active=false;};
  },[activeExam,schoolId,classes,subjects,activeClassIdx,activeSubjectIdx]);

  useEffect(()=>{ if (activeExam && students.length>0) void loadResults(); else setResults([]); },[activeExam,students,activeSubjectIdx]);

  useEffect(()=>{
    const classId=classes[activeClassIdx]?.id,subjectId=subjects[activeSubjectIdx]?.id;
    if(!activeExam||!classId||!subjectId)return;
    const url=new URL(window.location.href);
    url.searchParams.set("examId",activeExam.id);url.searchParams.set("classId",classId);url.searchParams.set("subjectId",subjectId);
    window.history.replaceState(window.history.state,"",url.pathname+url.search);
  },[activeExam,classes,subjects,activeClassIdx,activeSubjectIdx]);

  async function loadResults() {
    if (!activeExam) return;
    const studentIds=students.map(s=>s.id);
    let query=supabase.from("exam_results").select("id, student_id, marks, max_marks, percentage, result_state, is_absent, updated_at").eq("exam_id",activeExam.id).in("student_id",studentIds);
    const subjectId=subjects[activeSubjectIdx]?.id;
    if (subjectId) query=query.eq("subject_id",subjectId);
    const {data,error:resultError}=await query;
    if(resultError){setError("Results could not be loaded.");return;}
    const loaded=(data??[]).map(row=>({...row,result_state:normalizeExamResultState(row.result_state,row.is_absent)})) as Result[];
    setResults(loaded);
    const draft:Record<string,string>={};
    for (const r of loaded) if (r.result_state==="entered" && r.marks!=null) draft[r.student_id]=String(r.marks);
    setDraftMarks(draft); setErrorByStudent({});
  }

  async function savePolicy() {
    const classId=classes[activeClassIdx]?.id,subjectId=subjects[activeSubjectIdx]?.id;
    if(!activeExam||!schoolId||!classId||!subjectId||savingPolicy)return;
    if(!Number.isFinite(policyMax)||policyMax<=0){setPolicyError("Maximum marks must be greater than zero.");return;}
    if(!Number.isFinite(policyPass)||policyPass<0||policyPass>policyMax){setPolicyError("Pass mark must be between 0 and the maximum marks.");return;}
    setSavingPolicy(true);setPolicyError(null);
    try{
      const next=await setCanonicalExamSubjectPolicy({examId:activeExam.id,schoolId,classId,subjectId,maxMarks:policyMax,passMark:policyPass});
      setPolicy(next);setShowPolicyEditor(false);
    }catch(cause){
      const message=cause instanceof Error?cause.message:"";
      setPolicyError(message.includes("exam_subject_policy_has_results")
        ? "Scores already exist for this subject. The maximum marks cannot be changed after entry; preserve the evidence and create/correct the exam setup before recording more."
        : friendlySaveError(cause));
    }finally{setSavingPolicy(false);}
  }

  async function createExam() {
    const classId=classes[activeClassIdx]?.id,subjectId=subjects[activeSubjectIdx]?.id;
    if (creatingExam || !teacherId || !schoolId || !classId || !subjectId) return;
    if (!newExamName.trim()) { setExamError("Enter an exam name."); return; }
    if (!Number.isFinite(newExamMax)||newExamMax<=0) { setExamError("Maximum marks must be greater than zero."); return; }
    if (!Number.isFinite(newExamPass)||newExamPass<0||newExamPass>newExamMax) { setExamError("Pass mark must be between 0 and the maximum marks."); return; }
    setCreatingExam(true); setExamError(null);
    const payload:ExamInsert={name:newExamName.trim(),exam_type:newExamType,term:newExamTerm,academic_year:newExamYear,pass_mark:newExamPass,created_by:teacherId,school_id:schoolId};
    const {data,error:cErr}=await supabase.from("exams").insert(payload).select("*").single();
    if (cErr || !data) { setExamError("Could not create exam. Please try again."); setCreatingExam(false); return; }
    const created=data as Exam;
    try{
      const nextPolicy=await setCanonicalExamSubjectPolicy({examId:created.id,schoolId,classId,subjectId,maxMarks:newExamMax,passMark:newExamPass});
      setPolicy(nextPolicy);setPolicyMax(nextPolicy.max_marks);setPolicyPass(nextPolicy.pass_mark);
    }catch(cause){
      setExamError(`Exam created, but its scoring setup needs attention: ${friendlySaveError(cause)}`);
      setExams(prev=>[created,...prev]);setActiveExam(created);setCreatingExam(false);return;
    }
    setExams(prev=>[created,...prev]); setActiveExam(created); setShowExamSheet(false); setNewExamName(""); setCreatingExam(false);
  }

  async function saveMark(student:Student):Promise<boolean> {
    if (!activeExam || !teacherId || !policy || activeExam.is_locked) return false;
    const raw=draftMarks[student.id]??"";
    const marks=Number(raw);
    if (raw.trim()==="" || !Number.isFinite(marks) || marks<0 || marks>policy.max_marks) {
      setErrorByStudent(prev=>({...prev,[student.id]:`Enter a score from 0 to ${policy.max_marks}.`})); return false;
    }
    const classId=classes[activeClassIdx]?.id,subjectId=subjects[activeSubjectIdx]?.id;
    if (!schoolId || !classId || !subjectId) {
      setErrorByStudent(prev=>({...prev,[student.id]:"Class or subject context is unavailable."})); return false;
    }
    setSavingId(student.id); setErrorByStudent(prev=>{const n={...prev}; delete n[student.id]; return n;});
    const existing=results.find(r=>r.student_id===student.id);
    try {
      const saved=await saveCanonicalExamResult({examId:activeExam.id,schoolId,classId,subjectId,studentId:student.id,marks,resultState:"entered",expectedUpdatedAt:existing?.updated_at??null});
      setResults(prev=>existing?prev.map(r=>r.id===saved.id?saved:r):[...prev,saved]);
      setDraftMarks(prev=>({...prev,[student.id]:String(saved.marks??marks)}));
      window.dispatchEvent(new CustomEvent("vibeschool:record-saved",{detail:{kind:"exam_result"}}));
      setSavedId(student.id);setTimeout(()=>setSavedId(current=>current===student.id?null:current),1600);
      return true;
    } catch (cause) {
      setErrorByStudent(prev=>({...prev,[student.id]:friendlySaveError(cause)})); return false;
    } finally { setSavingId(null); }
  }

  async function saveState(student:Student,state:Exclude<ExamResultState,"entered">):Promise<boolean> {
    if(!activeExam||!policy||activeExam.is_locked)return false;
    const classId=classes[activeClassIdx]?.id,subjectId=subjects[activeSubjectIdx]?.id;
    if(!schoolId||!classId||!subjectId)return false;
    const existing=results.find(r=>r.student_id===student.id);
    setSavingId(student.id);setErrorByStudent(prev=>{const n={...prev};delete n[student.id];return n;});
    try{
      const saved=await saveCanonicalExamResult({examId:activeExam.id,schoolId,classId,subjectId,studentId:student.id,marks:null,resultState:state,expectedUpdatedAt:existing?.updated_at??null});
      setResults(prev=>existing?prev.map(r=>r.id===saved.id?saved:r):[...prev,saved]);
      setDraftMarks(prev=>{const n={...prev};delete n[student.id];return n;});
      setSavedId(student.id);setTimeout(()=>setSavedId(current=>current===student.id?null:current),1600);
      return true;
    }catch(cause){setErrorByStudent(prev=>({...prev,[student.id]:friendlySaveError(cause)}));return false;}
    finally{setSavingId(null);}
  }

  async function clearResult(student:Student):Promise<boolean>{
    const existing=results.find(r=>r.student_id===student.id);
    const classId=classes[activeClassIdx]?.id,subjectId=subjects[activeSubjectIdx]?.id;
    if(!existing||!activeExam||activeExam.is_locked||!schoolId||!classId||!subjectId)return false;
    setSavingId(student.id);
    try{
      await clearCanonicalExamResult({examId:activeExam.id,schoolId,classId,subjectId,studentId:student.id,expectedUpdatedAt:existing.updated_at});
      setResults(prev=>prev.filter(r=>r.id!==existing.id));
      setDraftMarks(prev=>{const n={...prev};delete n[student.id];return n;});
      return true;
    }catch(cause){setErrorByStudent(prev=>({...prev,[student.id]:friendlySaveError(cause)}));return false;}
    finally{setSavingId(null);}
  }

  async function saveAllMarks() {
    if (!activeExam || activeExam.is_locked || savingAll || !policy) return;
    const classId=classes[activeClassIdx]?.id,subjectId=subjects[activeSubjectIdx]?.id;
    if(!schoolId||!classId||!subjectId)return;
    const changes=students.flatMap(student=>{
      const raw=draftMarks[student.id]??"";
      const marks=Number(raw);
      if(raw.trim()===""||!Number.isFinite(marks)||marks<0||marks>policy.max_marks)return[];
      const existing=results.find(r=>r.student_id===student.id);
      return [{examId:activeExam.id,schoolId,classId,subjectId,studentId:student.id,marks,resultState:"entered" as const,expectedUpdatedAt:existing?.updated_at??null}];
    });
    if(!changes.length)return;
    setSavingAll(true);setErrorByStudent({});
    try{
      const saved=await saveCanonicalExamResults(changes);
      const savedMap=new Map(saved.map(row=>[row.student_id,row]));
      setResults(prev=>{
        const untouched=prev.filter(row=>!savedMap.has(row.student_id));
        return [...untouched,...saved];
      });
      setSavedId(saved[saved.length-1]?.student_id??null);
    }catch(cause){setError("Some scores could not be saved. Nothing from this batch was silently accepted. Review the rows and try again.");}
    finally{setSavingAll(false);}
  }

  function exportMarksCsv() {
    if (!activeExam || !policy) return;
    const saved=new Map(results.map(r=>[r.student_id,r]));
    const rows=[["Learner","Score","Out of","Percent","Result","Target"]];
    for (const student of students) {
      const result=saved.get(student.id);
      if (!result) rows.push([student.name,"","","","Not entered",""]);
      else if (result.result_state!=="entered") rows.push([student.name,"",String(result.max_marks),"",examResultStateLabel(result.result_state),""]);
      else rows.push([
        student.name,
        String(result.marks??""),
        String(result.max_marks),
        result.percentage==null?"":String(result.percentage),
        "Score entered",
        (result.marks??0)>=policy.pass_mark?"At/above target":"Below target",
      ]);
    }
    const csv=rows.map(row=>row.map(value=>`"${String(value).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");
    link.href=url;
    link.download=`${activeExam.name.replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"").toLowerCase()||"exam"}-${activeClass?.name??"class"}-${activeSubject?.name??"subject"}.csv`;
    document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
  }

  function analysisData() {
    const entered=results.filter(r=>r.result_state==="entered"&&r.percentage!=null&&r.marks!=null);
    if (entered.length===0) return null;
    const percentages=entered.map(r=>r.percentage as number);
    const avg=percentages.reduce((a,b)=>a+b,0)/percentages.length;
    const passed=entered.filter(r=>(r.marks as number)>=(policy?.pass_mark??activeExam?.pass_mark??50)).length;
    return {
      avg,passed,failed:entered.length-passed,total:entered.length,
      absent:results.filter(r=>r.result_state==="absent").length,
      resolved:results.filter(r=>FINAL_STATES.has(r.result_state)).length,
    };
  }
  const analysis=analysisData();

  if (booting) return <div style={{padding:24,display:"flex",flexDirection:"column",gap:12}}><Skeleton h={40}/><Skeleton h={64}/><Skeleton h={64}/></div>;
  if (error) return <div style={{padding:24,color:"#991b1b",fontSize:14}}>⚠️ {error}</div>;

  const activeClass=classes[activeClassIdx]; const activeSubject=subjects[activeSubjectIdx];

  return <div style={{padding:"0 0 80px",fontFamily:W.font,background:W.bg,minHeight:"100vh"}}>
    <div style={{padding:"20px 16px 12px",borderBottom:"1px solid #EDE0CE"}}>
      <h1 style={{margin:0,fontSize:20,fontWeight:800,color:W.text}}>Exam Centre</h1>
      <p style={{margin:"4px 0 0",fontSize:13,color:W.textSoft}}>{tier===1?`${activeClass?.name??"—"}${activeClass?.stream?" "+activeClass.stream:""}${activeSubject?" · "+activeSubject.name:""} · enter once, reuse across Workbook, progress and reports`:"Set up a class and subject to enter and explore exam results."}</p>
    </div>

    {tier===1 && <>
      <div style={{overflowX:"auto",display:"flex",gap:8,padding:"12px 16px 0"}}>{classes.map((c,i)=><button key={c.id} onClick={()=>setActiveClassIdx(i)} style={pill(i===activeClassIdx)}>{c.name}{c.stream?" "+c.stream:""}</button>)}</div>
      <div style={{overflowX:"auto",display:"flex",gap:8,padding:"8px 16px 0"}}>{subjects.map((s,i)=><button key={s.id} onClick={()=>setActiveSubjectIdx(i)} style={pill(i===activeSubjectIdx,"#4f46e5")}>{s.name}</button>)}</div>
    </>}

    <div style={{padding:"14px 16px 0"}}><div style={{fontSize:11,fontWeight:800,letterSpacing:.5,textTransform:"uppercase",color:W.textMuted}}>My exam sheets</div><div style={{fontSize:13,color:W.textSoft,marginTop:3}}>Choose an exam, then record or continue results for the selected class and subject; learner marks recorded and other final result states share one canonical sheet.</div></div>
    <div style={{padding:"10px 16px 0",display:"flex",gap:8,alignItems:"center"}}>
      <div style={{flex:1,overflowX:"auto",display:"flex",gap:8}}>{exams.length===0?<span style={{fontSize:13,color:W.textMuted}}>No exams yet</span>:exams.map(e=><button key={e.id} onClick={()=>setActiveExam(e)} style={pill(activeExam?.id===e.id,"#0a0a0a")}>{e.name}{e.is_locked?" · Locked":""}</button>)}</div>
      <button onClick={exportMarksCsv} disabled={!activeExam || results.length===0 || !policy} style={{padding:"6px 12px",borderRadius:20,border:"1px solid #EDE0CE",background:"#fff",fontWeight:700,opacity:(!activeExam || results.length===0 || !policy) ? .5 : 1}}>Export CSV</button>
      <button onClick={()=>setShowExamSheet(true)} style={{padding:"6px 14px",borderRadius:20,border:"1px solid #EDE0CE",background:"#fff",fontWeight:700}}>＋ New exam</button>
    </div>

    {activeExam&&tier===1&&<div style={{margin:"10px 16px 0",padding:"10px 12px",border:"1px solid #E7E5E4",borderRadius:13,background:"#fff",fontSize:12,color:W.textSoft}}>
      {policyLoading?"Checking scoring setup…":policy?<div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",flexWrap:"wrap"}}><span><strong style={{color:W.text}}>Scoring:</strong> out of {policy.max_marks} · pass {policy.pass_mark} ({policy.pass_percentage.toFixed(1)}%) {!policy.configured&&<span>· using exam default</span>}</span>{!activeExam.is_locked&&<button onClick={()=>setShowPolicyEditor(v=>!v)} style={{border:0,background:"transparent",color:"#4f46e5",fontWeight:800,cursor:"pointer"}}>Change scoring</button>}</div>:<span style={{color:"#b91c1c"}}>{policyError??"Scoring setup unavailable."}</span>}
      {showPolicyEditor&&policy&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:8,marginTop:10,alignItems:"end"}}><div><label style={labelStyle}>Maximum marks</label><input type="number" min={1} style={inputStyle} value={policyMax} onChange={e=>setPolicyMax(Number(e.target.value))}/></div><div><label style={labelStyle}>Pass mark</label><input type="number" min={0} max={policyMax} style={inputStyle} value={policyPass} onChange={e=>setPolicyPass(Number(e.target.value))}/></div><button onClick={()=>void savePolicy()} disabled={savingPolicy} style={{padding:"10px 13px",border:0,borderRadius:10,background:"#111827",color:"#fff",fontWeight:800}}>{savingPolicy?"Saving…":"Save"}</button></div>}
      {policyError&&<div role="alert" style={{marginTop:7,color:"#b91c1c",fontWeight:700}}>{policyError}</div>}
    </div>}

    {activeExam && students.length>0 && <div style={{margin:"12px 16px 0",display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:8}}>
      {[
        ["Students",students.length],
        ["Final results",analysis?.resolved??results.filter(r=>FINAL_STATES.has(r.result_state)).length],
        ["Class mean",analysis?`${analysis.avg.toFixed(1)}%`:"—"],
        ["Need support",analysis?analysis.failed:"—"],
      ].map(([label,value])=><div key={String(label)} style={{padding:"12px",background:"#fff",border:"1px solid #E7E5E4",borderRadius:14}}><div style={{fontSize:11,color:W.textSoft,fontWeight:700}}>{label}</div><div style={{fontSize:20,fontWeight:800,marginTop:3}}>{value}</div></div>)}
    </div>}

    {activeExam && tier===1 && <div style={{margin:"12px 16px 0",padding:"12px 14px",borderRadius:14,border:`1px solid ${activeExam.is_locked?"#d6d3d1":"#d1fae5"}`,background:activeExam.is_locked?"#fafaf9":"#ecfdf5",fontSize:12,color:W.textSoft}}><strong style={{color:W.text}}>{activeExam.name}</strong> · {results.filter(r=>FINAL_STATES.has(r.result_state)).length}/{students.length} learner results resolved{students.length>0?` · ${Math.round((results.filter(r=>FINAL_STATES.has(r.result_state)).length/students.length)*100)}% complete`:""}. {activeExam.is_locked?"This exam is locked; marks are read-only.":results.filter(r=>FINAL_STATES.has(r.result_state)).length<students.length?"Continue the result sheet below.":"This subject result sheet is complete."}</div>}

    {activeExam && <div style={{display:"flex",gap:0,margin:"14px 16px 0",borderRadius:12,background:"#F5ECD9",padding:4}}>{(["entry","analysis"] as const).map(tab=><button key={tab} onClick={()=>setActiveTab(tab)} style={{flex:1,padding:"9px 0",borderRadius:10,border:"none",fontWeight:700,background:activeTab===tab?"#fff":"transparent",color:activeTab===tab?"#111827":"#9ca3af"}}>{tab==="entry"?"Results":"Explore"}</button>)}</div>}

    {activeTab==="entry" && <div style={{padding:"14px 16px 0"}}>
      {!activeExam?<div style={{padding:40,textAlign:"center",color:W.textMuted}}>Create or select an exam to open the markbook.</div>
      : tier!==1?<div style={{padding:24,border:"1px solid #fde68a",background:"#fffbeb",borderRadius:14,color:"#92400e"}}>Professional result entry requires a school class and subject assignment. This prevents unscoped records.</div>
      : loading||policyLoading?<Skeleton h={220}/>
      : !policy?<div style={{padding:24,border:"1px solid #fecaca",background:"#fef2f2",borderRadius:14,color:"#991b1b"}}>{policyError??"Scoring setup could not be verified."}</div>
      : students.length===0?<div style={{padding:32,textAlign:"center",color:W.textMuted}}>No students enrolled in this class.</div>
      : <ProfessionalMarkbook students={students} results={results} draftMarks={draftMarks} maxMarks={policy.max_marks} passMark={policy.pass_mark} locked={activeExam.is_locked} savingId={savingId} savedId={savedId} errorByStudent={errorByStudent} onChangeMark={(studentId,value)=>{setDraftMarks(prev=>({...prev,[studentId]:value}));setErrorByStudent(prev=>{const n={...prev};delete n[studentId];return n;});}} onSaveMark={saveMark} onSaveState={saveState} onClearResult={clearResult} reportCardHref={studentId=>`/teacher/results/report-card/${studentId}?examId=${activeExam.id}`} onSaveAll={saveAllMarks} savingAll={savingAll} />}
    </div>}

    {activeTab==="analysis" && <div style={{padding:"14px 16px 0"}}>
      {!activeExam || !activeClass || !activeSubject ? <div style={{padding:40,textAlign:"center",color:W.textMuted}}>Select a class, subject and exam to open intelligence.</div> : <AssessmentIntelligenceConsole examId={activeExam.id} classId={activeClass.id} subjectId={activeSubject.id} refreshKey={`${activeExam.id}:${activeClass.id}:${activeSubject.id}:${results.map(r=>`${r.id}:${r.result_state}:${r.marks}:${r.max_marks}`).join("|")}`} onOpenMarkbook={()=>setActiveTab("entry")} />}
    </div>}

    {showExamSheet && <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:1000,display:"flex",alignItems:"flex-end"}} onClick={e=>{if(e.target===e.currentTarget)setShowExamSheet(false);}}><div style={{width:"100%",background:W.bg,borderRadius:"22px 22px 0 0",padding:"18px 16px 32px"}}><h2 style={{margin:"0 0 6px",fontSize:18}}>Create exam</h2><p style={{margin:"0 0 16px",fontSize:12,color:W.textSoft}}>Create the shared exam once, then teachers enter results against the same exam record. Set the real maximum marks and pass mark before entry begins.</p><label style={labelStyle}>Exam name</label><input style={inputStyle} value={newExamName} onChange={e=>setNewExamName(e.target.value)} placeholder="e.g. Term 2 Midterm"/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:12}}><div><label style={labelStyle}>Type</label><select style={inputStyle} value={newExamType} onChange={e=>setNewExamType(e.target.value)}><option value="summative">Exam</option><option value="cat">CAT / Test</option><option value="midterm">Midterm</option><option value="opener">Opener</option><option value="endterm">End-term</option></select></div><div><label style={labelStyle}>Maximum marks</label><input type="number" min={1} style={inputStyle} value={newExamMax} onChange={e=>setNewExamMax(Number(e.target.value))}/></div><div><label style={labelStyle}>Pass mark</label><input type="number" min={0} max={newExamMax} style={inputStyle} value={newExamPass} onChange={e=>setNewExamPass(Number(e.target.value))}/></div><div><label style={labelStyle}>Term</label><select style={inputStyle} value={newExamTerm} onChange={e=>setNewExamTerm(Number(e.target.value))}>{[1,2,3].map(t=><option key={t} value={t}>Term {t}</option>)}</select></div><div><label style={labelStyle}>Year</label><input type="number" style={inputStyle} value={newExamYear} onChange={e=>setNewExamYear(Number(e.target.value))}/></div></div>{examError&&<p style={{color:"#b91c1c",fontSize:12,fontWeight:700}}>{examError}</p>}<button onClick={()=>void createExam()} disabled={creatingExam} style={{...btnPrimary,marginTop:16,opacity:creatingExam ? .6 : 1}}>{creatingExam?"Creating…":"Create exam"}</button></div></div>}
  </div>;
}

export default function ResultsPage(){ return <Suspense fallback={<div style={{padding:24}}>Loading results…</div>}><ResultsInner/></Suspense>; }

"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { C } from "@/components/teacher/ui";

interface Student { id: string; name: string; admission_number: string; }
interface Question { id: string; question: string; order_num: number; }
interface Answer { question_id: string; answer_text: string | null; }
interface Submission { id: string; student_id: string; status: "pending"|"submitted"|"marked"; mark: number|null; feedback: string|null; submitted_at: string|null; answers: Answer[]; }
interface HWInfo { title: string; subject: string; instructions: string|null; due_date: string; type: string; }

type View = "list"|"grade";

const inp: React.CSSProperties = { width:"100%", padding:"11px 14px", borderRadius:10, border:"1px solid #e5e7eb", fontSize:14, color:C.textPrimary, outline:"none", fontFamily:"inherit", background:"#f9fafb", boxSizing:"border-box" };

function statusBadge(s: string) {
  if (s==="marked")    return { label:"Marked",        bg:"#d1fae5", color:"#065f46" };
  if (s==="submitted") return { label:"Submitted",     bg:"#fef3c7", color:"#92400e" };
  return                      { label:"Not submitted", bg:"#f3f4f6", color:"#6b7280" };
}

function GradingInner() {
  const router  = useRouter();
  const params  = useParams();
  const classId = params.id as string;
  const hwId    = params.hwId as string;

  const [hw,        setHw]        = useState<HWInfo|null>(null);
  const [students,  setStudents]  = useState<Student[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subMap,    setSubMap]    = useState<Map<string,Submission>>(new Map());
  const [loading,   setLoading]   = useState(true);
  const [view,      setView]      = useState<View>("list");
  const [active,    setActive]    = useState<Student|null>(null);
  const [mark,      setMark]      = useState("");
  const [feedback,  setFeedback]  = useState("");
  const [saving,    setSaving]    = useState(false);
  const [saveOk,    setSaveOk]    = useState(false);

  useEffect(() => { load(); }, [hwId, classId]);

  async function load() {
    setLoading(true);
    const [hwRes, stuRes, qRes, subRes] = await Promise.all([
      supabase.from("homework").select("title,subject,instructions,due_date,type").eq("id",hwId).single(),
      supabase.from("students").select("id,name,admission_number").eq("class_id",classId).order("name"),
      supabase.from("homework_questions").select("id,question,order_num").eq("homework_id",hwId).order("order_num"),
      supabase.from("homework_submissions").select("id,student_id,status,mark,feedback,submitted_at").eq("homework_id",hwId),
    ]);
    setHw(hwRes.data as HWInfo);
    setStudents((stuRes.data??[]) as Student[]);
    setQuestions((qRes.data??[]) as Question[]);
    const subs = (subRes.data??[]) as Omit<Submission,"answers">[];
    const subIds = subs.map(s=>s.id);
    let answers: (Answer&{submission_id:string})[] = [];
    if (subIds.length>0) {
      const {data:ans} = await supabase.from("homework_answers").select("submission_id,question_id,answer_text").in("submission_id",subIds);
      answers = (ans??[]) as (Answer&{submission_id:string})[];
    }
    const map = new Map<string,Submission>();
    for (const s of subs) map.set(s.student_id,{...s,answers:answers.filter(a=>a.submission_id===s.id)});
    setSubMap(map);
    setLoading(false);
  }

  function openGrade(student: Student) {
    const sub = subMap.get(student.id);
    setActive(student);
    setMark(sub?.mark!=null ? String(sub.mark) : "");
    setFeedback(sub?.feedback??"");
    setSaveOk(false);
    setView("grade");
  }

  async function saveGrade() {
    if (!active) return;
    setSaving(true);
    const sub = subMap.get(active.id);
    if (!sub) { setSaving(false); return; }
    const {error} = await supabase.from("homework_submissions").update({ mark:mark!==""?Number(mark):null, feedback:feedback.trim()||null, status:"marked" }).eq("id",sub.id);
    if (!error) {
      const updated = new Map(subMap);
      updated.set(active.id,{...sub,mark:mark!==""?Number(mark):null,feedback:feedback.trim()||null,status:"marked"});
      setSubMap(updated);
      setSaveOk(true);
    }
    setSaving(false);
  }

  const submitted = students.filter(s=>subMap.has(s.id));
  const notYet    = students.filter(s=>!subMap.has(s.id));
  const marked    = submitted.filter(s=>subMap.get(s.id)?.status==="marked");

  if (loading) return <div style={{padding:20,color:C.textMuted,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Loading…</div>;

  if (view==="grade" && active) {
    const sub = subMap.get(active.id);
    return (
      <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",paddingBottom:100,background:C.surface,minHeight:"100vh"}}>
        <div style={{background:"linear-gradient(135deg,#0f766e,#14b8a6)",padding:"20px 16px 24px"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <button onClick={()=>setView("list")} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:10,width:36,height:36,color:"#fff",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
            <div>
              <div style={{fontSize:18,fontWeight:900,color:"#fff"}}>{active.name}</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.65)"}}>{active.admission_number} · {hw?.title}</div>
            </div>
          </div>
        </div>
        <div style={{padding:16,display:"flex",flexDirection:"column",gap:14}}>
          {!sub && <div style={{background:"#fff",borderRadius:16,padding:"20px 16px",textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}><div style={{fontSize:13,color:C.textMuted}}>This student has not submitted yet.</div></div>}
          {sub && questions.length>0 && (
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {questions.map((q,i)=>{
                const ans = sub.answers.find(a=>a.question_id===q.id);
                return (
                  <div key={q.id} style={{background:"#fff",borderRadius:14,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.accent,marginBottom:6}}>Q{i+1}</div>
                    <div style={{fontSize:13,color:C.textPrimary,fontWeight:600,marginBottom:10,lineHeight:1.5}}>{q.question}</div>
                    <div style={{fontSize:13,color:C.textMuted,background:"#f9fafb",borderRadius:10,padding:"10px 12px",lineHeight:1.6}}>
                      {ans?.answer_text??<span style={{fontStyle:"italic"}}>No answer given</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {sub && questions.length===0 && (
            <div style={{background:"#fff",borderRadius:14,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
              <div style={{fontSize:13,color:C.textMuted}}>Book assignment — student marked as done on {sub.submitted_at?new Date(sub.submitted_at).toLocaleDateString("en-KE",{day:"numeric",month:"short"}):"unknown date"}.</div>
            </div>
          )}
          {sub && (
            <div style={{background:"#fff",borderRadius:16,padding:"16px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
              <div style={{fontSize:11,fontWeight:800,color:C.textMuted,textTransform:"uppercase",letterSpacing:0.8,marginBottom:14}}>Grade</div>
              <div style={{marginBottom:12}}>
                <label style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:0.8,marginBottom:6,display:"block"}}>Mark</label>
                <input type="number" value={mark} onChange={e=>setMark(e.target.value)} placeholder="e.g. 18" style={inp} />
              </div>
              <div style={{marginBottom:14}}>
                <label style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:0.8,marginBottom:6,display:"block"}}>Feedback</label>
                <textarea value={feedback} onChange={e=>setFeedback(e.target.value)} placeholder="Well done! / Revise fractions…" rows={3} style={{...inp,resize:"vertical"}} />
              </div>
              {saveOk && <div style={{fontSize:12,color:"#065f46",background:"#d1fae5",borderRadius:10,padding:"8px 12px",marginBottom:10}}>✓ Grade saved — student will see it now</div>}
              <button onClick={saveGrade} disabled={saving||!sub} style={{width:"100%",padding:"13px",borderRadius:12,border:"none",background:saving?"#99f6e4":"#0f766e",color:"#fff",fontWeight:800,fontSize:14,cursor:saving?"not-allowed":"pointer",fontFamily:"inherit"}}>
                {saving?"Saving…":saveOk?"Update Grade":"Save Grade"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",paddingBottom:100,background:C.surface,minHeight:"100vh"}}>
      <div style={{background:"linear-gradient(135deg,#0f766e,#14b8a6)",padding:"20px 16px 28px"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
          <button onClick={()=>router.back()} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:10,width:36,height:36,color:"#fff",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
          <div>
            <div style={{fontSize:18,fontWeight:900,color:"#fff"}}>{hw?.title}</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.65)"}}>{hw?.subject} · Due {hw?.due_date?new Date(hw.due_date).toLocaleDateString("en-KE",{day:"numeric",month:"short"}):""}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          {[{label:"Students",value:students.length},{label:"Submitted",value:submitted.length},{label:"Marked",value:marked.length},{label:"Pending",value:notYet.length}].map(s=>(
            <div key={s.label} style={{flex:1,background:"rgba(255,255,255,0.15)",borderRadius:10,padding:"8px 4px",textAlign:"center"}}>
              <div style={{fontSize:16,fontWeight:800,color:"#fff"}}>{s.value}</div>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.65)",fontWeight:600}}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{padding:16,display:"flex",flexDirection:"column",gap:10}}>
        {submitted.length>0 && <>
          <div style={{fontSize:11,fontWeight:800,color:C.textMuted,textTransform:"uppercase",letterSpacing:0.8,marginBottom:2}}>Submitted</div>
          {submitted.map(s=>{
            const sub=subMap.get(s.id)!;
            const badge=statusBadge(sub.status);
            return (
              <button key={s.id} onClick={()=>openGrade(s)} style={{width:"100%",background:"#fff",borderRadius:14,padding:"14px 16px",border:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left",boxShadow:"0 1px 3px rgba(0,0,0,0.06)",borderLeft:`4px solid ${sub.status==="marked"?"#10b981":"#f59e0b"}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:800,color:C.textPrimary}}>{s.name}</div>
                    <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{s.admission_number}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:20,background:badge.bg,color:badge.color}}>{badge.label}</span>
                    {sub.mark!=null && <span style={{fontSize:12,fontWeight:800,color:C.accent}}>{sub.mark}pts</span>}
                    <span style={{color:C.textMuted,fontSize:14}}>›</span>
                  </div>
                </div>
              </button>
            );
          })}
        </>}
        {notYet.length>0 && <>
          <div style={{fontSize:11,fontWeight:800,color:C.textMuted,textTransform:"uppercase",letterSpacing:0.8,marginTop:8,marginBottom:2}}>Not Submitted</div>
          {notYet.map(s=>(
            <div key={s.id} style={{background:"#fff",borderRadius:14,padding:"14px 16px",boxShadow:"0 1px 3px rgba(0,0,0,0.06)",borderLeft:"4px solid #e5e7eb"}}>
              <div style={{fontSize:13,fontWeight:700,color:C.textMuted}}>{s.name}</div>
              <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{s.admission_number}</div>
            </div>
          ))}
        </>}
      </div>
    </div>
  );
}

export default function GradingPage() {
  return (
    <Suspense fallback={<div style={{padding:20,color:"#6b7280"}}>Loading…</div>}>
      <GradingInner />
    </Suspense>
  );
}

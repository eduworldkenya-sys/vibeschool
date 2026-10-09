"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { C } from "@/components/teacher/ui";
import { loadProgressAuthority, loadProgressRoster } from "@/lib/learner-intelligence/progress-data";

interface Student { id: string; name: string; admission_number: string; }
interface Submission { id: string; student_id: string; status: "pending"|"submitted"|"marked"; mark: number|null; feedback: string|null; notes: string|null; submitted_at: string|null; photo_url: string|null; }
interface ExInfo { title: string; instructions: string|null; }

type View = "list"|"grade";

const inp: React.CSSProperties = { width:"100%", padding:"11px 14px", borderRadius:10, border:"1px solid #e5e7eb", fontSize:14, color:C.textPrimary, outline:"none", fontFamily:"inherit", background:"#f9fafb", boxSizing:"border-box" };

function statusBadge(s: string) {
  if (s === "marked")    return { label: "Marked",    bg: "#e0f2fe", color: "#075985" };
  if (s === "submitted") return { label: "Done",      bg: "#fef3c7", color: "#92400e" };
  return                        { label: "Pending",   bg: "#f3f4f6", color: "#6b7280" };
}

function GradingInner() {
  const router  = useRouter();
  const params  = useParams();
  const classId = params.id as string;
  const exId    = params.exId as string;

  const [ex,        setEx]        = useState<ExInfo|null>(null);
  const [students,  setStudents]  = useState<Student[]>([]);
  const [subMap,    setSubMap]    = useState<Map<string,Submission>>(new Map());
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string|null>(null);
  const [view,      setView]      = useState<View>("list");
  const [active,    setActive]    = useState<Student|null>(null);
  const [feedback,  setFeedback]  = useState("");
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveOk,    setSaveOk]    = useState(false);
  const [bulkBusy,  setBulkBusy]  = useState(false);
  const [bulkMsg,   setBulkMsg]   = useState<string|null>(null);
  const schoolIdRef = useRef<string|null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    setView("list");
    setActive(null);
    try {

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadError("Not authenticated"); setLoading(false); return; }

    schoolIdRef.current = null;
    const authority = await loadProgressAuthority(classId);
    const roster = await loadProgressRoster(authority, false);
    const sid = authority.schoolId;
    schoolIdRef.current = sid;

    const [exRes, stuRes, subRes] = await Promise.all([
      supabase.from("exercises").select("title,instructions").eq("id", exId).eq("school_id",sid).eq("class_id",classId).single(),
      Promise.resolve({data:roster,error:null}),
      supabase.from("exercise_submissions").select("id,student_id,status,mark,feedback,notes,submitted_at,photo_url").eq("exercise_id",exId),
    ]);

    if (stuRes.error || subRes.error) { setLoadError("Could not load the current learners and submissions"); setLoading(false); return; }
    if (exRes.error) { setLoadError("Could not load exercise"); setLoading(false); return; }

    setEx(exRes.data as ExInfo);
    setStudents((stuRes.data??[]) as Student[]);

    const subs = (subRes.data??[]) as Submission[];
    const map = new Map<string,Submission>();
    for (const s of subs) map.set(s.student_id, s);
    setSubMap(map);
    setLoading(false);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "This class record could not be loaded. Try again.");
      setLoading(false);
    }
  }

  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => { loadRef.current(); }, [exId, classId]);

  function openGrade(student: Student) {
    const sub = subMap.get(student.id);
    setActive(student);
    setFeedback(sub?.feedback??"");
    setSaveOk(false);
    setSaveError("");
    setView("grade");
  }

  async function markDone() {
    if (!active) return;
    setSaveOk(false); setSaveError("");
    setSaving(true);
    try {
      const sub = subMap.get(active.id);
      const changes = { feedback: feedback.trim() || null, status: "marked" };
      let saved: Submission;
      if (!sub) {
        const response = await supabase.from("exercise_submissions").insert({
          exercise_id: exId, student_id: active.id, submitted_at: new Date().toISOString(), ...changes,
        }).select().single();
        if (response.error) throw response.error;
        if (!response.data) throw new Error("The saved record could not be confirmed. Retry before leaving this page.");
        saved = response.data as Submission;
      } else {
        const response = await supabase.from("exercise_submissions").update(changes).eq("id", sub.id).select().single();
        if (response.error) throw response.error;
        if (!response.data) throw new Error("The saved record could not be confirmed. Retry before leaving this page.");
        saved = response.data as Submission;
      }
      setSubMap(previous => new Map(previous).set(active.id, saved));
      setSaveOk(true);
    } catch (failure) {
      setSaveError(failure instanceof Error ? failure.message : "Your changes could not be saved. Your input is kept; try again.");
    } finally { setSaving(false); }
  }

  const done  = students.filter(s=>subMap.get(s.id)?.status==="marked");
  const notYet = students.filter(s=>subMap.get(s.id)?.status!=="marked");

  async function markAllDone() {
    const toMark = notYet.map(s => s.id);
    if (toMark.length === 0) { setBulkMsg("Everyone is already marked."); return; }
    setBulkBusy(true);
    setBulkMsg(null);

    const existing = notYet.filter(s => subMap.has(s.id));
    const missing   = notYet.filter(s => !subMap.has(s.id));

    try {
      if (existing.length > 0) {
        const response = await supabase.from("exercise_submissions")
          .update({ status: "marked", submitted_at: new Date().toISOString() })
          .in("id", existing.map(s => subMap.get(s.id)!.id)).select("id");
        if (response.error) throw response.error;
        if (response.data?.length !== existing.length) throw new Error("Some existing submissions could not be confirmed.");
      }
      if (missing.length > 0) {
        const response = await supabase.from("exercise_submissions").insert(
          missing.map(s => ({ exercise_id: exId, student_id: s.id, status: "marked", submitted_at: new Date().toISOString() }))
        ).select("id");
        if (response.error) throw response.error;
        if (response.data?.length !== missing.length) throw new Error("Some new submissions could not be confirmed.");
      }
      setBulkMsg(`Marked ${toMark.length} student(s) as done.`);
    } catch {
      setBulkMsg("Bulk marking could not be completed. The roster has been reloaded; review remaining learners before retrying.");
    } finally {
      await load();
      setBulkBusy(false);
    }
  }

  if (loading) return <div style={{padding:20,color:C.textMuted,fontFamily:"inherit"}}>Loading…</div>;
  if (loadError) return <div role="alert" style={{padding:20,color:"#ef4444",fontFamily:"inherit"}}><p>{loadError}</p><button type="button" onClick={() => void load()} style={{minHeight:44,padding:"10px 16px"}}>Try again</button></div>;

  if (view==="grade" && active) {
    const sub = subMap.get(active.id);
    return (
      <div style={{fontFamily:"inherit",paddingBottom:100,background:C.surface,minHeight:"100vh"}}>
        <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:16,padding:"20px 16px 24px"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <button aria-label="Back to exercise roster" onClick={()=>setView("list")} style={{background:C.surface,border:"none",borderRadius:10,width:44,height:44,color:C.textPrimary,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
            <div>
              <h1 style={{fontSize:22,fontWeight:750,color:C.textPrimary,margin:0}}>{active.name}</h1>
              <div style={{fontSize:12,color:C.textMuted}}>{active.admission_number} · {ex?.title}</div>
            </div>
          </div>
        </div>
        <div style={{padding:16,display:"flex",flexDirection:"column",gap:14}}>
          {sub?.notes && (
            <div style={{background:"#fff",borderRadius:14,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
              <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:0.8,marginBottom:8}}>Student Notes</div>
              <div style={{fontSize:13,color:C.textPrimary,background:"#f9fafb",borderRadius:10,padding:"10px 12px",lineHeight:1.6}}>{sub.notes}</div>
            </div>
          )}
          <div style={{background:"#fff",borderRadius:16,padding:"16px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
            <div style={{fontSize:11,fontWeight:800,color:C.textMuted,textTransform:"uppercase",letterSpacing:0.8,marginBottom:14}}>Feedback</div>
            <textarea aria-label="Feedback" value={feedback} onChange={e=>{setFeedback(e.target.value);setSaveOk(false);}} placeholder="Well done! / Try question 4 again…" rows={3} style={{...inp,resize:"vertical",marginBottom:14}} />
            {saveError && <p role="alert" style={{color:"#991b1b"}}>{saveError}</p>}
            {saveOk && <div style={{fontSize:12,color:"#075985",background:"#e0f2fe",borderRadius:10,padding:"8px 12px",marginBottom:10}}>✓ Marked done</div>}
            <button onClick={markDone} disabled={saving} style={{width:"100%",padding:"13px",borderRadius:12,border:"none",background:saving?C.accentLight:C.accent,color:"#fff",fontWeight:800,fontSize:14,cursor:saving?"not-allowed":"pointer",fontFamily:"inherit"}}>
              {saving?"Saving…":saveOk?"Update":"Mark Done"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{fontFamily:"inherit",paddingBottom:100,background:C.surface,minHeight:"100vh"}}>
      <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:16,padding:"20px 16px 28px"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
          <button aria-label="Back to exercises" onClick={()=>router.back()} style={{background:C.surface,border:"none",borderRadius:10,width:44,height:44,color:C.textPrimary,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
          <div>
            <h1 style={{fontSize:22,fontWeight:750,color:C.textPrimary,margin:0}}>{ex?.title}</h1>
            <div style={{fontSize:12,color:C.textMuted}}>In-class exercise</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          {[
            {label:"Students", value:students.length},
            {label:"Done",     value:done.length},
            {label:"Pending",  value:notYet.length},
          ].map(s=>(
            <div key={s.label} style={{flex:1,background:C.surface,borderRadius:10,padding:"8px 4px",textAlign:"center"}}>
              <div style={{fontSize:16,fontWeight:800,color:C.textPrimary}}>{s.value}</div>
              <div style={{fontSize:11,color:C.textMuted,fontWeight:600}}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{padding:16,display:"flex",flexDirection:"column",gap:10}}>
        {ex?.instructions && <details style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:14,padding:"0 16px"}}>
          <summary style={{minHeight:44,padding:"12px 0",cursor:"pointer",fontWeight:700,color:C.textPrimary}}>Exercise instructions</summary>
          <p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",lineHeight:1.6,color:C.textPrimary}}>{ex.instructions}</p>
        </details>}
        {students.length > 0 && (
          <button
            onClick={markAllDone}
            disabled={bulkBusy}
            style={{minHeight:44,padding:"10px",borderRadius:12,border:"none",background:"#e0f2fe",color:"#075985",fontWeight:700,fontSize:12,cursor:bulkBusy?"wait":"pointer",fontFamily:"inherit",marginBottom:4}}
          >
            {bulkBusy ? "Working…" : "✓ Mark All Done"}
          </button>
        )}
        {bulkMsg && (
          <div style={{fontSize:12,color:C.textMuted,textAlign:"center",marginBottom:4}}>{bulkMsg}</div>
        )}
        {done.length>0 && <>
          <div style={{fontSize:11,fontWeight:800,color:C.textMuted,textTransform:"uppercase",letterSpacing:0.8,marginBottom:2}}>Done</div>
          {done.map(s=>{
            const sub=subMap.get(s.id)!;
            const badge=statusBadge(sub.status);
            return (
              <button key={s.id} onClick={()=>openGrade(s)} style={{width:"100%",background:"#fff",borderRadius:14,padding:"14px 16px",border:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left",boxShadow:"0 1px 3px rgba(0,0,0,0.06)",borderLeft:"4px solid #0369a1"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:800,color:C.textPrimary}}>{s.name}</div>
                    <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{s.admission_number}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:11,fontWeight:700,padding:"3px 8px",borderRadius:20,background:badge.bg,color:badge.color}}>{badge.label}</span>
                    <span style={{color:C.textMuted,fontSize:14}}>›</span>
                  </div>
                </div>
              </button>
            );
          })}
        </>}
        {notYet.length>0 && <>
          <div style={{fontSize:11,fontWeight:800,color:C.textMuted,textTransform:"uppercase",letterSpacing:0.8,marginTop:8,marginBottom:2}}>Not Yet Done</div>
          {notYet.map(s=>(
            <button key={s.id} onClick={()=>openGrade(s)} style={{width:"100%",background:"#fff",borderRadius:14,padding:"14px 16px",border:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left",boxShadow:"0 1px 3px rgba(0,0,0,0.06)",borderLeft:"4px solid #e5e7eb"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:C.textMuted}}>{s.name}</div>
                  <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{s.admission_number}</div>
                </div>
                <span style={{fontSize:11,color:C.textMuted}}>Mark done ›</span>
              </div>
            </button>
          ))}
        </>}
      </div>
    </div>
  );
}

export default function GradingPage() {
  return (
    <Suspense fallback={<div style={{padding:20,color:"var(--teacher-muted, #627168)"}}>Loading…</div>}>
      <GradingInner />
    </Suspense>
  );
}

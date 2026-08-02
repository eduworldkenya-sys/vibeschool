"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { C } from "@/components/teacher/ui";

interface Student { id: string; name: string; admission_number: string; profile_id: string | null; }
interface Submission { id: string; student_id: string; status: "pending"|"submitted"|"marked"; mark: number|null; feedback: string|null; notes: string|null; submitted_at: string|null; photo_url: string|null; }
interface ProjInfo { title: string; description: string|null; due_date: string|null; status: string; }

type View = "list"|"grade";

const inp: React.CSSProperties = { width:"100%", padding:"11px 14px", borderRadius:10, border:"1px solid #e5e7eb", fontSize:14, color:C.textPrimary, outline:"none", fontFamily:"inherit", background:"#f9fafb", boxSizing:"border-box" };

function autoBand(mark: number): { label: string; bg: string; color: string } {
  if (mark >= 80) return { label: "Excellent",        bg: "#d1fae5", color: "#065f46" };
  if (mark >= 60) return { label: "Good",             bg: "#dbeafe", color: "#1e40af" };
  if (mark >= 40) return { label: "Fair",             bg: "#fef3c7", color: "#92400e" };
  return              { label: "Needs Improvement", bg: "#fee2e2", color: "#991b1b" };
}

function statusBadge(s: string, mark: number|null) {
  if (s === "marked" && mark !== null) {
    const band = autoBand(mark);
    return { label: `${mark}pts · ${band.label}`, bg: band.bg, color: band.color };
  }
  if (s === "marked")    return { label: "Marked",    bg: "#d1fae5", color: "#065f46" };
  if (s === "submitted") return { label: "Submitted", bg: "#fef3c7", color: "#92400e" };
  return                        { label: "Pending",   bg: "#f3f4f6", color: "#6b7280" };
}

function GradingInner() {
  const router  = useRouter();
  const params  = useParams();
  const classId = params.id as string;
  const projId  = params.projId as string;

  const [proj,      setProj]      = useState<ProjInfo|null>(null);
  const [students,  setStudents]  = useState<Student[]>([]);
  const [subMap,    setSubMap]    = useState<Map<string,Submission>>(new Map());
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string|null>(null);
  const [view,      setView]      = useState<View>("list");
  const [active,    setActive]    = useState<Student|null>(null);
  const [mark,      setMark]      = useState("");
  const [feedback,  setFeedback]  = useState("");
  const [saving,    setSaving]    = useState(false);
  const [saveOk,    setSaveOk]    = useState(false);
  const [bulkBusy,  setBulkBusy]  = useState(false);
  const [bulkMsg,   setBulkMsg]   = useState<string|null>(null);
  const schoolIdRef = useRef<string|null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadError("Not authenticated"); setLoading(false); return; }

    if (!schoolIdRef.current) {
      const { data: profile } = await supabase.from("profiles").select("school_id").eq("id", user.id).single();
      let sid = profile?.school_id ?? null;
      if (!sid) {
        const { data: cls } = await supabase.from("classes").select("school_id").eq("id", classId).single();
        sid = cls?.school_id ?? null;
      }
      schoolIdRef.current = sid;
    }
    const sid = schoolIdRef.current;

    const [projRes, stuRes, subRes] = await Promise.all([
      supabase.from("projects").select("title,description,due_date,status").eq("id", projId).single(),
      supabase.from("students").select("id,name,admission_number,profile_id").eq("class_id",classId).order("name"),
      supabase.from("project_submissions").select("id,student_id,status,mark,feedback,notes,submitted_at,photo_url").eq("project_id",projId),
    ]);

    if (projRes.error) { setLoadError("Could not load project"); setLoading(false); return; }

    setProj(projRes.data as ProjInfo);
    setStudents((stuRes.data??[]) as Student[]);

    const subs = (subRes.data??[]) as Submission[];
    const map = new Map<string,Submission>();
    for (const s of subs) map.set(s.student_id, s);
    setSubMap(map);
    setLoading(false);
  }

  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => { loadRef.current(); }, [projId, classId]);

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
    const markVal = mark!==""?Number(mark):null;
    if (markVal !== null && isNaN(markVal)) { setSaving(false); return; }

    if (!sub) {
      const { data: newSub, error: insErr } = await supabase.from("project_submissions").insert({
        project_id:   projId,
        student_id:   active.id,
        status:       "marked",
        submitted_at: new Date().toISOString(),
        mark:         markVal,
        feedback:     feedback.trim()||null,
      }).select().single();
      if (!insErr && newSub) {
        const updated = new Map(subMap);
        updated.set(active.id, newSub as Submission);
        setSubMap(updated);
        setSaveOk(true);
      }
      setSaving(false);
      return;
    }

    const {error} = await supabase.from("project_submissions")
      .update({ mark:markVal, feedback:feedback.trim()||null, status:"marked" })
      .eq("id",sub.id);
    if (!error) {
      const updated = new Map(subMap);
      updated.set(active.id,{...sub,mark:markVal,feedback:feedback.trim()||null,status:"marked"});
      setSubMap(updated);
      setSaveOk(true);
    }
    setSaving(false);
  }

  const markNum   = mark!==""?Number(mark):null;
  const liveBand  = markNum!==null && !isNaN(markNum) ? autoBand(markNum) : null;

  const submitted = students.filter(s=>subMap.has(s.id));
  const notYet    = students.filter(s=>!subMap.has(s.id));
  const marked    = submitted.filter(s=>subMap.get(s.id)?.status==="marked");

  const markedMarks = Array.from(subMap.values()).filter(s=>s.status==="marked"&&s.mark!==null).map(s=>s.mark as number);
  const avg = markedMarks.length>0 ? Math.round(markedMarks.reduce((a,b)=>a+b,0)/markedMarks.length) : null;

  async function markAllSubmittedAsReceived() {
    const toUpdate = submitted
      .filter(s => subMap.get(s.id)?.status === "pending")
      .map(s => subMap.get(s.id)!.id);
    if (toUpdate.length === 0) { setBulkMsg("Nothing to mark."); return; }
    setBulkBusy(true);
    setBulkMsg(null);
    const { error } = await supabase.from("project_submissions").update({ status: "submitted" }).in("id", toUpdate);
    if (error) {
      setBulkMsg("Could not update submissions.");
    } else {
      setBulkMsg(`Marked ${toUpdate.length} submission(s) as received.`);
      await load();
    }
    setBulkBusy(false);
  }

  async function remindNonSubmitters() {
    if (notYet.length === 0) { setBulkMsg("Everyone has submitted."); return; }
    setBulkBusy(true);
    setBulkMsg(null);
    try {
      const dueLabel = proj?.due_date ? new Date(proj.due_date).toLocaleDateString("en-KE",{day:"numeric",month:"short"}) : "soon";
      const msg = `Reminder: "${proj?.title ?? "Project"}" is due ${dueLabel}. Please submit.`;
      const linkedNotYet = notYet.filter(
        (s): s is typeof s & { profile_id: string } =>
          typeof s.profile_id === "string" && s.profile_id.length > 0
      );
      const { error } = linkedNotYet.length > 0
        ? await supabase.from("notifications").insert(
            linkedNotYet.map(s => ({
              user_id:   s.profile_id,
              school_id: schoolIdRef.current,
              type:      "project",
              title:     "Project Reminder",
              body:      msg,
              is_read:   false,
            }))
          )
        : { error: null };
      if (error) {
        setBulkMsg("Could not send reminders.");
      } else {
        setBulkMsg(`Reminder sent to ${notYet.length} student(s).`);
      }
    } catch (_) {
      setBulkMsg("Could not send reminders.");
    }
    setBulkBusy(false);
  }

  if (loading) return <div style={{padding:20,color:C.textMuted,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Loading…</div>;
  if (loadError) return <div style={{padding:20,color:"#ef4444",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{loadError}</div>;

  if (view==="grade" && active) {
    const sub = subMap.get(active.id);
    return (
      <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",paddingBottom:100,background:C.surface,minHeight:"100vh"}}>
        <div style={{background:"linear-gradient(135deg,#92400e,#d97706)",padding:"20px 16px 24px"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <button onClick={()=>setView("list")} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:10,width:36,height:36,color:"#fff",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
            <div>
              <div style={{fontSize:18,fontWeight:900,color:"#fff"}}>{active.name}</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.65)"}}>{active.admission_number} · {proj?.title}</div>
            </div>
          </div>
        </div>
        <div style={{padding:16,display:"flex",flexDirection:"column",gap:14}}>
          {!sub && (
            <div style={{background:"#fff",borderRadius:14,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
              <div style={{fontSize:12,color:C.textMuted}}>This student has not submitted — you can still record a mark below.</div>
            </div>
          )}
          {sub && (
            <div style={{background:"#fff",borderRadius:14,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
              <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:0.8,marginBottom:8}}>Student Work</div>
              <div style={{fontSize:12,color:C.textMuted,marginBottom:sub.photo_url||sub.notes?12:0}}>
                Submitted on {sub.submitted_at?new Date(sub.submitted_at).toLocaleDateString("en-KE",{day:"numeric",month:"short"}):"unknown date"}.
              </div>
              {sub.notes && (
                <div style={{fontSize:13,color:C.textPrimary,background:"#f9fafb",borderRadius:10,padding:"10px 12px",lineHeight:1.6,marginBottom:sub.photo_url?12:0}}>{sub.notes}</div>
              )}
              {sub.photo_url && (
                <img src={sub.photo_url} alt="Student submitted work" style={{width:"100%",borderRadius:10,objectFit:"cover",maxHeight:360,display:"block"}} />
              )}
              {!sub.photo_url && !sub.notes && (
                <div style={{fontSize:12,color:C.textMuted,fontStyle:"italic"}}>No photo or notes submitted.</div>
              )}
            </div>
          )}
          <div style={{background:"#fff",borderRadius:16,padding:"16px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
            <div style={{fontSize:11,fontWeight:800,color:C.textMuted,textTransform:"uppercase",letterSpacing:0.8,marginBottom:14}}>Grade</div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:0.8,marginBottom:6,display:"block"}}>Mark</label>
              <input type="number" value={mark} onChange={e=>setMark(e.target.value)} placeholder="e.g. 18" style={inp} />
              {liveBand && (
                <div style={{marginTop:8,display:"inline-flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:20,background:liveBand.bg,color:liveBand.color,fontSize:11,fontWeight:800}}>
                  {liveBand.label}
                </div>
              )}
            </div>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:0.8,marginBottom:6,display:"block"}}>Feedback</label>
              <textarea value={feedback} onChange={e=>setFeedback(e.target.value)} placeholder="Well done! / Add more detail on…" rows={3} style={{...inp,resize:"vertical"}} />
            </div>
            {saveOk && <div style={{fontSize:12,color:"#065f46",background:"#d1fae5",borderRadius:10,padding:"8px 12px",marginBottom:10}}>✓ Grade saved — student will see it now</div>}
            <button onClick={saveGrade} disabled={saving} style={{width:"100%",padding:"13px",borderRadius:12,border:"none",background:saving?"#fde68a":"#92400e",color:"#fff",fontWeight:800,fontSize:14,cursor:saving?"not-allowed":"pointer",fontFamily:"inherit"}}>
              {saving?"Saving…":saveOk?"Update Grade":"Save Grade"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",paddingBottom:100,background:C.surface,minHeight:"100vh"}}>
      <div style={{background:"linear-gradient(135deg,#92400e,#d97706)",padding:"20px 16px 28px"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
          <button onClick={()=>router.back()} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:10,width:36,height:36,color:"#fff",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
          <div>
            <div style={{fontSize:18,fontWeight:900,color:"#fff"}}>{proj?.title}</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.65)"}}>Due {proj?.due_date?new Date(proj.due_date).toLocaleDateString("en-KE",{day:"numeric",month:"short"}):"—"}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          {[
            {label:"Students", value:students.length},
            {label:"Submitted",value:submitted.length},
            {label:"Marked",   value:marked.length},
            {label:"Avg",      value:avg!==null?`${avg}pts`:"—"},
          ].map(s=>(
            <div key={s.label} style={{flex:1,background:"rgba(255,255,255,0.15)",borderRadius:10,padding:"8px 4px",textAlign:"center"}}>
              <div style={{fontSize:16,fontWeight:800,color:"#fff"}}>{s.value}</div>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.65)",fontWeight:600}}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{padding:16,display:"flex",flexDirection:"column",gap:10}}>
        {students.length > 0 && (
          <div style={{display:"flex",gap:8,marginBottom:4}}>
            <button
              onClick={markAllSubmittedAsReceived}
              disabled={bulkBusy}
              style={{flex:1,padding:"10px",borderRadius:12,border:"none",background:"#d1fae5",color:"#065f46",fontWeight:700,fontSize:12,cursor:bulkBusy?"wait":"pointer",fontFamily:"inherit"}}
            >
              {bulkBusy ? "Working…" : "✓ Mark All Received"}
            </button>
            <button
              onClick={remindNonSubmitters}
              disabled={bulkBusy}
              style={{flex:1,padding:"10px",borderRadius:12,border:"none",background:"#fef3c7",color:"#92400e",fontWeight:700,fontSize:12,cursor:bulkBusy?"wait":"pointer",fontFamily:"inherit"}}
            >
              {bulkBusy ? "Working…" : "🔔 Remind Non-Submitters"}
            </button>
          </div>
        )}
        {bulkMsg && (
          <div style={{fontSize:12,color:C.textMuted,textAlign:"center",marginBottom:4}}>{bulkMsg}</div>
        )}
        {submitted.length>0 && <>
          <div style={{fontSize:11,fontWeight:800,color:C.textMuted,textTransform:"uppercase",letterSpacing:0.8,marginBottom:2}}>Submitted</div>
          {submitted.map(s=>{
            const sub=subMap.get(s.id)!;
            const badge=statusBadge(sub.status,sub.mark);
            return (
              <button key={s.id} onClick={()=>openGrade(s)} style={{width:"100%",background:"#fff",borderRadius:14,padding:"14px 16px",border:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left",boxShadow:"0 1px 3px rgba(0,0,0,0.06)",borderLeft:`4px solid ${sub.status==="marked"?"#10b981":"#f59e0b"}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:800,color:C.textPrimary}}>{s.name}</div>
                    <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{s.admission_number}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:20,background:badge.bg,color:badge.color}}>{badge.label}</span>
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
            <button key={s.id} onClick={()=>openGrade(s)} style={{width:"100%",background:"#fff",borderRadius:14,padding:"14px 16px",border:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left",boxShadow:"0 1px 3px rgba(0,0,0,0.06)",borderLeft:"4px solid #e5e7eb"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:C.textMuted}}>{s.name}</div>
                  <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{s.admission_number}</div>
                </div>
                <span style={{fontSize:11,color:C.textMuted}}>Mark manually ›</span>
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
    <Suspense fallback={<div style={{padding:20,color:"#6b7280"}}>Loading…</div>}>
      <GradingInner />
    </Suspense>
  );
}

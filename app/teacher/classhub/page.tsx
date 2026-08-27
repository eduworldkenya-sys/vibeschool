"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type TeacherClass = {
  id: string;
  class_id: string;
  subject_id: string;
  is_class_teacher: boolean;
  classes: { name: string; stream: string | null } | null;
  subjects: { name: string } | null;
};

const GRADES = ["Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9","Grade 10","Grade 11","Grade 12","Form 1","Form 2","Form 3","Form 4"];
const COMMON_SUBJECTS = ["English","Kiswahili","Mathematics","Biology","Chemistry","Physics","History and Government","Geography","CRE","IRE","Business Studies","Agriculture","Computer Studies"];

export default function ClassHubPage() {
  const router = useRouter();
  const [rows, setRows] = useState<TeacherClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [grade, setGrade] = useState("Form 4");
  const [stream, setStream] = useState("");
  const [subject, setSubject] = useState("History and Government");

  async function loadClasses() {
    setLoading(true);
    setError("");
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) { router.replace("/login?redirect=/teacher/classhub"); return; }
    const { data, error: queryError } = await supabase
      .from("teacher_classes")
      .select("id,class_id,subject_id,is_class_teacher,classes(name,stream),subjects(name)")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: true });
    if (queryError) setError(queryError.message);
    setRows((data as unknown as TeacherClass[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void loadClasses(); }, []);

  const sorted = useMemo(() => [...rows].sort((a,b) => `${a.classes?.name ?? ""}${a.classes?.stream ?? ""}`.localeCompare(`${b.classes?.name ?? ""}${b.classes?.stream ?? ""}`)), [rows]);

  async function addClass() {
    setSaving(true); setError("");
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) { setSaving(false); router.replace("/login?redirect=/teacher/classhub"); return; }
    const { data: profile, error: profileError } = await supabase.from("profiles").select("school_id").eq("id", user.id).single();
    if (profileError || !profile?.school_id) { setError("Your teacher account is not attached to a school yet."); setSaving(false); return; }
    const { error: rpcError } = await supabase.rpc("onboard_teacher_class", {
      p_school_id: profile.school_id,
      p_teacher_id: user.id,
      p_grade: grade,
      p_stream: stream.trim(),
      p_subject: subject,
    });
    if (rpcError) { setError(rpcError.message); setSaving(false); return; }
    setShowAdd(false); setSaving(false); await loadClasses();
  }

  return <main style={{maxWidth:900,margin:"0 auto",padding:"24px 16px 110px"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:24}}>
      <div><p style={{margin:0,fontSize:13,fontWeight:800,color:"#64748b",textTransform:"uppercase"}}>Teacher OS</p><h1 style={{margin:"4px 0 0",fontSize:30}}>My Classes</h1></div>
      <button onClick={() => setShowAdd(v => !v)} style={{border:0,borderRadius:12,padding:"12px 16px",fontWeight:800,background:"#0f172a",color:"white"}}>+ Add class</button>
    </div>

    {showAdd && <section style={{border:"1px solid #e2e8f0",borderRadius:18,padding:18,marginBottom:22,background:"white"}}>
      <h2 style={{marginTop:0}}>Add a teaching class</h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
        <label>Grade/Form<select value={grade} onChange={e=>setGrade(e.target.value)} style={{display:"block",width:"100%",padding:11,marginTop:6}}>{GRADES.map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Stream<input value={stream} onChange={e=>setStream(e.target.value)} placeholder="e.g. East (optional)" style={{display:"block",width:"100%",padding:11,marginTop:6,boxSizing:"border-box"}} /></label>
        <label>Subject<select value={subject} onChange={e=>setSubject(e.target.value)} style={{display:"block",width:"100%",padding:11,marginTop:6}}>{COMMON_SUBJECTS.map(x=><option key={x}>{x}</option>)}</select></label>
      </div>
      <button disabled={saving} onClick={addClass} style={{marginTop:16,border:0,borderRadius:10,padding:"11px 16px",fontWeight:800,background:"#059669",color:"white"}}>{saving ? "Saving…" : "Save class"}</button>
    </section>}

    {error && <div role="alert" style={{padding:14,borderRadius:12,background:"#fef2f2",color:"#991b1b",marginBottom:18}}>{error}</div>}
    {loading ? <p>Loading your classes…</p> : sorted.length === 0 ? <section style={{padding:28,border:"1px dashed #cbd5e1",borderRadius:18,textAlign:"center"}}><h2>No classes yet</h2><p>Add the class and subject you teach. It will then be available to schemes, lessons and assessments.</p><button onClick={()=>setShowAdd(true)}>Add my first class</button></section> :
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:14}}>{sorted.map(row => <article key={row.id} style={{border:"1px solid #e2e8f0",borderRadius:16,padding:18,background:"white"}}>
        <p style={{margin:0,color:"#64748b",fontSize:13,fontWeight:700}}>{row.subjects?.name ?? "Subject"}</p>
        <h2 style={{margin:"6px 0 4px"}}>{row.classes?.name ?? "Class"}{row.classes?.stream ? ` · ${row.classes.stream}` : ""}</h2>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:16}}>
          <button onClick={()=>router.push(`/teacher/scheme?classId=${row.class_id}&subjectId=${row.subject_id}`)} style={{padding:"9px 12px",borderRadius:9,border:"1px solid #cbd5e1",background:"white",fontWeight:700}}>Scheme of work</button>
          <button onClick={()=>router.push(`/teacher/assessment?classId=${row.class_id}&subjectId=${row.subject_id}`)} style={{padding:"9px 12px",borderRadius:9,border:"1px solid #cbd5e1",background:"white",fontWeight:700}}>Assess</button>
        </div>
      </article>)}</div>}
  </main>;
}

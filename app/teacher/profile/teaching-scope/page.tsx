"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Assignment={assignment_id:string;class_id:string;class_name:string;stream:string|null;subject_id:string;subject_name:string;curriculum_valid?:boolean;curriculum_state?:string};
type Context={school_id:string|null;state:string;classes:Assignment[]};
type SubjectAuthority={state?:string;subjects?:string[]};

export default function TeachingScopePage(){
 const router=useRouter();
 const [ctx,setCtx]=useState<Context|null>(null),[choices,setChoices]=useState<Record<string,string[]>>({}),[selected,setSelected]=useState<Record<string,string>>({}),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  const auth=await supabase.auth.getUser(); if(auth.error||!auth.data.user){router.replace("/login");return}
  const res=await supabase.rpc("teacher_get_operating_context" as never,{} as never);
  if(res.error){setError("Your teaching scope could not be loaded.");setLoading(false);return}
  const next=res.data as Context; setCtx(next);
  const invalid=(next.classes??[]).filter(a=>a.curriculum_state==="needs_reconciliation"||a.curriculum_valid===false);
  const pairs=await Promise.all(invalid.map(async a=>{
   const r=await supabase.rpc("get_allowed_teaching_subjects" as never,{p_school_id:next.school_id,p_grade:a.class_name} as never);
   const d=r.data as SubjectAuthority|null; return [a.assignment_id,r.error?[]:(d?.subjects??[])] as const;
  }));
  setChoices(Object.fromEntries(pairs));setLoading(false);
 },[router]);
 useEffect(()=>{void load()},[load]);
 async function reconcile(a:Assignment){
  const subject=selected[a.assignment_id]; if(!subject||busy)return;
  if(!window.confirm(`Change ${a.class_name}${a.stream?` ${a.stream}`:""} from ${a.subject_name} to ${subject}? Historical lesson and assessment records keep their original subject identity.`))return;
  setBusy(a.assignment_id);setError("");
  const r=await supabase.rpc("teacher_reconcile_class_subject" as never,{p_assignment_id:a.assignment_id,p_subject:subject} as never);
  if(r.error)setError(r.error.message.includes("invalid_subject_for_level")?"That subject is not valid for this level. Refresh and choose again.":"Teaching scope could not be corrected. No historical records were changed.");
  else await load();
  setBusy(null);
 }
 const invalid=(ctx?.classes??[]).filter(a=>a.curriculum_state==="needs_reconciliation"||a.curriculum_valid===false);
 return <section style={{maxWidth:760,margin:"0 auto",padding:"18px 14px 110px"}}>
  <Link href="/teacher/profile" style={{fontSize:14,fontWeight:700,color:"var(--teacher-ink, #1c2923)",textDecoration:"none"}}>← Back</Link>
  <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,margin:"18px 0 20px"}}><h1 style={{margin:0,fontSize:25}}>My subjects</h1><Link href="/teacher/classhub/add" style={{padding:"12px 16px",borderRadius:12,background:"var(--teacher-ink, #1c2923)",color:"#fff",fontWeight:800,textDecoration:"none",whiteSpace:"nowrap"}}>+ Add</Link></header>
  {!loading&&(ctx?.classes??[]).length>0&&<div style={{display:"grid",gap:8,marginBottom:18}}>{(ctx?.classes??[]).map(a=><div key={a.assignment_id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"13px 14px",border:"1px solid var(--teacher-border, #e5e7eb)",borderRadius:13}}><div><strong>{a.subject_name}</strong><div style={{fontSize:13,opacity:.7}}>{a.class_name}{a.stream?` · ${a.stream}`:""}</div></div>{(a.curriculum_state==="needs_reconciliation"||a.curriculum_valid===false)&&<span style={{fontSize:12,fontWeight:800,color:"#991b1b"}}>Change below</span>}</div>)}</div>}
  {error&&<div role="alert" style={{padding:12,borderRadius:12,background:"#fef2f2",color:"#991b1b",marginBottom:12}}>{error}</div>}
  {loading?<div style={{padding:18}}>Loading…</div>:invalid.length===0?<section style={{padding:18,borderRadius:16,background:"#ecfdf5",color:"#065f46"}}><strong>All set</strong></section>:<>
   <div style={{fontSize:13,color:"var(--teacher-muted, #627168)",marginBottom:10}}>{invalid.length} to change</div>
   <div style={{display:"grid",gap:12}}>{invalid.map(a=><section key={a.assignment_id} style={{padding:15,border:"1px solid #fecaca",borderRadius:16,background:"#fff"}}>
    <div style={{fontSize:15,fontWeight:750}}>{a.class_name}{a.stream?` · ${a.stream}`:""}</div><div style={{fontSize:13,color:"#991b1b",marginTop:5}}><strong>{a.subject_name}</strong> · Invalid for this grade</div>
    <label style={{display:"grid",gap:6,marginTop:13,fontSize:12,fontWeight:800,color:"#4b5563"}}>Change to
     <select value={selected[a.assignment_id]??""} onChange={e=>setSelected(s=>({...s,[a.assignment_id]:e.target.value}))} style={{minHeight:46,border:"1px solid #d1d5db",borderRadius:11,padding:"0 11px",background:"#fff"}}>
      <option value="">Select subject</option>{(choices[a.assignment_id]??[]).map(s=><option key={s} value={s}>{s}</option>)}
     </select>
    </label>
    <button onClick={()=>void reconcile(a)} disabled={!selected[a.assignment_id]||busy===a.assignment_id} style={{marginTop:10,minHeight:44,width:"100%",border:0,borderRadius:11,background:!selected[a.assignment_id]?"#9ca3af":"#4338ca",color:"#fff",fontWeight:750}}>{busy===a.assignment_id?"Saving…":"Save"}</button>

   </section>)}</div>
  </>}
 </section>
}
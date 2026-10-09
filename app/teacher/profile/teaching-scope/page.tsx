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
  <Link href="/teacher/profile" style={{fontSize:13,fontWeight:800,color:"#4338ca",textDecoration:"none"}}>← Back to profile</Link>
  <header style={{margin:"16px 0",padding:18,borderRadius:20,background:"var(--teacher-ink, #1c2923)",color:"#fff"}}><div style={{fontSize:11,fontWeight:750,opacity:.65}}>TEACHING SCOPE</div><h1 style={{margin:"5px 0",fontSize:24}}>Curriculum alignment</h1><p style={{margin:0,fontSize:13,lineHeight:1.55,opacity:.8}}>Your assigned teaching subjects must match the curriculum for each level. This does not limit the books, resources or content you can explore in VibeSchool.</p></header>
  {error&&<div role="alert" style={{padding:12,borderRadius:12,background:"#fef2f2",color:"#991b1b",marginBottom:12}}>{error}</div>}
  {loading?<div style={{padding:18}}>Checking teaching scope…</div>:invalid.length===0?<section style={{padding:18,borderRadius:16,background:"#ecfdf5",color:"#065f46"}}><strong>Teaching scope is aligned.</strong><div style={{fontSize:13,marginTop:5}}>All current class-subject assignments match curriculum authority.</div></section>:<>
   <div style={{fontSize:13,color:"var(--teacher-muted, #627168)",marginBottom:10}}>{invalid.length} assignment{invalid.length===1?"":"s"} need correction. VibeSchool will not guess the replacement.</div>
   <div style={{display:"grid",gap:12}}>{invalid.map(a=><section key={a.assignment_id} style={{padding:15,border:"1px solid #fecaca",borderRadius:16,background:"#fff"}}>
    <div style={{fontSize:15,fontWeight:750}}>{a.class_name}{a.stream?` · ${a.stream}`:""}</div><div style={{fontSize:13,color:"#991b1b",marginTop:5}}>Current subject: <strong>{a.subject_name}</strong> — not valid for this level.</div>
    <label style={{display:"grid",gap:6,marginTop:13,fontSize:12,fontWeight:800,color:"#4b5563"}}>Correct teaching subject
     <select value={selected[a.assignment_id]??""} onChange={e=>setSelected(s=>({...s,[a.assignment_id]:e.target.value}))} style={{minHeight:46,border:"1px solid #d1d5db",borderRadius:11,padding:"0 11px",background:"#fff"}}>
      <option value="">Choose the subject you actually teach</option>{(choices[a.assignment_id]??[]).map(s=><option key={s} value={s}>{s}</option>)}
     </select>
    </label>
    <button onClick={()=>void reconcile(a)} disabled={!selected[a.assignment_id]||busy===a.assignment_id} style={{marginTop:10,minHeight:44,width:"100%",border:0,borderRadius:11,background:!selected[a.assignment_id]?"#9ca3af":"#4338ca",color:"#fff",fontWeight:750}}>{busy===a.assignment_id?"Correcting…":"Confirm teaching subject"}</button>
    <p style={{fontSize:11,color:"var(--teacher-muted, #627168)",lineHeight:1.5,marginBottom:0}}>This updates the current assignment only. Existing Scheme, lesson and assessment history is not relabelled.</p>
   </section>)}</div>
  </>}
 </section>
}
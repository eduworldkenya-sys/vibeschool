"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";
type Invite={id:string;token:string|null;student:string|null;status:string;created_at:string};
const card:React.CSSProperties={background:"#fff",border:"1px solid #dfe5de",borderRadius:16,padding:16};
export default function TuitionStudents(){
 const [rows,setRows]=useState<Invite[]>([]),[state,setState]=useState("loading"),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const load=useCallback(async()=>{setState("loading");const db=getSupabaseClient();const {data:auth}=await db.auth.getUser();if(!auth.user){window.location.assign("/login?redirect=%2Fteacher%2Ftutoring%2Fstudents");return;}
 const {data,error}=await db.rpc("vibetutor_my_student_invites");if(error){setError("Could not load tuition students. Check that the invitation database update is installed.");setState("error");return;}setRows((data??[]) as Invite[]);setState("ready");},[]);
 useEffect(()=>{void load()},[load]);
 async function create(){setBusy(true);setError("");const {error}=await getSupabaseClient().rpc("vibetutor_create_student_invite");setBusy(false);if(error){setError("Could not create invitation. Create a tutor listing first.");return;}await load();}
 async function revoke(id:string){setBusy(true);setError("");const {error}=await getSupabaseClient().rpc("vibetutor_revoke_student_invite",{p_id:id});setBusy(false);if(error)setError("Could not remove invitation.");else await load();}
 async function share(token:string){const url=window.location.origin+"/student/tutoring?invite="+encodeURIComponent(token);try{await navigator.clipboard.writeText(url);}catch{setError("Copy failed. Please use your browser's share options.");}}
 return <main style={{maxWidth:720,margin:"0 auto",padding:"20px 14px 110px",display:"grid",gap:12,color:"#17251c"}}>
 <Link href="/teacher/tutoring">← My Tutoring</Link><h1 style={{fontSize:26}}>My tuition students</h1>
 <p style={{color:"#536159",fontSize:14}}>Invite an existing VibeSchool student. They keep their own account; school records remain private. Learners under 18 require linked guardian approval.</p>
 <button type="button" onClick={()=>void create()} disabled={busy||state!=="ready"} style={{padding:14,background:"#087451",color:"#fff",border:0,borderRadius:12,fontWeight:750}}>{busy?"Working…":"Create invitation link"}</button>
 {error&&<p role="alert" style={{color:"#b91c1c"}}>{error}</p>}
 {state==="loading"&&<p role="status">Loading invitations…</p>}
 {state==="error"&&<button onClick={()=>void load()}>Retry</button>}
 {state==="ready"&&rows.length===0&&<section style={card}>No tuition students or invitations yet.</section>}
 {state==="ready"&&rows.map(r=><section key={r.id} style={card}>
 <strong>{r.student||"Invitation not claimed"}</strong>
 <p style={{fontSize:13,color:"#536159"}}>Status: {r.status==="accepted"?"Active tuition student":r.status==="pending_guardian"?"Awaiting guardian approval":r.status==="open"?"Awaiting student":r.status}</p>
 <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
 {r.status==="open"&&r.token&&<button type="button" onClick={()=>void share(r.token!)} style={{padding:10,borderRadius:10,border:"1px solid #087451",background:"#fff",color:"#087451",fontWeight:750}}>Copy invitation link</button>}
 {["open","pending_guardian","accepted"].includes(r.status)&&<button type="button" disabled={busy} onClick={()=>void revoke(r.id)} style={{padding:10,borderRadius:10,border:"1px solid #ddd",background:"#fff"}}>Remove</button>}
 </div></section>)}
 </main>;
}

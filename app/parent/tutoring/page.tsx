"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {getSupabaseClient} from "@/lib/supabase";
type Invite={id:string;student:string;tutor:string;status:string};
export default function GuardianTuition(){
 const [rows,setRows]=useState<Invite[]>([]),[status,setStatus]=useState("loading"),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState("");
 const load=useCallback(async()=>{setStatus("loading");const db=getSupabaseClient();const {data:auth}=await db.auth.getUser();if(!auth.user){window.location.assign("/login?redirect=%2Fparent%2Ftutoring");return;}
 const {data,error}=await db.rpc("vibetutor_parent_student_invites");if(error){setError("Could not load tuition requests.");setStatus("error");return;}setRows((data??[]) as Invite[]);setStatus("ready");},[]);
 useEffect(()=>{void load()},[load]);
 async function decide(id:string,approve:boolean){setBusy(id);setError("");const {error}=await getSupabaseClient().rpc("vibetutor_decide_student_invite",{p_id:id,p_approve:approve});setBusy(null);if(error){setError("Could not update this request.");return;}await load();}
 return <main style={{maxWidth:700,margin:"20px auto",padding:16,display:"grid",gap:14}}>
 <Link href="/parent">← Parent account</Link><h1>Tuition approvals</h1><p style={{fontSize:14}}>Review requests from your linked children. Approval connects the learner to the tutor for independent tuition only; school information is not shared.</p>
 {error&&<p role="alert" style={{color:"#b91c1c"}}>{error}</p>}
 {status==="loading"&&<p role="status">Loading requests…</p>}
 {status==="error"&&<button onClick={()=>void load()}>Retry</button>}
 {status==="ready"&&rows.length===0&&<p>No tuition approvals awaiting your decision.</p>}
 {status==="ready"&&rows.map(r=><section key={r.id} style={{padding:18,background:"#fff",color:"#17251c",border:"1px solid #ddd",borderRadius:16}}>
 <h2 style={{fontSize:17}}>{r.student}</h2><p>Requested tutor: <strong>{r.tutor}</strong></p>
 <p style={{fontSize:12}}>Confirm this teacher and arrangements independently before approving.</p>
 <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
 <button disabled={busy!==null} onClick={()=>void decide(r.id,true)} style={{padding:12,background:"#087451",color:"white",border:0,borderRadius:10}}>Approve</button>
 <button disabled={busy!==null} onClick={()=>void decide(r.id,false)} style={{padding:12,background:"white",border:"1px solid #aaa",borderRadius:10}}>Decline</button>
 </div></section>)}
 </main>;
}

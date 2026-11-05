"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import {useSearchParams} from "next/navigation";
import {getSupabaseClient} from "@/lib/supabase";
export default function StudentTuition(){
 const params=useSearchParams();const [token,setToken]=useState("");const [busy,setBusy]=useState(false);const [notice,setNotice]=useState("");const [error,setError]=useState("");
 useEffect(()=>{setToken(params.get("invite")||"")},[params]);
 async function accept(){setBusy(true);setError("");setNotice("");const db=getSupabaseClient();const {data:auth}=await db.auth.getUser();if(!auth.user){window.location.assign("/login?redirect="+encodeURIComponent("/student/tutoring?invite="+token));return;}
 const {data,error}=await db.rpc("vibetutor_claim_student_invite",{p_token:token.trim()});setBusy(false);
 if(error){setError("This invitation could not be accepted. Confirm the link is valid and you are signed into your learner account.");return;}
 setNotice(data==="accepted"?"You are now connected to your tuition teacher.":"Request received. A linked parent or guardian must approve before tutoring becomes active.");
 }
 return <main style={{maxWidth:620,margin:"20px auto",padding:20,background:"var(--vs-surface, #fff)",border:"1px solid var(--vs-border, #ddd)",borderRadius:18,color:"var(--vs-text, #17251c)"}}>
 <Link href="/student/profile">← My profile</Link><h1 style={{fontSize:25,margin:"18px 0 8px"}}>My tuition</h1><p style={{fontSize:14,lineHeight:1.6}}>Your teacher can invite you to private tuition. Accept only if you recognize the teacher and agree to the arrangement. School records are not shared.</p>
 <label style={{display:"grid",gap:7,fontSize:13,fontWeight:700}}>Invitation code<input value={token} onChange={e=>setToken(e.target.value.trim())} placeholder="Paste the invitation code" style={{padding:13,border:"1px solid #bbb",borderRadius:10,color:"#111827",background:"#fff"}} /></label>
 <button disabled={busy||!/^[0-9a-f-]{36}$/i.test(token)} onClick={()=>void accept()} style={{display:"block",marginTop:14,padding:13,border:0,borderRadius:10,background:"#5b4ee8",color:"#fff",fontWeight:750}}>{busy?"Checking…":"Accept tuition invitation"}</button>
 {error&&<p role="alert" style={{color:"#ef4444",marginTop:12}}>{error}</p>}{notice&&<p role="status" style={{marginTop:12}}>{notice}</p>}
 <p style={{fontSize:12,marginTop:18}}>If you are under 18, your linked parent or guardian must approve from their VibeSchool account.</p>
 </main>;
}

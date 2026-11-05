"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";
type Invite={id:string;tutor:string;status:string;created_at:string};
const panel:React.CSSProperties={border:"1px solid var(--vs-border, #dcdce8)",borderRadius:14,padding:15,background:"var(--vs-surface, #fff)"};
export default function StudentTuition(){
 const [rows,setRows]=useState<Invite[]>([]),[code,setCode]=useState("");
 const [token,setToken]=useState(""),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [notice,setNotice]=useState(""),[error,setError]=useState("");
 const load=useCallback(async()=>{setLoading(true);setError("");const db=getSupabaseClient();
 const {data:auth,error:authError}=await db.auth.getUser();
 if(authError||!auth.user){window.location.assign("/login?redirect=%2Fstudent%2Ftutoring");return;}
 const [codeRes,inboxRes]=await Promise.all([db.rpc("vibetutor_my_student_code"),db.rpc("vibetutor_student_inbox")]);
 if(codeRes.error||inboxRes.error){setError("Could not load your tuition invitations.");setLoading(false);return;}
 setCode(String(codeRes.data||""));setRows((inboxRes.data??[]) as Invite[]);setLoading(false);},[]);
 useEffect(()=>{setToken(new URLSearchParams(window.location.search).get("invite")||"");void load();},[load]);
 async function respond(id:string,accept:boolean){setBusy(true);setError("");const {data,error}=await getSupabaseClient().rpc("vibetutor_respond_student_invite",{p_id:id,p_accept:accept});setBusy(false);
 if(error){setError("Could not update this invitation.");return;}
 setNotice(data==="pending_guardian"?"Request accepted. Waiting for your linked parent or guardian to approve.":data==="accepted"?"You are now connected to your tutor.":"Invitation declined.");await load();}
 async function claimLink(){setBusy(true);setError("");const {data,error}=await getSupabaseClient().rpc("vibetutor_claim_student_invite",{p_token:token});setBusy(false);
 if(error){setError("The invitation link is invalid or no longer available.");return;}
 setToken("");setNotice(data==="accepted"?"Tuition connected.":"Invitation received. A linked parent or guardian must approve.");await load();}
 async function copy(){try{await navigator.clipboard.writeText(code);setNotice("Student code copied.");}catch{setError("Could not copy the code. You can select it manually.");}}
 return <main style={{maxWidth:650,margin:"16px auto",display:"grid",gap:14,padding:"10px 10px 80px",color:"var(--vs-text, #17251c)"}}>
 <Link href="/student/profile">← My profile</Link>
 <div><h1 style={{fontSize:26,margin:"4px 0"}}>My Tuition</h1><p style={{fontSize:13,opacity:.75}}>Tuition invitations from your teachers appear here.</p></div>
 {error&&<p role="alert" style={{color:"#dc2626"}}>{error}</p>}{notice&&<p role="status">{notice}</p>}
 {loading?<section role="status" style={panel}>Loading tuition invitations…</section>:<>
 <section style={panel} aria-label="Tuition invitations"><h2 style={{margin:"0 0 12px",fontSize:17}}>Invitations</h2>
 {rows.filter(r=>r.status==="invited").length===0&&<p style={{fontSize:13,opacity:.75}}>No new invitations yet.</p>}
 {rows.filter(r=>r.status==="invited").map(r=><div key={r.id} style={{padding:"12px 0",borderTop:"1px solid #d9dce3"}}>
 <strong>{r.tutor}</strong><p style={{fontSize:13}}>Invited you to join private tuition.</p>
 <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
 <button disabled={busy} onClick={()=>void respond(r.id,true)} style={{minHeight:44,padding:"9px 18px",border:0,borderRadius:10,background:"#5b4ee8",color:"#fff",fontWeight:750}}>Accept</button>
 <button disabled={busy} onClick={()=>void respond(r.id,false)} style={{minHeight:44,padding:"9px 18px",border:"1px solid #aaa",borderRadius:10,background:"#fff",color:"#17251c"}}>Decline</button></div></div>)}
 </section>
 {rows.some(r=>r.status==="accepted"||r.status==="pending_guardian")&&<section style={panel}><h2 style={{fontSize:17,margin:"0 0 10px"}}>My tutors</h2>
 {rows.filter(r=>r.status!=="invited").map(r=><p key={r.id} style={{fontSize:14}}><strong>{r.tutor}</strong> · {r.status==="accepted"?"Connected":"Awaiting guardian approval"}</p>)}</section>}
 <section style={panel}><h2 style={{fontSize:17,marginTop:0}}>My student code</h2>
 <p style={{fontSize:13,opacity:.75}}>Share this private code only with a tutor you trust. They can invite you directly to this inbox.</p>
 <div style={{display:"flex",alignItems:"center",gap:9,flexWrap:"wrap"}}><code style={{padding:9,background:"#eef2ff",borderRadius:8,color:"#1e1b4b",fontSize:15,letterSpacing:".04em",userSelect:"all"}}>{code}</code>
 <button onClick={()=>void copy()} style={{minHeight:44,padding:"9px 15px",borderRadius:10,border:"1px solid #888",background:"#fff",color:"#17251c"}}>Copy</button></div></section>
 {token&&<section style={panel}><h2 style={{fontSize:17}}>Invitation link</h2><p style={{fontSize:13}}>Accept the tuition invitation shared by your teacher.</p><button disabled={busy} onClick={()=>void claimLink()} style={{padding:12,background:"#5b4ee8",color:"#fff",border:0,borderRadius:10}}>Accept linked invitation</button></section>}
 <p style={{fontSize:12,opacity:.75}}>For learners under 18, connection requires approval from a linked parent or guardian. School records remain separate.</p>
 </>}
 </main>;
}

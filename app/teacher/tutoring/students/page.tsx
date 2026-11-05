"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";
type Invite={id:string;token:string|null;student:string|null;status:string;created_at:string};
type Student={id:string;name:string};
const card:React.CSSProperties={background:"#fff",border:"1px solid #dfe5de",borderRadius:16,padding:16};
const action:React.CSSProperties={minHeight:44,padding:"10px 16px",borderRadius:10,border:0,background:"#087451",color:"#fff",fontWeight:750,cursor:"pointer"};
export default function TuitionStudents(){
 const [rows,setRows]=useState<Invite[]>([]),[query,setQuery]=useState(""),[matches,setMatches]=useState<Student[]>([]);
 const [selected,setSelected]=useState<Student|null>(null),[searched,setSearched]=useState(false);
 const [notice,setNotice]=useState(""),[state,setState]=useState("loading"),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const load=useCallback(async()=>{setState("loading");const db=getSupabaseClient();const {data:auth}=await db.auth.getUser();if(!auth.user){window.location.assign("/login?redirect=%2Fteacher%2Ftutoring%2Fstudents");return;}
 const {data,error}=await db.rpc("vibetutor_my_student_invites");if(error){setError("Could not load tuition students.");setState("error");return;}setRows(data??[]);setState("ready");},[]);
 useEffect(()=>{void load()},[load]);
 async function search(){const q=query.trim();if(q.length<3)return;setBusy(true);setError("");setNotice("");setSelected(null);
 const {data,error}=await getSupabaseClient().rpc("vibetutor_search_students",{p_query:q});setBusy(false);setSearched(true);
 if(error){setMatches([]);setError("Student search unavailable. Check your tutor listing or try again later.");return;}
 setMatches(data??[]);
 }
 async function invite(){if(!selected)return;setBusy(true);setError("");setNotice("");
 const {error}=await getSupabaseClient().rpc("vibetutor_invite_student",{p_student_id:selected.id});setBusy(false);
 if(error){setError("Invitation not sent. The student may already be invited or your limit has been reached.");return;}
 setNotice("Invitation sent to "+selected.name+". They can accept in My Tuition.");
 setSelected(null);setMatches([]);setQuery("");setSearched(false);await load();
 }
 async function revoke(id:string){setBusy(true);setError("");const {error}=await getSupabaseClient().rpc("vibetutor_revoke_student_invite",{p_id:id});setBusy(false);if(error)setError("Could not remove invitation.");else await load();}
 return <main style={{maxWidth:720,margin:"0 auto",padding:"20px 14px 110px",display:"grid",gap:12,color:"#17251c"}}>
 <Link href="/teacher/tutoring">← My Tutoring</Link><h1 style={{fontSize:26}}>My tuition students</h1>
 <section style={card} aria-label="Invite a student">
 <h2 style={{margin:"0 0 8px",fontSize:18}}>Add student</h2>
 <label htmlFor="tuition-student-search" style={{display:"block",fontSize:13,marginBottom:7}}>Search by student name</label>
 <form onSubmit={e=>{e.preventDefault();void search()}} style={{display:"flex",gap:8}}>
 <input id="tuition-student-search" type="search" value={query} autoComplete="off" placeholder="e.g. Test Student"
 onChange={e=>{setQuery(e.target.value);setMatches([]);setSelected(null);setSearched(false)}} maxLength={80}
 style={{minWidth:0,flex:1,minHeight:46,padding:12,borderRadius:10,border:"1px solid #b5bdb6",background:"#fff",color:"#17251c"}} />
 <button type="submit" disabled={busy||query.trim().length<3||state!=="ready"} style={action}>Search</button></form>
 {searched&&matches.length===0&&!error&&<p style={{color:"#536159",fontSize:13}}>No matching student accounts found.</p>}
 {matches.length>0&&<div role="group" aria-label="Student results" style={{display:"grid",gap:7,marginTop:12}}>
 {matches.map(s=><button type="button" key={s.id} onClick={()=>setSelected(s)}
 aria-pressed={selected?.id===s.id} style={{textAlign:"left",minHeight:48,padding:12,borderRadius:10,border:selected?.id===s.id?"2px solid #087451":"1px solid #cbd5cf",background:selected?.id===s.id?"#e8f6ef":"#fff",color:"#17251c",fontWeight:650,cursor:"pointer"}}>
 {s.name}{selected?.id===s.id?" ✓":""}</button>)}</div>}
 {selected&&<button type="button" disabled={busy} onClick={()=>void invite()} style={{...action,marginTop:12,width:"100%"}}>Invite {selected.name}</button>}
 </section>
 {notice&&<p role="status" style={{color:"#065f46"}}>{notice}</p>}
 {error&&<p role="alert" style={{color:"#b91c1c"}}>{error}</p>}
 {state==="loading"&&<p role="status">Loading tuition students…</p>}
 {state==="error"&&<button onClick={()=>void load()}>Retry</button>}
 {state==="ready"&&rows.length===0&&<section style={card}>No tuition students yet.</section>}
 {state==="ready"&&rows.filter(r=>r.status!=="revoked"&&r.status!=="declined").map(r=><section key={r.id} style={card}>
 <strong>{r.student||"Invitation not claimed"}</strong>
 <p style={{fontSize:13,color:"#536159"}}>{r.status==="accepted"?"Connected":r.status==="pending_guardian"?"Awaiting guardian approval":r.status==="invited"?"Awaiting student response":r.status==="open"?"Awaiting student":r.status}</p>
 {["open","invited","pending_guardian","accepted"].includes(r.status)&&<button type="button" disabled={busy} onClick={()=>void revoke(r.id)} style={{minHeight:44,padding:"10px 14px",borderRadius:10,border:"1px solid #ddd",background:"#fff",color:"#17251c"}}>Remove</button>}
 </section>)}
 <p style={{fontSize:12,color:"#536159"}}>The student decides whether to accept. Learners under 18 need linked guardian approval. School records stay separate.</p>
 </main>;
}

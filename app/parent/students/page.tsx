"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Child {
  child_id:string; child_name:string; class_name:string; school_name:string;
  attendance_recorded:number; attendance_pct:number|null; status:string; status_label:string;
}

export default function ParentStudentsPage(){
  const router=useRouter();const[children,setChildren]=useState<Child[]>([]);const[loading,setLoading]=useState(true);const[error,setError]=useState("");
  useEffect(()=>{let cancelled=false;(async()=>{try{const{supabase}=await import("@/lib/supabase");const{data,error:rpcError}=await supabase.rpc("get_parent_dashboard");if(rpcError)throw rpcError;if(!cancelled)setChildren((Array.isArray(data?.children)?data.children:[]) as Child[])}catch(cause){if(!cancelled)setError(cause instanceof Error?cause.message:"Could not load your children.")}finally{if(!cancelled)setLoading(false)}})();return()=>{cancelled=true}},[]);
  if(loading)return <div style={shell}><section style={card}><div style={skeleton}/><div style={{...skeleton,width:"55%",marginTop:10}}/><div style={{...skeleton,height:90,marginTop:18}}/></section></div>;
  if(error)return <div style={shell}><section style={card}><div style={{fontSize:28}}>⚠️</div><h1 style={title}>We couldn't load your children</h1><p style={muted}>{error}</p><button onClick={()=>router.push("/parent")} style={primary}>Back to Home</button></section></div>;
  return <div style={shell}>
    <section style={{...card,background:"linear-gradient(135deg,#1e1b4b,#312e81)",color:"#fff",border:"none"}}><div style={{fontSize:10,fontWeight:800,opacity:.6,textTransform:"uppercase",letterSpacing:1}}>Family</div><h1 style={{fontSize:22,margin:"5px 0"}}>Your children</h1><p style={{fontSize:12,margin:0,color:"rgba(255,255,255,.68)"}}>One trusted view of the children connected to your account.</p></section>
    {children.length===0?<section style={{...card,textAlign:"center"}}><div style={{fontSize:44}}>👨‍👩‍👧</div><h2 style={title}>No children connected yet</h2><p style={muted}>Link an existing student with a claim code or add your child to a class.</p><div style={{display:"grid",gap:9,marginTop:16}}><button onClick={()=>router.push("/parent/link-child")} style={primary}>🔗 Link with Claim Code</button><button onClick={()=>router.push("/parent/create-child")} style={secondary}>+ Add Child to Class</button></div></section>:children.map(child=><section key={child.child_id} style={card}>
      <div style={{display:"flex",alignItems:"center",gap:12}}><div style={avatar}>{child.child_name?.[0]?.toUpperCase()??"C"}</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:16,fontWeight:850}}>{child.child_name}</div><div style={{fontSize:11,color:"#6b7280",marginTop:2}}>{child.class_name} · {child.school_name}</div></div><span style={badge(child.status)}>{child.status_label}</span></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}><Metric label="Attendance · last 30 days" value={child.attendance_pct===null?"Not enough data":`${child.attendance_pct}%`}/><Metric label="Records" value={String(child.attendance_recorded)}/></div>
      <button onClick={()=>router.push(`/parent/child/${child.child_id}`)} style={{...primary,width:"100%",marginTop:10}}>View child</button>
    </section>)}
  </div>
}
function Metric({label,value}:{label:string;value:string}){return <div style={{background:"#f8fafc",borderRadius:11,padding:10}}><div style={{fontSize:15,fontWeight:850}}>{value}</div><div style={{fontSize:10,color:"#6b7280",marginTop:2}}>{label}</div></div>}
function badge(status:string):React.CSSProperties{const map:Record<string,React.CSSProperties>={needs_attention:{background:"#fee2e2",color:"#991b1b"},waiting:{background:"#fef3c7",color:"#92400e"},insufficient_data:{background:"#f3f4f6",color:"#4b5563"},attendance_on_track:{background:"#d1fae5",color:"#065f46"}};return{...(map[status]??map.insufficient_data),borderRadius:999,padding:"5px 8px",fontSize:10,fontWeight:800,whiteSpace:"nowrap"}}
const shell:React.CSSProperties={maxWidth:768,margin:"0 auto",paddingBottom:24};const card:React.CSSProperties={background:"#fff",border:"1px solid #e5e7eb",borderRadius:16,padding:15,marginBottom:12,boxShadow:"0 1px 3px rgba(0,0,0,.04)"};const avatar:React.CSSProperties={width:48,height:48,borderRadius:"50%",background:"#ede9fe",color:"#1e1b4b",display:"grid",placeItems:"center",fontSize:18,fontWeight:850,flexShrink:0};const primary:React.CSSProperties={border:"none",borderRadius:11,padding:"11px 13px",background:"#1e1b4b",color:"#fff",fontWeight:800,fontSize:12,cursor:"pointer"};const secondary:React.CSSProperties={border:"1px solid #d1d5db",borderRadius:11,padding:"11px 13px",background:"#fff",color:"#1e1b4b",fontWeight:800,fontSize:12,cursor:"pointer"};const title:React.CSSProperties={fontSize:18,margin:"8px 0"};const muted:React.CSSProperties={fontSize:12,lineHeight:1.5,color:"#6b7280",margin:0};const skeleton:React.CSSProperties={height:16,borderRadius:8,background:"linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)",backgroundSize:"200% 100%"};
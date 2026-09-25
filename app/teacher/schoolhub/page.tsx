"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, SectionLabel, Btn, C } from '@/components/teacher/ui'

type EventRow={id:string;title:string;description:string|null;event_type:string;starts_at:string;ends_at:string|null;all_day:boolean;location:string|null;priority:string}
type Notice={id:string;title:string;body:string;sent_at:string;requires_ack:boolean;ack_deadline:string|null;ack_at:string|null}
type Exception={id:string;exception_date:string;kind:string;label:string;suppress_ordinary_teaching:boolean}
type Info={school_id:string|null;events:EventRow[];notices:Notice[];calendar_exceptions:Exception[]}

function fmt(v:string){return new Date(v).toLocaleString('en-KE',{timeZone:'Africa/Nairobi',weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})}
export default function SchoolHubPage(){
 const router=useRouter(); const [info,setInfo]=useState<Info|null>(null); const [school,setSchool]=useState<{name:string;county:string|null;school_type:string|null}|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState('')
 async function load(){
  setLoading(true);setError('')
  try{
   const {data:{user}}=await supabase.auth.getUser(); if(!user){router.replace('/');return}
   const {data,error:e}=await supabase.rpc('get_my_teacher_school_information',{p_from:new Date().toISOString(),p_until:new Date(Date.now()+14*86400000).toISOString()}); if(e)throw e
   const x=(data??{school_id:null,events:[],notices:[],calendar_exceptions:[]}) as Info; setInfo(x)
   if(x.school_id){const {data:s,error:se}=await supabase.from('schools').select('name,county,school_type').eq('id',x.school_id).single();if(se)throw se;setSchool(s)}
  }catch(c){setError(c instanceof Error?c.message:'School information could not be loaded.')}finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[])
 const urgent=useMemo(()=>info?.notices.filter(n=>n.requires_ack&&!n.ack_at)??[],[info])
 if(loading)return <div style={{padding:16}}><Card><div style={{color:C.textMuted}}>Loading your school…</div></Card></div>
 if(!info?.school_id)return <div style={{padding:16}}><Card><SectionLabel>School setup</SectionLabel><h1 style={{fontSize:20}}>Connect your school</h1><p style={{color:C.textMuted,fontSize:13}}>School information becomes available after your active school membership is confirmed.</p><Btn onClick={()=>router.push('/teacher/onboarding/school')}>Find or connect school</Btn></Card></div>
 return <div style={{padding:'16px 16px 32px',display:'grid',gap:12}}>
  <section style={{background:'linear-gradient(135deg,#0f172a,#312e81)',color:'#fff',borderRadius:20,padding:18}}>
   <div style={{fontSize:10,fontWeight:900,letterSpacing:1,textTransform:'uppercase',color:'#a7f3d0'}}>My school</div>
   <h1 style={{fontSize:21,margin:'5px 0'}}>{school?.name??'School'}</h1>
   <div style={{fontSize:11,color:'#cbd5e1'}}>{[school?.school_type,school?.county].filter(Boolean).join(' · ')}</div>
   <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}><Btn small onClick={()=>router.push('/teacher/classhub')}>My classes</Btn><Btn small variant="ghost" onClick={()=>router.push('/teacher/timetable')}>Timetable</Btn><Btn small variant="ghost" onClick={()=>router.push('/teacher/onboarding/school')}>Change school</Btn></div>
  </section>
  {error&&<div style={{padding:11,border:'1px solid #fecaca',background:'#fef2f2',borderRadius:12,color:'#b91c1c',fontSize:12}}>{error}<button onClick={()=>void load()} style={{marginLeft:8}}>Retry</button></div>}
  <Card><SectionLabel>Needs your attention</SectionLabel>{urgent.length===0?<p style={{fontSize:12,color:C.textMuted}}>No acknowledgement is waiting for you.</p>:urgent.slice(0,3).map(n=><button key={n.id} onClick={()=>router.push('/teacher/vibeconnect')} style={rowButton}><span><b>{n.title}</b><small>{fmt(n.sent_at)} · acknowledgement required</small></span><b>›</b></button>)}</Card>
  <Card><SectionLabel>Coming up</SectionLabel>{info.events.length===0?<p style={{fontSize:12,color:C.textMuted}}>No targeted school events in the next 14 days.</p>:info.events.slice(0,5).map(e=><div key={e.id} style={row}><div><b style={{fontSize:12}}>{e.title}</b><small>{e.all_day?new Date(e.starts_at).toLocaleDateString('en-KE',{timeZone:'Africa/Nairobi',weekday:'short',day:'numeric',month:'short'}):fmt(e.starts_at)}{e.location?' · '+e.location:''}</small></div><span style={pill}>{e.event_type.replace('_',' ')}</span></div>)}</Card>
  <Card><SectionLabel>School calendar</SectionLabel>{info.calendar_exceptions.length===0?<p style={{fontSize:12,color:C.textMuted}}>No school calendar exception in the next 14 days.</p>:info.calendar_exceptions.map(x=><div key={x.id} style={row}><div><b style={{fontSize:12}}>{x.label}</b><small>{new Date(x.exception_date+'T12:00:00+03:00').toLocaleDateString('en-KE',{weekday:'long',day:'numeric',month:'short'})}</small></div>{x.suppress_ordinary_teaching&&<span style={pill}>No ordinary lessons</span>}</div>)}</Card>
  <Card><SectionLabel>Official notices</SectionLabel>{info.notices.length===0?<p style={{fontSize:12,color:C.textMuted}}>No official school notice has been delivered to you.</p>:info.notices.slice(0,4).map(n=><button key={n.id} onClick={()=>router.push('/teacher/vibeconnect')} style={rowButton}><span><b>{n.title}</b><small>{fmt(n.sent_at)}{n.requires_ack?(n.ack_at?' · acknowledged':' · acknowledgement required'):''}</small></span><b>›</b></button>)}<div style={{marginTop:10}}><Btn small variant="ghost" onClick={()=>router.push('/teacher/vibeconnect')}>Open communications</Btn></div></Card>
  <Card><SectionLabel>School resources</SectionLabel><p style={{fontSize:12,color:C.textMuted,margin:'4px 0 10px'}}>Policies, circular documents and staff resources remain in the School Resources authority.</p><Btn small variant="ghost" onClick={()=>router.push('/teacher/resources')}>Open resources</Btn></Card>
 </div>
}
const row:React.CSSProperties={display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,padding:'10px 0',borderBottom:`1px solid ${C.border}`}
const rowButton:React.CSSProperties={...row,width:'100%',background:'transparent',borderTop:0,borderLeft:0,borderRight:0,textAlign:'left',fontFamily:'inherit',cursor:'pointer'}
const pill:React.CSSProperties={fontSize:9,fontWeight:800,borderRadius:999,padding:'3px 7px',background:'#eef2ff',color:'#4338ca',textTransform:'capitalize'}

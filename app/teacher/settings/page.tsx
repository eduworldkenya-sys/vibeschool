"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, ChevronRight, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card, SectionLabel, Btn, C } from "@/components/teacher/ui";

type NotifPrefs = { attendance:boolean; flags:boolean; messages:boolean; lessonPlans:boolean; schoolNotices:boolean; news:boolean };
const DEFAULT_PREFS: NotifPrefs = { attendance:true, flags:true, messages:true, lessonPlans:true, schoolNotices:false, news:false };
const LABELS: Record<keyof NotifPrefs,string> = { attendance:"Attendance reminders", flags:"Early warning flags", messages:"VibeConnect messages", lessonPlans:"Lesson plan alerts", schoolNotices:"School notices", news:"Education news" };

function readPrefs(value: unknown): NotifPrefs {
  if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_PREFS;
  const v = value as Record<string, unknown>;
  return (Object.keys(DEFAULT_PREFS) as Array<keyof NotifPrefs>).reduce((out,key)=>({ ...out,[key]:typeof v[key]==="boolean"?v[key]:DEFAULT_PREFS[key] }), DEFAULT_PREFS);
}

function Toggle({value,onChange}:{value:boolean;onChange:(v:boolean)=>void}) {
  return <button type="button" aria-pressed={value} aria-label={value?"Disable notification":"Enable notification"} onClick={()=>onChange(!value)} style={{width:44,height:24,borderRadius:999,border:0,padding:3,cursor:"pointer",background:value?C.accent:C.border,display:"flex",justifyContent:value?"flex-end":"flex-start"}}><span style={{width:18,height:18,borderRadius:"50%",background:"#fff",display:"block"}}/></button>;
}

export default function SettingsPage(){
  const [profile,setProfile]=useState<{full_name:string;phone:string;role:string}|null>(null);
  const [notifs,setNotifs]=useState<NotifPrefs>(DEFAULT_PREFS);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [state,setState]=useState<"idle"|"saved"|"error">("idle");

  useEffect(()=>{ void (async()=>{
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){setLoading(false);return;}
    const {data,error}=await supabase.from("profiles").select("full_name,phone,role,notification_prefs").eq("id",user.id).single();
    if(!error&&data){setProfile({full_name:data.full_name??"—",phone:data.phone??"—",role:data.role??"—"});setNotifs(readPrefs(data.notification_prefs));}
    setLoading(false);
  })();},[]);

  async function save(){setSaving(true);setState("idle");const {data:{user}}=await supabase.auth.getUser();if(!user){setSaving(false);setState("error");return;}const {error}=await supabase.from("profiles").update({notification_prefs:notifs}).eq("id",user.id);setSaving(false);setState(error?"error":"saved");}

  if(loading)return <div style={{padding:"60px 0",textAlign:"center",color:C.textMuted}}>Loading settings…</div>;

  return <div>
    <div style={{background:"linear-gradient(135deg,#1f2937,#475569)",borderRadius:20,padding:20,marginBottom:14,color:"#fff"}}><div style={{fontSize:11,opacity:.65,fontWeight:800,letterSpacing:1,textTransform:"uppercase"}}>Settings</div><div style={{fontSize:22,fontWeight:800,marginTop:4}}>Account & Preferences</div><div style={{fontSize:13,opacity:.75,marginTop:6}}>Control notifications here. Security, privacy and professional trust have their own governed workspace.</div></div>

    <Card><SectionLabel>Account</SectionLabel>{profile?<><Row label="Name" value={profile.full_name}/><Row label="Phone" value={profile.phone}/><Row label="Role" value={profile.role}/></>:<div style={{padding:"12px 0",fontSize:13,color:C.textMuted}}>No profile data found.</div>}
      <Link href="/teacher/profile/account" style={{marginTop:14,padding:"14px",border:`1px solid ${C.border}`,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"space-between",textDecoration:"none",color:C.textPrimary,background:"#f8fafc"}}><span style={{display:"flex",gap:10,alignItems:"center"}}><ShieldCheck size={20}/><span><strong style={{display:"block",fontSize:14}}>Security, privacy & trust</strong><small style={{display:"block",marginTop:3,color:C.textMuted}}>Password, all-session sign-out, profile visibility, verification and photo removal.</small></span></span><ChevronRight size={18}/></Link>
    </Card>

    <Card><SectionLabel>Notifications</SectionLabel><div style={{display:"flex",alignItems:"center",gap:8,color:C.textMuted,fontSize:12,marginBottom:6}}><Bell size={15}/> Choose which Teacher OS updates should interrupt you.</div>{(Object.keys(notifs) as Array<keyof NotifPrefs>).map(key=><div key={key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${C.border}`}}><span style={{fontSize:13,fontWeight:600,color:C.textPrimary}}>{LABELS[key]}</span><Toggle value={notifs[key]} onChange={(v)=>setNotifs(p=>({...p,[key]:v}))}/></div>)}</Card>

    <div style={{display:"flex",gap:10,marginBottom:14}}><Btn style={{flex:1,justifyContent:"center"}} onClick={save} disabled={saving}>{saving?"Saving…":state==="saved"?"✓ Saved":state==="error"?"Error — retry":"Save notification preferences"}</Btn><Btn variant="ghost" style={{flex:1,justifyContent:"center"}} onClick={()=>setNotifs(DEFAULT_PREFS)}>Reset notifications</Btn></div>

    <Card><SectionLabel>Account data & deletion</SectionLabel><div style={{fontSize:13,lineHeight:1.6,color:C.textMuted}}>VibeSchool does not present destructive or data-export controls unless the underlying governed workflow exists. Account deletion and formal data export therefore remain unavailable here rather than appearing as non-functional buttons.</div></Card>
  </div>;
}

function Row({label,value}:{label:string;value:string}){return <div style={{display:"flex",justifyContent:"space-between",gap:16,padding:"11px 0",borderBottom:`1px solid ${C.border}`}}><span style={{fontSize:13,color:C.textMuted}}>{label}</span><strong style={{fontSize:13,color:C.textPrimary,textAlign:"right"}}>{value}</strong></div>}

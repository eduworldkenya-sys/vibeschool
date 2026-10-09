"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, ChevronRight, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card, SectionLabel, Btn, C, TeacherWorkspace } from "@/components/teacher/ui";

type NotifPrefs = { attendance:boolean; flags:boolean; messages:boolean; lessonPlans:boolean; schoolNotices:boolean; news:boolean };
const DEFAULT_PREFS: NotifPrefs = { attendance:true, flags:true, messages:true, lessonPlans:true, schoolNotices:false, news:false };
const LABELS: Record<keyof NotifPrefs,string> = { attendance:"Attendance reminders", flags:"Early warning flags", messages:"VibeConnect messages", lessonPlans:"Lesson plan alerts", schoolNotices:"School notices", news:"Education news" };

function readPrefs(value: unknown): NotifPrefs {
  if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_PREFS;
  const v = value as Record<string, unknown>;
  return (Object.keys(DEFAULT_PREFS) as Array<keyof NotifPrefs>).reduce((out,key)=>({ ...out,[key]:typeof v[key]==="boolean"?v[key]:DEFAULT_PREFS[key] }), DEFAULT_PREFS);
}

function Toggle({value,onChange,label,disabled}:{value:boolean;onChange:(v:boolean)=>void;label:string;disabled:boolean}) {
  return <button type="button" role="switch" aria-checked={value} aria-label={label} disabled={disabled} onClick={()=>onChange(!value)} className="teacher-settings-toggle"><span data-on={value}><i/></span></button>;
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

  return <TeacherWorkspace title="Settings" eyebrow="My workspace">


    <Card><SectionLabel>Account</SectionLabel>{profile?<><Row label="Name" value={profile.full_name}/><Row label="Phone" value={profile.phone}/><Row label="Role" value={profile.role}/></>:<div style={{padding:"12px 0",fontSize:13,color:C.textMuted}}>No profile data found.</div>}
      <Link href="/teacher/profile/account" style={{marginTop:14,padding:"14px",border:`1px solid ${C.border}`,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"space-between",textDecoration:"none",color:C.textPrimary,background:"var(--teacher-canvas, #f5f6f2)"}}><span style={{display:"flex",gap:10,alignItems:"center"}}><ShieldCheck size={20}/><span><strong style={{display:"block",fontSize:14}}>Security, privacy & trust</strong><small style={{display:"block",marginTop:3,color:C.textMuted}}>Password, sign-out and profile privacy.</small></span></span><ChevronRight size={18}/></Link>
    </Card>

    <Card><SectionLabel>Notifications</SectionLabel><div style={{display:"flex",alignItems:"center",gap:8,color:C.textMuted,fontSize:12,marginBottom:6}}><Bell size={15}/>Choose your notifications.</div>{(Object.keys(notifs) as Array<keyof NotifPrefs>).map(key=><div key={key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${C.border}`}}><span style={{fontSize:13,fontWeight:600,color:C.textPrimary}}>{LABELS[key]}</span><Toggle label={LABELS[key]} disabled={saving} value={notifs[key]} onChange={(v)=>setNotifs(p=>({...p,[key]:v}))}/></div>)}</Card>

    <div style={{display:"flex",gap:10,marginBottom:14}}><Btn style={{flex:1,justifyContent:"center"}} onClick={save} disabled={saving}>{saving?"Saving…":state==="saved"?"✓ Saved":state==="error"?"Error — retry":"Save notification preferences"}</Btn><Btn variant="ghost" disabled={saving} style={{flex:1,justifyContent:"center"}} onClick={()=>setNotifs(DEFAULT_PREFS)}>Reset notifications</Btn></div>

    <Card><SectionLabel>Account data & deletion</SectionLabel><div style={{fontSize:13,lineHeight:1.6,color:C.textMuted}}>Account deletion and formal data export are not available here. Contact support for assistance.</div></Card>
    <div role="status" aria-live="polite" className="teacher-settings-status">{saving?"Saving your preferences…":state==="saved"?"Preferences saved":state==="error"?"Could not save. Your choices are still here; try again.":""}</div>
  </TeacherWorkspace>;
}

function Row({label,value}:{label:string;value:string}){return <div style={{display:"flex",justifyContent:"space-between",gap:16,padding:"11px 0",borderBottom:`1px solid ${C.border}`}}><span style={{fontSize:13,color:C.textMuted}}>{label}</span><strong style={{fontSize:13,color:C.textPrimary,textAlign:"right"}}>{value}</strong></div>}

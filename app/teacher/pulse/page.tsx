"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { C } from "@/components/teacher/ui";
import { useCredits } from "@/app/teacher/layout";

interface TimetableSlot {
  id: string; day_of_week: number; period: number;
  start_time: string; end_time: string;
  subject: string; class_name: string; class_id: string;
}
interface AtRisk { id: string; name: string; reason: string }
interface CurriculumStat { covered: number; total: number; subject: string }

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function timeStr(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2,"0")} ${h >= 12 ? "PM" : "AM"}`;
}
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning"; if (h < 17) return "Good afternoon"; return "Good evening";
}
function Skel({ h = 60, r = 14 }: { h?: number; r?: number }) {
  return <div style={{ height: h, borderRadius: r, background: "linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />;
}
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: "#fff", borderRadius: 18, padding: "16px 16px", marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", ...style }}>{children}</div>;
}
function SectionLabel({ label }: { label: string }) {
  return <div style={{ fontSize: 10, fontWeight: 800, color: "#6b7280", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>{label}</div>;
}

export default function PulsePage() {
  const router = useRouter();
  const { creditBalance } = useCredits();
  const [loading,    setLoading]    = useState(true);
  const [name,       setName]       = useState("");
  const [todaySlots, setTodaySlots] = useState<TimetableSlot[]>([]);
  const [atRisk,     setAtRisk]     = useState<AtRisk[]>([]);
  const [currStats,  setCurrStats]  = useState<CurriculumStat[]>([]);
  const [tpadDays,   setTpadDays]   = useState<number | null>(null);
  const [attPending, setAttPending] = useState<{class_id:string;class_name:string}[]>([]);
  const [twinMsg,    setTwinMsg]    = useState("");

  const boot = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [memberRes, profileRes] = await Promise.all([
      supabase.from("school_members").select("school_id").eq("profile_id", user.id).maybeSingle(),
      supabase.from("profiles").select("full_name, school_id").eq("id", user.id).single(),
    ]);
    const sid = memberRes.data?.school_id ?? profileRes.data?.school_id ?? null;
    setName((profileRes.data?.full_name ?? "").split(" ")[0] ?? "");
    const todayDow = new Date().getDay();
    const nowMins  = new Date().getHours() * 60 + new Date().getMinutes();
    if (sid) {
      const { data: slots } = await supabase
        .from("timetable_slots")
        .select("id,day_of_week,period,start_time,end_time,subject,class_name:classes(name),class_id")
        .eq("school_id", sid).eq("teacher_id", user.id).eq("day_of_week", todayDow).order("start_time");
      const mapped = ((slots ?? []) as any[]).map((s: any) => ({ ...s, class_name: s.class_name?.name ?? "Class" })) as TimetableSlot[];
      setTodaySlots(mapped);
      const classIds = [...new Set(mapped.map(s => s.class_id))];
      if (classIds.length > 0) {
        const today = new Date().toISOString().split("T")[0];
        const { data: attRows } = await supabase.from("attendance").select("class_id").eq("school_id", sid).eq("date", today).in("class_id", classIds);
        const markedIds = new Set((attRows ?? []).map((a: any) => a.class_id));
        setAttPending(mapped.filter(s => !markedIds.has(s.class_id)).map(s => ({ class_id: s.class_id, class_name: s.class_name })).filter((v,i,a) => a.findIndex(x => x.class_id === v.class_id) === i));
      }
      const { data: tpad } = await supabase.from("tpad_cycles").select("deadline").eq("school_id", sid).eq("teacher_id", user.id).gte("deadline", new Date().toISOString().split("T")[0]).order("deadline").limit(1).maybeSingle();
      if (tpad?.deadline) setTpadDays(Math.ceil((new Date(tpad.deadline).getTime() - Date.now()) / 86400000));
      const { data: tcRows } = await supabase.from("teacher_classes").select("class_id,subject_id,subjects(name)").eq("school_id", sid).eq("teacher_id", user.id);
      if (tcRows && tcRows.length > 0) {
        const stats: CurriculumStat[] = [];
        for (const tc of (tcRows as any[]).slice(0,3)) {
          const { count: covered } = await supabase.from("strand_progress").select("*",{count:"exact",head:true}).eq("teacher_id",user.id).eq("class_id",tc.class_id).in("status",["done","teaching"]);
          const { count: total }   = await supabase.from("curriculum").select("*",{count:"exact",head:true});
          if ((total ?? 0) > 0) stats.push({ subject: tc.subjects?.name ?? "Subject", covered: covered ?? 0, total: total ?? 1 });
        }
        setCurrStats(stats);
      }
      const { data: termRow } = await supabase.from("academic_terms").select("start_date").eq("school_id", sid).eq("status","active").maybeSingle();
      if (termRow?.start_date && classIds.length > 0) {
        const { data: absences } = await supabase.from("attendance").select("student_id,profiles(full_name)").eq("school_id",sid).eq("status","absent").in("class_id",classIds).gte("date",termRow.start_date);
        const countMap: Record<string,{name:string;count:number}> = {};
        for (const a of ((absences ?? []) as any[])) { const s=a.student_id; const n=a.profiles?.full_name??"Student"; if(!countMap[s])countMap[s]={name:n,count:0}; countMap[s].count++; }
        setAtRisk(Object.entries(countMap).filter(([,v])=>v.count>=3).map(([id,v])=>({id,name:v.name,reason:`Absent ${v.count}x this term`})).slice(0,4));
      }
    }
    const h = new Date().getHours();
    setTwinMsg(h<10?"Early start — you're ahead of most.":h<12?"Morning in full swing. How's the energy?":h<14?"Halfway through. Keep the momentum.":h<17?"Afternoon — the hardest shift. You've got it.":"Day's winding down. Log how it went?");
    setLoading(false);
  }, []);

  useEffect(() => { boot(); }, [boot]);

  const todayName = DAYS[new Date().getDay()];
  const dateStr   = new Date().toLocaleDateString("en-KE", { day:"numeric", month:"long", year:"numeric" });

  return (
    <div style={{ paddingTop: 4 }}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}} @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ marginBottom: 16, animation: "fadeUp 0.25s ease" }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#1e1b4b", letterSpacing: -0.5 }}>{greeting()}{name ? `, ${name}` : ""}.</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{todayName} · {dateStr}</div>
      </div>
      <div onClick={() => router.push("/teacher/pulse?twin=1")} style={{ background:"linear-gradient(135deg,#0f172a 0%,#1e1b4b 60%,#064e3b 100%)", borderRadius:18, padding:"14px 16px", marginBottom:12, cursor:"pointer", animation:"fadeUp 0.3s ease", boxShadow:"0 4px 20px rgba(16,185,129,0.2)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:"50%", background:"radial-gradient(circle at 35% 35%,rgba(16,185,129,0.4),rgba(16,185,129,0.1))", border:"1.5px solid rgba(16,185,129,0.6)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, color:"#10b981", flexShrink:0 }}>✦</div>
          <div>
            <div style={{ fontSize:9, fontWeight:800, color:"rgba(16,185,129,0.8)", letterSpacing:1.2, textTransform:"uppercase", marginBottom:3 }}>Your Twin</div>
            <div style={{ fontSize:13, fontWeight:600, color:"#e0e7ff", lineHeight:1.4 }}>{loading?"Thinking…":twinMsg}</div>
          </div>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
        {[
          { label:"Credits",  value:creditBalance!==null?String(creditBalance):"…", sub:"available",  color:(creditBalance??99)<=3?"#ef4444":"#10b981",  onClick:()=>router.push("/teacher/credits") },
          { label:"At Risk",  value:loading?"…":String(atRisk.length),              sub:"students",    color:atRisk.length>0?"#f59e0b":"#10b981",          onClick:()=>router.push("/teacher/students") },
          { label:"TPAD",     value:tpadDays!==null?`${tpadDays}d`:"—",             sub:"to deadline", color:(tpadDays??999)<=7?"#ef4444":(tpadDays??999)<=14?"#f59e0b":"#10b981", onClick:()=>router.push("/teacher/tpad") },
        ].map(s=>(
          <div key={s.label} onClick={s.onClick} style={{ background:"#fff", borderRadius:14, padding:"12px 10px", textAlign:"center", cursor:"pointer", boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#6b7280", letterSpacing:0.8, textTransform:"uppercase", marginBottom:4 }}>{s.label}</div>
            <div style={{ fontSize:22, fontWeight:900, color:s.color, lineHeight:1 }}>{s.value}</div>
            <div style={{ fontSize:10, color:"#6b7280", marginTop:2 }}>{s.sub}</div>
          </div>
        ))}
      </div>
      {!loading && attPending.length > 0 && (
        <Card style={{ borderLeft:"3px solid #ef4444", animation:"fadeUp 0.3s ease" }}>
          <SectionLabel label="Attendance Pending" />
          {attPending.map(c=>(
            <div key={c.class_id} onClick={()=>router.push(`/teacher/attendance?classId=${c.class_id}`)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid #f3f4f6", cursor:"pointer" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#1e1b4b" }}>{c.class_name}</div>
              <div style={{ fontSize:10, fontWeight:800, color:"#ef4444", background:"#fef2f2", borderRadius:8, padding:"3px 8px" }}>Mark Now →</div>
            </div>
          ))}
        </Card>
      )}
      <Card style={{ animation:"fadeUp 0.35s ease" }}>
        <SectionLabel label={`Today — ${todayName}`} />
        {loading?(<div style={{display:"flex",flexDirection:"column",gap:8}}><Skel h={52}/><Skel h={52}/></div>):todaySlots.length===0?(
          <div style={{ textAlign:"center", padding:"20px 0", color:"#6b7280", fontSize:13 }}>No lessons scheduled today</div>
        ):todaySlots.map(slot=>{
          const [h,m]=slot.start_time.split(":").map(Number); const slotMins=h*60+m;
          const nowMins=new Date().getHours()*60+new Date().getMinutes();
          const [eh,em]=slot.end_time.split(":").map(Number); const endMins=eh*60+em;
          const isNow=slotMins<=nowMins&&nowMins<endMins; const isPast=endMins<=nowMins;
          return (
            <div key={slot.id} onClick={()=>router.push(`/teacher/classhub/${slot.class_id}`)} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid #f3f4f6", cursor:"pointer", opacity:isPast?0.5:1 }}>
              <div style={{ width:4, height:44, borderRadius:4, flexShrink:0, background:isNow?"#10b981":isPast?"#e5e7eb":"#6366f1" }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#1e1b4b" }}>{slot.subject} — {slot.class_name}</div>
                <div style={{ fontSize:11, color:"#6b7280", marginTop:2 }}>{timeStr(slot.start_time)} – {timeStr(slot.end_time)}</div>
              </div>
              {isNow&&<div style={{ fontSize:9, fontWeight:900, color:"#10b981", background:"#f0fdf4", borderRadius:8, padding:"3px 8px", letterSpacing:0.5, textTransform:"uppercase" }}>Now</div>}
            </div>
          );
        })}
      </Card>
      {!loading&&currStats.length>0&&(
        <Card style={{ animation:"fadeUp 0.4s ease" }}>
          <SectionLabel label="Curriculum Coverage" />
          {currStats.map(s=>{
            const pct=Math.round((s.covered/s.total)*100);
            return (
              <div key={s.subject} style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#1e1b4b" }}>{s.subject}</div>
                  <div style={{ fontSize:12, fontWeight:800, color:pct>=70?"#10b981":pct>=40?"#f59e0b":"#ef4444" }}>{pct}%</div>
                </div>
                <div style={{ height:6, background:"#f3f4f6", borderRadius:4, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${pct}%`, background:pct>=70?"#10b981":pct>=40?"#f59e0b":"#ef4444", borderRadius:4, transition:"width 0.6s ease" }} />
                </div>
              </div>
            );
          })}
          <div onClick={()=>router.push("/teacher/scheme")} style={{ fontSize:12, fontWeight:700, color:"#10b981", marginTop:4, cursor:"pointer" }}>View full curriculum →</div>
        </Card>
      )}
      {!loading&&atRisk.length>0&&(
        <Card style={{ animation:"fadeUp 0.45s ease" }}>
          <SectionLabel label="Students Needing Attention" />
          {atRisk.map(s=>(
            <div key={s.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid #f3f4f6" }}>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:"#1e1b4b" }}>{s.name}</div>
                <div style={{ fontSize:11, color:"#f59e0b", marginTop:1 }}>{s.reason}</div>
              </div>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#f59e0b", flexShrink:0 }} />
            </div>
          ))}
          <div onClick={()=>router.push("/teacher/students")} style={{ fontSize:12, fontWeight:700, color:"#10b981", marginTop:8, cursor:"pointer" }}>View all students →</div>
        </Card>
      )}
      <Card style={{ animation:"fadeUp 0.5s ease" }}>
        <SectionLabel label="Quick Actions" />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {[
            { label:"Generate Lesson Plan", emoji:"✨", href:"/teacher/lessonplan" },
            { label:"Take Attendance",      emoji:"📋", href:"/teacher/attendance" },
            { label:"Record Assessment",    emoji:"📊", href:"/teacher/assessment" },
            { label:"Scheme of Work",       emoji:"📚", href:"/teacher/scheme"     },
          ].map(a=>(
            <button key={a.href} onClick={()=>router.push(a.href)} style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", gap:6, padding:"13px 12px", border:"none", borderRadius:14, background:"#f8f9fa", cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
              <span style={{ fontSize:20 }}>{a.emoji}</span>
              <span style={{ fontSize:12, fontWeight:700, color:"#1e1b4b", lineHeight:1.3 }}>{a.label}</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

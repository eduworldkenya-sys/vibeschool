"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const accent = "#10b981"
const amber  = "#f59e0b"
const violet = "#8b5cf6"
const navy   = "#0a1628"
const navy2  = "#0d3b7a"
const navy3  = "#0f5fa8"
const red    = "#ef4444"

interface DashStats {
  totalStudents:     number
  totalStaff:        number
  totalClasses:      number
  parentsLinked:     number
  presentToday:      number
  absentToday:       number
  feesCollectedTerm: number
  feesOutstanding:   number
  visitorsToday:     number
  meetingsToday:     number
  pendingLeave:      number
  activeProjects:    number
}

interface Alert {
  id:      string
  type:    "critical" | "warning" | "info"
  message: string
  action:  string
  href:    string
}

export default function AdminDashboard() {
  const router = useRouter()
  const [stats, setStats]               = useState<DashStats | null>(null)
  const [alerts, setAlerts]             = useState<Alert[]>([])
  const [adminName, setAdminName]       = useState("")
  const [schoolName, setSchoolName]     = useState("")
  const [loading, setLoading]           = useState(true)
  const [now, setNow]                   = useState(new Date())
  const [balanceHidden, setBalanceHidden] = useState(true)

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => { bootstrap() }, [])

  async function bootstrap() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/admin/login"); return }
      const { data: p } = await supabase.from("profiles").select("full_name, school_id").eq("id", user.id).single()
      if (!p?.school_id) { router.push("/admin/login"); return }
      const { data: school } = await supabase.from("schools").select("name").eq("id", p.school_id).single()
      setAdminName(p.full_name ?? "Principal")
      setSchoolName(school?.name ?? "School")
      await loadStats(p.school_id)
    } catch { router.push("/admin/login") }
    finally { setLoading(false) }
  }

  async function loadStats(sid: string) {
    const today = new Date().toISOString().split("T")[0]
    const [s1,s2,s3,s4,s5,s6,s7,s8,s9,s10,s11,s12] = await Promise.all([
      supabase.from("students").select("id",{count:"exact",head:true}).eq("school_id",sid),
      supabase.from("profiles").select("id",{count:"exact",head:true}).eq("school_id",sid).eq("role","teacher"),
      supabase.from("classes").select("id",{count:"exact",head:true}).eq("school_id",sid),
      supabase.from("parent_student_links").select("id",{count:"exact",head:true}).eq("school_id",sid),
      supabase.from("attendance").select("id",{count:"exact",head:true}).eq("school_id",sid).eq("date",today).eq("status","present"),
      supabase.from("attendance").select("id",{count:"exact",head:true}).eq("school_id",sid).eq("date",today).eq("status","absent"),
      supabase.from("finance_fee_payments").select("amount").eq("school_id",sid),
      supabase.from("finance_fee_structures").select("amount").eq("school_id",sid),
      supabase.from("admin_visitors").select("id",{count:"exact",head:true}).eq("school_id",sid).gte("time_in",today),
      supabase.from("admin_meetings").select("id",{count:"exact",head:true}).eq("school_id",sid).gte("scheduled_at",today+"T00:00:00").lte("scheduled_at",today+"T23:59:59"),
      supabase.from("admin_staff_leave").select("id",{count:"exact",head:true}).eq("school_id",sid).eq("status","pending"),
      supabase.from("admin_projects").select("id",{count:"exact",head:true}).eq("school_id",sid).eq("status","active"),
    ])
    const collected = (s7.data??[]).reduce((a:number,r:any)=>a+(r.amount??0),0)
    const expected  = (s8.data??[]).reduce((a:number,r:any)=>a+(r.amount??0),0)
    const d: DashStats = {
      totalStudents:s1.count??0, totalStaff:s2.count??0, totalClasses:s3.count??0,
      parentsLinked:s4.count??0, presentToday:s5.count??0, absentToday:s6.count??0,
      feesCollectedTerm:collected, feesOutstanding:Math.max(0,expected-collected),
      visitorsToday:s9.count??0, meetingsToday:s10.count??0,
      pendingLeave:s11.count??0, activeProjects:s12.count??0,
    }
    setStats(d)
    const list: Alert[] = []
    if(d.absentToday>0)     list.push({id:"absent",  type:d.absentToday>10?"critical":"warning", message:`${d.absentToday} student${d.absentToday>1?"s":""} absent today`,             action:"View",   href:"/admin/attendance"})
    if(d.pendingLeave>0)    list.push({id:"leave",   type:"warning",  message:`${d.pendingLeave} leave request${d.pendingLeave>1?"s":""} pending`,                                      action:"Review", href:"/admin/staff"})
    if(d.feesOutstanding>0) list.push({id:"fees",    type:"info",     message:`KES ${d.feesOutstanding.toLocaleString()} outstanding`,                                                  action:"View",   href:"/admin/finance"})
    if(d.meetingsToday>0)   list.push({id:"meetings",type:"info",     message:`${d.meetingsToday} meeting${d.meetingsToday>1?"s":""} today`,                                            action:"View",   href:"/admin/meetings"})
    setAlerts(list)
  }

  const greeting = () => { const h=now.getHours(); return h<12?"Good morning":h<17?"Good afternoon":"Good evening" }
  const formatDate = () => now.toLocaleDateString("en-KE",{weekday:"long",day:"numeric",month:"long",year:"numeric"})

  if (loading) return (
    <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
      {[1,2,3].map(i=>(
        <div key={i} style={{height:"72px",background:"#fff",borderRadius:"12px",opacity:0.6,animation:"pulse 1.5s ease-in-out infinite"}}/>
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:0.3}50%{opacity:0.7}}`}</style>
    </div>
  )

  const Chip = ({label,value,color}:{label:string,value:string,color:string}) => (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"2px"}}>
      <span style={{color,fontSize:"16px",fontWeight:"800"}}>{value}</span>
      <span style={{color:"rgba(255,255,255,0.5)",fontSize:"10px"}}>{label}</span>
    </div>
  )

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>

      {/* HERO */}
      <div style={{
        background:`linear-gradient(135deg,${navy} 0%,${navy2} 55%,${navy3} 100%)`,
        borderRadius:"20px", padding:"20px", position:"relative", overflow:"hidden",
        boxShadow:"0 4px 24px rgba(10,22,40,0.15)",
      }}>
        <div style={{position:"absolute",top:-30,right:-30,width:120,height:120,borderRadius:"50%",background:"rgba(255,255,255,0.04)"}}/>
        <div style={{position:"absolute",bottom:-20,right:40,width:80,height:80,borderRadius:"50%",background:"rgba(255,255,255,0.03)"}}/>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"16px"}}>
          <div>
            <p style={{color:"rgba(255,255,255,0.55)",fontSize:"12px",margin:"0 0 2px"}}>{greeting()},</p>
            <h1 style={{color:"#fff",fontSize:"20px",fontWeight:"800",margin:"0 0 2px",letterSpacing:"-0.3px"}}>
              {adminName.split(" ")[0]} 👋
            </h1>
            <p style={{color:"rgba(255,255,255,0.35)",fontSize:"11px",margin:0}}>{formatDate()}</p>
          </div>
          <button
            onClick={()=>setBalanceHidden(!balanceHidden)}
            style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"8px",padding:"6px 10px",color:"#fff",cursor:"pointer",fontSize:"11px",fontWeight:"600",whiteSpace:"nowrap"}}
          >{balanceHidden?"Show":"Hide"}</button>
        </div>

        {/* Finance summary row */}
        <div style={{
          background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",
          borderRadius:"12px",padding:"14px 16px",
          display:"flex",justifyContent:"space-around",
        }}>
          <Chip label="Collected" value={balanceHidden?"KES ••••":`KES ${(stats?.feesCollectedTerm??0).toLocaleString()}`} color={accent}/>
          <div style={{width:"1px",background:"rgba(255,255,255,0.1)"}}/>
          <Chip label="Outstanding" value={balanceHidden?"KES ••••":`KES ${(stats?.feesOutstanding??0).toLocaleString()}`} color={red}/>
          <div style={{width:"1px",background:"rgba(255,255,255,0.1)"}}/>
          <Chip label="Students" value={String(stats?.totalStudents??0)} color={amber}/>
        </div>
      </div>

      {/* ALERTS */}
      {alerts.length>0 && (
        <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
          <p style={{color:"#6b7a99",fontSize:"10px",fontWeight:"700",letterSpacing:"1px",textTransform:"uppercase",margin:0}}>Attention</p>
          {alerts.map(a=>{
            const rgb=a.type==="critical"?"239,68,68":a.type==="warning"?"245,158,11":"16,185,129"
            const c=a.type==="critical"?red:a.type==="warning"?amber:accent
            return(
              <div key={a.id} style={{background:`rgba(${rgb},0.07)`,border:`1px solid rgba(${rgb},0.2)`,borderRadius:"10px",padding:"10px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px"}}>
                <span style={{color:c,fontSize:"12px",flex:1}}>{a.type==="critical"?"🔴":a.type==="warning"?"🟡":"🟢"} {a.message}</span>
                <button onClick={()=>router.push(a.href)} style={{background:"rgba(255,255,255,0.9)",border:"none",borderRadius:"6px",padding:"4px 10px",color:navy,fontSize:"10px",fontWeight:"700",cursor:"pointer",whiteSpace:"nowrap"}}>{a.action} →</button>
              </div>
            )
          })}
        </div>
      )}

      {/* QUICK ACTIONS */}
      <div>
        <p style={{color:"#6b7a99",fontSize:"10px",fontWeight:"700",letterSpacing:"1px",textTransform:"uppercase",margin:"0 0 8px"}}>Quick Actions</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px"}}>
          {[
            {label:"Log Visitor",   icon:"🚪",href:"/admin/visitors"},
            {label:"Add Student",   icon:"➕",href:"/admin/students"},
            {label:"Payment",       icon:"💳",href:"/admin/finance"},
            {label:"Attendance",    icon:"📋",href:"/admin/attendance"},
            {label:"Meeting",       icon:"🗓️",href:"/admin/meetings"},
            {label:"Announcement",  icon:"📢",href:"/admin/communication"},
          ].map(item=>(
            <button key={item.label} onClick={()=>router.push(item.href)} style={{
              background:`linear-gradient(135deg,${navy} 0%,${navy2} 100%)`,
              border:"none",borderRadius:"12px",padding:"12px 6px 10px",
              display:"flex",flexDirection:"column",alignItems:"center",gap:"5px",cursor:"pointer",
            }}>
              <span style={{fontSize:"18px"}}>{item.icon}</span>
              <span style={{color:"rgba(255,255,255,0.85)",fontSize:"10px",fontWeight:"600",textAlign:"center",lineHeight:1.2}}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* STATS — compact rows */}
      {[
        {
          title:"School",
          items:[
            {label:"Students",  value:(stats?.totalStudents??0).toLocaleString(),  color:accent,  href:"/admin/students"},
            {label:"Staff",     value:(stats?.totalStaff??0).toLocaleString(),     color:navy3,   href:"/admin/staff"},
            {label:"Classes",   value:(stats?.totalClasses??0).toLocaleString(),   color:amber,   href:"/admin/academics"},
            {label:"Parents",   value:(stats?.parentsLinked??0).toLocaleString(),  color:violet,  href:"/admin/students"},
          ]
        },
        {
          title:"Today",
          items:[
            {label:"Present",   value:(stats?.presentToday??0).toLocaleString(),   color:accent,  href:"/admin/attendance"},
            {label:"Absent",    value:(stats?.absentToday??0).toLocaleString(),    color:red,     href:"/admin/attendance"},
            {label:"Visitors",  value:(stats?.visitorsToday??0).toLocaleString(),  color:amber,   href:"/admin/visitors"},
            {label:"Meetings",  value:(stats?.meetingsToday??0).toLocaleString(),  color:violet,  href:"/admin/meetings"},
          ]
        },
        {
          title:"Operations",
          items:[
            {label:"Leave",     value:(stats?.pendingLeave??0).toLocaleString(),   color:amber,   href:"/admin/staff"},
            {label:"Projects",  value:(stats?.activeProjects??0).toLocaleString(), color:violet,  href:"/admin/projects"},
          ]
        },
      ].map(section=>(
        <div key={section.title}>
          <p style={{color:"#6b7a99",fontSize:"10px",fontWeight:"700",letterSpacing:"1px",textTransform:"uppercase",margin:"0 0 8px"}}>{section.title}</p>
          <div style={{background:"#fff",borderRadius:"14px",overflow:"hidden",boxShadow:"0 1px 6px rgba(0,0,0,0.06)"}}>
            {section.items.map((item,idx)=>(
              <button key={item.label} onClick={()=>router.push(item.href)} style={{
                width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
                padding:"12px 16px",background:"none",border:"none",
                borderBottom:idx<section.items.length-1?"1px solid #f1f5f9":"none",
                cursor:"pointer",
              }}>
                <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                  <div style={{width:"8px",height:"8px",borderRadius:"50%",background:item.color,flexShrink:0}}/>
                  <span style={{color:"#374151",fontSize:"13px",fontWeight:"500"}}>{item.label}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                  <span style={{color:item.color,fontSize:"15px",fontWeight:"800",fontFamily:"monospace"}}>{item.value}</span>
                  <span style={{color:"#cbd5e1",fontSize:"14px"}}>›</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}

    </div>
  )
}

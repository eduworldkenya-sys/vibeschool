"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, FlaskConical, PencilLine, ClipboardCheck, PlayCircle, Puzzle, FolderOpen, CalendarDays, Users, LayoutGrid, ChevronDown, ArrowUpRight } from "lucide-react";
import { useStudent } from "@/lib/student-context";
import { supabase } from "@/lib/supabase";

type Activity = { title:string; detail:string; Icon: typeof BookOpen; href:string };

export default function LearnActivityHub() {
  const { identity } = useStudent();
  const [expanded, setExpanded] = useState(false);
  const [hasPendingTopicPractice, setHasPendingTopicPractice] = useState(false);
  useEffect(() => {
    let active=true
    if (!identity?.studentId) { setHasPendingTopicPractice(false); return }
    const grade=identity.className.trim()
    if (/^Grade\s*9(?:\s+.+)?$/i.test(grade)) {
      void supabase.rpc("student_list_canonical_topic_practice" as never,{p_grade:"Grade 9"})
        .then(({data,error})=>{
          if(!active)return
          if(error || !Array.isArray(data)){setHasPendingTopicPractice(false);return}
          setHasPendingTopicPractice(data.some(item=>item && typeof item==="object" && !Array.isArray(item) && (item as {in_progress?:unknown}).in_progress===true))
        })
        .catch(()=>{if(active)setHasPendingTopicPractice(false)})
    } else {
      try {
        const raw=window.localStorage.getItem("vibeschool:topic-practice:v1:"+identity.studentId)
        const saved=raw?JSON.parse(raw):null
        setHasPendingTopicPractice(Boolean(saved && saved.finished===false && Array.isArray(saved.questionIds) && saved.questionIds.length===5))
      } catch {setHasPendingTopicPractice(false)}
    }
    return()=>{active=false}
  }, [identity?.studentId,identity?.className]);
  const hasSchoolClass = Boolean(identity?.classId);
  const primary: Activity[] = [
    { title: "My Tasks", detail:"Homework, classwork and personal plans", Icon:FolderOpen, href: "/student/tasks" },
    { title: "Exams", detail:"Start an exam and see results", Icon:ClipboardCheck, href: "/student/vibelearn/exams" },
    { title: "Topic Practice", detail:"Five questions per ready topic", Icon:PencilLine, href: "/student/vibelearn/topic-practice" },
    { title: "Read", detail:"Open books and resources", Icon:BookOpen, href: "/learn" },
    { title: "Revision", detail:"Review what you learned", Icon:CalendarDays, href: "/student/vibelearn/revision" },
    { title: "My Tuition", detail:"Go to tuition", Icon:Users, href: "/student/tutoring" },
  ];
  const secondary: Activity[] = [
    { title: "Projects", detail:hasSchoolClass ? "School and personal projects" : "Independent learning projects", Icon:FlaskConical, href: hasSchoolClass ? "/student/projects" : "/student/projects/independent" },
  ];
  const activity = (item:Activity) => <Link key={item.title} className="vs-activity-card" href={item.href}>
    <span className="vs-activity-card-icon"><item.Icon size={22} strokeWidth={1.8} aria-hidden="true" /></span>
    <span style={{flex:1,minWidth:0}}><strong className="vs-activity-card-title">{item.title}</strong><span className="vs-activity-card-detail">{item.detail}</span></span>
    <ArrowUpRight size={16} aria-hidden="true" style={{color:"#94a3b8",flexShrink:0}} />
  </Link>;
  return <section className="vs-activity-hub" aria-labelledby="learn-activity-heading">
    <h2 id="learn-activity-heading">Choose an activity</h2>
    {hasPendingTopicPractice && <Link href="/student/vibelearn/topic-practice" className="vs-activity-card" style={{marginBottom:12,borderColor:"#6366f1"}}><span className="vs-activity-card-icon"><PlayCircle size={22} aria-hidden="true"/></span><span style={{flex:1}}><strong>Continue practice</strong><span className="vs-activity-card-detail">Resume your last unanswered question</span></span><ArrowUpRight size={16} aria-hidden="true"/></Link>}
    <p>Pick one to get started.</p>
    <nav aria-label="Learning activities" className="vs-activity-grid">
      {primary.map(activity)}
      <button type="button" className="vs-activity-card" aria-expanded={expanded} aria-controls="vs-activity-extra" onClick={()=>setExpanded(v=>!v)}>
        <span className="vs-activity-card-icon"><LayoutGrid size={22} aria-hidden="true"/></span>
        <span style={{flex:1,minWidth:0}}><strong className="vs-activity-card-title">Explore more</strong><span className="vs-activity-card-detail">Additional learning tools</span></span>
        <ChevronDown size={16} aria-hidden="true" style={{transform:expanded?"rotate(180deg)":"none",transition:"transform .2s ease"}}/>
      </button>
    </nav>
    <div id="vs-activity-extra" hidden={!expanded} className="vs-activity-secondary">
      {expanded && <><nav aria-label="More learning activities" className="vs-activity-grid">{secondary.map(activity)}</nav>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10,marginTop:10}}>
          <div className="vs-activity-upcoming"><PlayCircle size={18} aria-hidden="true"/><strong>Lessons</strong><span>Coming soon</span></div>
          <div className="vs-activity-upcoming"><Puzzle size={18} aria-hidden="true"/><strong>Activities</strong><span>Coming soon</span></div>
        </div>
      </>}
    </div>
  </section>;
}

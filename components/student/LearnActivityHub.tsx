"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, FlaskConical, PencilLine, ClipboardCheck, PlayCircle, Puzzle, FolderOpen, CalendarDays, Users, LayoutGrid, ChevronDown, ArrowUpRight, Bot } from "lucide-react";
import { useStudent } from "@/lib/student-context";

type Activity = { title:string; detail:string; Icon: typeof BookOpen; href:string };

export default function LearnActivityHub() {
  const { identity } = useStudent();
  const [expanded, setExpanded] = useState(false);
  const hasSchoolClass = Boolean(identity?.classId);
  const primary: Activity[] = [
    { title:"Read", detail:"Books and resources", Icon:BookOpen, href:"/student/vibelearn/reading" },
    { title:"Exams", detail:"Tests and results", Icon:ClipboardCheck, href:"/student/vibelearn/exams" },
    { title:"My Work", detail:"Tasks and homework", Icon:FolderOpen, href:"/student/tasks" },
    { title:"Revision", detail:"Study and improve", Icon:CalendarDays, href:"/student/vibelearn/revision" },
    { title:"My Tuition", detail:"Learn with tutors", Icon:Users, href:"/student/tutoring" },
  ];
  const secondary: Activity[] = [
    { title:"Practice", detail:"Questions by topic", Icon:PencilLine, href:"/student/vibelearn/practice" },
    { title:"Projects", detail:hasSchoolClass ? "School and personal projects" : "Independent learning projects", Icon:FlaskConical, href:hasSchoolClass?"/student/projects":"/student/projects/independent" },
    { title:"AI Tutor", detail:"Your learning companion", Icon:Bot, href:"/student/twin/companion" },
  ];
  const activity = (item:Activity) => <Link key={item.title} className="vs-activity-card" href={item.href}>
    <span className="vs-activity-card-icon"><item.Icon size={22} strokeWidth={1.8} aria-hidden="true" /></span>
    <span style={{flex:1,minWidth:0}}><strong className="vs-activity-card-title">{item.title}</strong><span className="vs-activity-card-detail">{item.detail}</span></span>
    <ArrowUpRight size={16} aria-hidden="true" style={{color:"#94a3b8",flexShrink:0}} />
  </Link>;
  return <section className="vs-activity-hub" aria-labelledby="learn-activity-heading">
    <h2 id="learn-activity-heading">Explore learning activities</h2>
    <p>Choose what you want to learn.</p>
    <nav aria-label="Learning activities" className="vs-activity-grid">
      {primary.map(activity)}
      <button type="button" className="vs-activity-card" aria-expanded={expanded} aria-controls="vs-activity-extra" onClick={()=>setExpanded(v=>!v)}>
        <span className="vs-activity-card-icon"><LayoutGrid size={22} aria-hidden="true"/></span>
        <span style={{flex:1,minWidth:0}}><strong className="vs-activity-card-title">Explore more</strong><span className="vs-activity-card-detail">Practice, projects and more</span></span>
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

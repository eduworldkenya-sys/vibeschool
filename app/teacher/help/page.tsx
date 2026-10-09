'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, BookOpen, CalendarDays, ClipboardCheck, LifeBuoy, Search, Sparkles } from 'lucide-react'
import { TeacherWorkspace } from '@/components/teacher/ui'

const questions = [
 {title:'How do I prepare a lesson?',answer:'Open your timetable or lesson plans, choose the class and subject, and prepare the lesson before teaching.',href:'/teacher/lessonplan',action:'Open lesson plans'},
 {title:'Where do I take attendance?',answer:'Open Attendance, select the class or scheduled lesson, and review the register before saving.',href:'/teacher/attendance',action:'Open attendance'},
 {title:'How do I change my school or teaching scope?',answer:'Your profile contains your active school and teaching scope. Check these when a class or subject is missing.',href:'/teacher/profile',action:'Open profile'},
 {title:'Where can I see learner progress?',answer:'Open a class, then its progress view or a learner record. Assessment results and teaching progress have their own views.',href:'/teacher/classhub',action:'Open my classes'},
 {title:'What can Twin help with?',answer:'Twin can help you find your next teaching action and navigate the workspace. Available actions depend on your role and current context.',href:'/teacher/twin',action:'Open Twin'},
 {title:'Where do I mark submitted work?',answer:'Use Mark submitted work to review learner answers and give feedback. Class results contains results already shared.',href:'/teacher/assessment/marking',action:'Open marking'},
]
const guides=[{title:'Plan your teaching day',href:'/teacher/timetable',icon:CalendarDays},{title:'Prepare a lesson',href:'/teacher/lessonplan',icon:BookOpen},{title:'Take attendance',href:'/teacher/attendance',icon:ClipboardCheck},{title:'Explore Twin',href:'/teacher/twin',icon:Sparkles}]
export default function HelpPage(){
 const [query,setQuery]=useState('')
 const matches=questions.filter(item=>(item.title+' '+item.answer).toLowerCase().includes(query.trim().toLowerCase()))
 return <TeacherWorkspace title="How can we help?" eyebrow="Help & support">
  <label className="teacher-tools-search"><Search size={19} aria-hidden="true"/><input type="search" aria-label="Search Teacher help" placeholder="Search help…" value={query} onChange={event=>setQuery(event.target.value)}/></label>
  <section className="teacher-tools-page__section"><h2>Start with a task</h2><div className="teacher-tools-page__grid">{guides.map(guide=><Link href={guide.href} key={guide.href}><guide.icon size={20} aria-hidden="true"/>{guide.title}</Link>)}</div></section>
  <section className="teacher-panel teacher-help-questions" aria-label="Common questions">{matches.map(item=><details key={item.href}><summary>{item.title}</summary><p>{item.answer}</p><Link href={item.href}>{item.action}<ArrowUpRight size={15} aria-hidden="true"/></Link></details>)}{matches.length===0&&<div className="teacher-state"><h2>No matching questions</h2><p>Try a shorter search, or contact support.</p><button className="teacher-btn teacher-btn--secondary" onClick={()=>setQuery('')}>Clear search</button></div>}</section>
  <Link href="/contact" className="teacher-help-contact"><span className="teacher-state__icon"><LifeBuoy size={24}/></span><span><strong>Need a hand?</strong><small>Contact VibeSchool support</small></span><ArrowUpRight size={20}/></Link>
 </TeacherWorkspace>
}

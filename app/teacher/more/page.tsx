"use client"
import Link from 'next/link'
import { useState } from 'react'
import { Search } from 'lucide-react'
import { TeacherWorkspace } from '@/components/teacher/ui'
import { teacherTabs, teacherTools } from '@/components/teacher/navigation'
export default function MorePage() {
 const [query,setQuery] = useState('')
 return <TeacherWorkspace title="All tools" eyebrow="Your workspace">
  <label className="teacher-tools-search"><Search size={19} aria-hidden="true"/><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find a tool…" aria-label="Search Teacher tools"/></label>
  {teacherTabs.map(tab=>{
   const tools=teacherTools[tab.id].filter(tool=>tool.label.toLowerCase().includes(query.trim().toLowerCase()))
   return tools.length>0 ? <section className="teacher-tools-page__section" key={tab.id}><h2>{tab.id==='me'?'My workspace':tab.label}</h2><div className="teacher-tools-page__grid">{tools.map(tool=><Link key={tool.href} href={tool.href}><tool.icon size={20} aria-hidden="true"/><span>{tool.label}</span></Link>)}</div></section>:null
  })}
  {query && !Object.values(teacherTools).flat().some(tool=>tool.label.toLowerCase().includes(query.trim().toLowerCase())) && <div className="teacher-state"><h2>No tools found</h2><p>Try a subject, task or tool name.</p><button type="button" className="teacher-btn teacher-btn--secondary" onClick={()=>setQuery('')}>Clear search</button></div>}
 </TeacherWorkspace>
}

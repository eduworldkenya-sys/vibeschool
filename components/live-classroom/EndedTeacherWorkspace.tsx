'use client'

import {useState,type ReactNode} from 'react'
import {ArrowLeft,ArrowRight,BookOpen,CheckCircle2,ChevronLeft,ChevronRight,ClipboardList,FileText,FolderOpen,Users} from 'lucide-react'
import styles from './EndedTeacherWorkspace.module.css'

type Section='overview'|'materials'|'work'|'files'|'followup'
type Item={id:string;title:string;category:string;activity:boolean}
type Props={
 title:string;audience:string;joined:number;items:Item[];onBack:()=>void;busy:boolean;error?:string;
 renderItem:(id:string)=>ReactNode;work:ReactNode;files:ReactNode;followup?:ReactNode
}

export default function EndedTeacherWorkspace({title,audience,joined,items,onBack,busy,error,renderItem,work,files,followup}:Props){
 const [section,setSection]=useState<Section>('overview')
 const [selected,setSelected]=useState<string|null>(null)
 const materials=items.filter(item=>!item.activity)
 const activities=items.filter(item=>item.activity)
 const pages=section==='work'?activities:materials
 const current=pages.find(item=>item.id===selected)??pages[0]
 const index=current?pages.findIndex(item=>item.id===current.id):-1
 const tabs=[{id:'overview',name:'Overview',icon:CheckCircle2},{id:'materials',name:'Materials',icon:BookOpen},{id:'work',name:'Learner work',icon:ClipboardList},{id:'files',name:'Files',icon:FolderOpen},...(followup?[{id:'followup',name:'Follow-up',icon:FileText}]:[])] as {id:Section;name:string;icon:typeof BookOpen}[]
 function open(id:Section){setSection(id);setSelected(null)}
 const tasks=[{id:'materials' as const,name:'Review teaching materials',description:materials.length+' presented pages and demonstrations',icon:BookOpen},{id:'work' as const,name:'Review learner work',description:activities.length?'Questions and written submissions':'No exercises or quizzes recorded',icon:ClipboardList},{id:'files' as const,name:'Manage shared files',description:'Photos and PDFs from this lesson',icon:FolderOpen},...(followup?[{id:'followup' as const,name:'Assign follow-up learning',description:'Give the lesson audience a saved presentation',icon:FileText}]:[])]
 return <main className={styles.root} aria-label="Completed lesson review">
  <header className={styles.header}><button type="button" className={styles.back} onClick={onBack} disabled={busy}><ArrowLeft size={18}/>Back to teaching</button><span className={styles.brand}>VibeSchool · Lesson review</span></header>
  <section className={styles.hero}><div><span className={styles.ended}><CheckCircle2 size={17}/>Lesson ended</span><h1>{title}</h1><p>{audience} · This session has ended.</p></div><div className={styles.metrics} aria-label="Lesson summary"><div><BookOpen size={18}/><strong>{materials.length}</strong><span>Teaching items</span></div><div><ClipboardList size={18}/><strong>{activities.length}</strong><span>Activities</span></div><div><Users size={18}/><strong>{joined}</strong><span>Learners recorded</span></div></div></section>
  {error&&<p role="alert" className={styles.error}>{error}</p>}
  <nav className={styles.nav} aria-label="Lesson review sections">{tabs.map(({id,name,icon:Icon})=><button key={id} type="button" aria-pressed={section===id} onClick={()=>open(id)}><Icon size={17}/>{name}</button>)}</nav>
  {section==='overview'&&<section className={styles.panel} aria-label="Lesson overview"><h2>What would you like to do next?</h2><p className={styles.muted}>{joined===0?'No learners are recorded in this session. You can still review its teaching materials.':'Review the lesson records or prepare follow-up learning.'}</p><div className={styles.tasks}>{tasks.map(({id,name,description,icon:Icon})=><button type="button" key={id} onClick={()=>open(id)}><Icon size={23}/><span><strong>{name}</strong><small>{description}</small></span><ArrowRight size={17}/></button>)}</div></section>}
  {(section==='materials'||section==='work')&&<section className={styles.panel} aria-label={section==='materials'?'Presented teaching materials':'Activities and learner work'}><h2>{section==='materials'?'Teaching materials':'Questions and learner work'}</h2>
   {pages.length===0?<p className={styles.empty}>{section==='materials'?'No teaching materials were presented.':'No quizzes, polls or exercises were presented in this lesson.'}</p>:<div className={styles.reader}>
    <aside className={styles.sequence} aria-label="Lesson items">{pages.map((item,i)=><button key={item.id} type="button" aria-pressed={item.id===current?.id} onClick={()=>setSelected(item.id)}><span className={styles.number}>{i+1}</span><span><strong>{item.title}</strong><small>{item.category}</small></span></button>)}</aside>
    {current&&<div className={styles.preview}><div className={styles.previewHeader}><strong>{current.title}</strong><div className={styles.paging}><button type="button" aria-label="Previous review item" disabled={index<=0} onClick={()=>setSelected(pages[index-1].id)}><ChevronLeft size={19}/></button><span>{index+1} / {pages.length}</span><button type="button" aria-label="Next review item" disabled={index>=pages.length-1} onClick={()=>setSelected(pages[index+1].id)}><ChevronRight size={19}/></button></div></div><div className={styles.viewer} key={current.id}>{renderItem(current.id)}</div></div>}
   </div>}
   {section==='work'&&activities.length>0&&<div className={styles.subpanel}>{work}</div>}
  </section>}
  {section==='files'&&<section className={styles.panel} aria-label="Lesson files"><h2>Files</h2><p className={styles.muted}>Review saved photos and PDFs. Unsharing removes learner access.</p>{files}</section>}
  {section==='followup'&&followup&&<section className={styles.panel} aria-label="Follow-up learning"><h2>Follow-up learning</h2><p className={styles.muted}>Assign a saved presentation to this lesson’s eligible audience.</p>{followup}</section>}
 </main>
}

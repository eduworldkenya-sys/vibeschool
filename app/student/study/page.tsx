'use client'
import StudentIntro from "@/components/student/StudentIntro";
import compact from "@/components/student/LearnerCompact.module.css";

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useStudent } from '@/lib/student-context'
import { supabase } from '@/lib/supabase'
import { ArrowRight, BookOpen, ClipboardList, CalendarDays } from 'lucide-react'
import {
  getVibeLearnWorkstation, getAssignedReading, getExamReadinessBrief, updateExamReadiness,
  getAdaptiveLearningPath, getAdaptiveResourceRecommendations,
  type VibeLearnWorkstation, type AssignedReadingItem, type ExamReadinessBrief,
  type AdaptiveLearningPath, type AdaptiveResourceRecommendations,
} from '@/lib/student/vibelearn'
import styles from './study.module.css'
import StudentLearningFeatureLinks from '@/components/student/StudentLearningFeatureLinks'

type ClassResource = {id:string,title:string,description:string|null,type:string,url:string|null,subject_id:string|null}

async function getLiveClassResources(brief:VibeLearnWorkstation):Promise<ClassResource[]> {
  const subjectIds=brief.subjects.map(subject=>subject.id).filter(Boolean)
  if(subjectIds.length===0) return []
  const {data,error}=await supabase.from('vibelearn_content')
    .select('id,title,description,type,url,subject_id')
    .in('subject_id',subjectIds)
    .eq('status','live')
    .not('url','is',null)
    .order('view_count',{ascending:false})
    .limit(30)
  if(error) throw error
  return (data??[]) as ClassResource[]
}

function safeResourceHref(url:string|null|undefined) {
  if(!url) return null
  if(url.startsWith('/')&&!url.startsWith('//')&&!url.includes('\\')) return url
  try{const result=new URL(url);return result.protocol==='https:'||result.protocol==='http:'?result.toString():null}
  catch{return null}
}

function safeInternalRoute(url:string|null|undefined,fallback='/learn') {
  return url && url.startsWith('/') && !url.startsWith('//') && !url.includes('\\')
    ? url : fallback
}

/** Personal activity desk, not a second public content catalogue. */
export default function LearnerStudyDesk() {
  const {identity,loading:identityLoading,error:identityError} = useStudent()
  const [workspace,setWorkspace]=useState<VibeLearnWorkstation|null>(null)
  const [assigned,setAssigned]=useState<AssignedReadingItem[]>([])
  const [classResources,setClassResources]=useState<ClassResource[]>([])
  const [readiness,setReadiness]=useState<ExamReadinessBrief|null>(null)
  const [learningPath,setLearningPath]=useState<AdaptiveLearningPath|null>(null)
  const [recommendations,setRecommendations]=useState<AdaptiveResourceRecommendations|null>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [editing,setEditing]=useState(false)
  const [saving,setSaving]=useState(false)
  const [examDate,setExamDate]=useState('')
  const [dailyMinutes,setDailyMinutes]=useState(90)
  const [confidence,setConfidence]=useState<number|null>(null)
  const isForm4=/\bform\s*4\b/i.test(identity?.className??'')

  async function refresh() {
    const [brief,reading,exam,path,support]=await Promise.all([
      getVibeLearnWorkstation(),
      getAssignedReading().catch(()=>[]),
      isForm4 ? getExamReadinessBrief().catch(()=>null) : Promise.resolve(null),
      getAdaptiveLearningPath().catch(()=>null),
      getAdaptiveResourceRecommendations().catch(()=>null),
    ])
    setLearningPath(path);setRecommendations(support)
    setWorkspace(brief)
    setAssigned(reading)
    setClassResources(await getLiveClassResources(brief).catch(()=>[]))
    setReadiness(exam)
    if (exam) {
      setExamDate(exam.examDate??'')
      setDailyMinutes(exam.dailyRevisionMinutes)
      setConfidence(exam.confidenceCheck)
    }
  }
  useEffect(()=>{
    if(identityLoading||!identity) return
    let active=true
    setLoading(true);setError('')
    Promise.all([
      getVibeLearnWorkstation(),
      getAssignedReading().catch(()=>[]),
      isForm4?getExamReadinessBrief().catch(()=>null):Promise.resolve(null),
      getAdaptiveLearningPath().catch(()=>null),
      getAdaptiveResourceRecommendations().catch(()=>null),
    ]).then(([brief,reading,exam,path,support])=>{
      if(!active) return
      setWorkspace(brief);setAssigned(reading);setReadiness(exam);setLearningPath(path);setRecommendations(support)
      void getLiveClassResources(brief).then(resources=>{if(active)setClassResources(resources)}).catch(()=>{if(active)setClassResources([])})
      if(exam){setExamDate(exam.examDate??'');setDailyMinutes(exam.dailyRevisionMinutes);setConfidence(exam.confidenceCheck)}
    }).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Your learning desk could not load.')})
      .finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false}
  },[identity?.studentId,identityLoading,isForm4])

  async function savePlan() {
    if(!readiness||saving) return
    setSaving(true);setError('')
    try{
      await updateExamReadiness({examDate:examDate||null,dailyRevisionMinutes:dailyMinutes,confidenceCheck:confidence})
      await refresh()
      setEditing(false)
    }catch(reason){setError(reason instanceof Error?reason.message:'The study plan could not be saved.')}
    finally{setSaving(false)}
  }

  if(identityLoading||!identity) return <main className={styles.page} role="status">{identityError||'Opening your learning desk…'}</main>
  const savedReading = workspace?.continueLearning.slice(0,3) ?? []
  return <main className={styles.page}>
    <div className={styles.wrap}>
      <div className={compact.screen}>
      <h1>Learn</h1>
      <section className={compact.grid} aria-label="Reading destinations">
        <Link href="/learn" className={compact.primary}><BookOpen size={18}/> Lessons <ArrowRight size={16}/></Link>
        <Link href="/learn/stories" className={compact.primary}><BookOpen size={18}/> Stories <ArrowRight size={16}/></Link>
        <Link href="/learn?view=reading" className={compact.action}>Library <ArrowRight size={16}/></Link>
      </section>
      {!loading && savedReading.length > 0 && <section className={compact.panel} aria-label="Continue reading">
        {savedReading.slice(0,1).map(item => <Link key={item.publicationId} className={compact.action} href={safeInternalRoute(item.actionUrl)}>
          <span>{item.title}<small className={compact.muted} style={{display:'block'}}>{item.progressPercent}% read</small></span><span>Continue</span>
        </Link>)}
        {savedReading.length > 1 && <details>
          <summary>More saved reading</summary>
          {savedReading.slice(1).map(item => <Link key={item.publicationId} href={safeInternalRoute(item.actionUrl)} className={compact.action}>{item.title} · {item.progressPercent}%</Link>)}
        </details>}
      </section>}
      <section className={compact.grid} aria-label="Learning tools">
        <Link className={compact.action} href="/student/tasks"><ClipboardList size={16}/> My tasks</Link>
        <Link className={compact.action} href="/student/vibelearn/exams"><CalendarDays size={16}/> Exams</Link>
        <Link className={compact.action} href="/student/vibelearn/topic-practice">Topic Practice</Link>
        <Link className={compact.action} href="/student/marks">Progress</Link>
      </section>
      <details className={compact.panel}><summary>More reading tools</summary><StudentLearningFeatureLinks mode="learn" grade={identity.className}/></details>
      <StudentIntro feature="learn-overview"><p>Open a lesson, continue reading or choose a learning activity.</p></StudentIntro>
      {error&&<p className={styles.alert} role="alert">{error}</p>}
      {loading?<p className={styles.card} role="status">Loading your current learning activities…</p>:
      <div className={compact.grid} style={{alignItems:'start'}}>
        <details className={compact.panel} aria-label="Assigned learning"><summary>Assigned reading</summary>

          {assigned.length===0
            ? <p className={styles.muted}>No assigned reading</p>
            : <div className={styles.rows}>
              {assigned.slice(0,5).map(item=><Link key={item.assignmentId} href={safeInternalRoute(item.actionUrl)} className={styles.item}>
                <span><strong>{item.title}</strong><small>{item.subjectName??'Reading'} · {item.chapterTitle}</small></span><ArrowRight size={17}/></Link>)}

            </div>}
        </details>
        <details className={compact.panel}><summary>Learn by subject</summary>


          {classResources.length===0
            ? <p className={styles.muted}>No class resources</p>
            : <div className={styles.rows}>
                {classResources.map(item=>{
                  const href=safeResourceHref(item.url)
                  if(!href) return <div className={styles.item} key={item.id}><span><strong>{item.title}</strong>
                    <small>The link for this resource could not be verified.</small></span></div>
                  const subject=workspace?.subjects.find(s=>s.id===item.subject_id)?.name??'Class resource'
                  return <a key={item.id} className={styles.item} href={href}
                    target={href.startsWith('/')?undefined:'_blank'}
                    rel={href.startsWith('/')?undefined:'noopener noreferrer'}>
                    <span><strong>{item.title}</strong><small>{subject}</small></span><ArrowRight size={17}/>
                  </a>
                })}
              </div>}
        </details>
        <details className={compact.panel}><summary>Your learning path</summary>

          <details><summary style={{cursor:"pointer",fontSize:12,color:"var(--vs-muted)"}}>How recommendations work</summary><p className={styles.muted}>Build foundation first when earlier ideas need more practice. VibeLearn does not invent a weakness when evidence is missing.</p></details>

          {!learningPath || learningPath.path.length===0
            ? <p className={styles.muted}>No learning priorities yet</p>
            : <div className={styles.rows}>
              {learningPath.path.slice(0,5).map(item=>
                <div key={item.outcomeId} className={styles.item}>
                  <span><strong>{item.outcomeText}</strong>
                    <small>{item.prerequisitesReady?'Ready for practice':'Build foundation first'}</small></span>
                </div>)}
            </div>}
          <Link className={styles.secondary} href="/student/vibelearn/revision">Open revision <ArrowRight size={16}/></Link>
        </details>
        <details className={compact.panel}><summary>Recommended support</summary>

          {(!recommendations || recommendations.recommendations.length===0)
            ? <p className={styles.muted}>No approved support resource is available yet</p>
            : <div className={styles.rows}>
              {recommendations.recommendations.filter(item=>item.certified&&item.actionUrl).slice(0,5).map(item=>
                <Link key={item.resourceId} href={safeInternalRoute(item.actionUrl)} className={styles.item}>
                  <span><strong>{item.title}</strong><small>{item.outcomeText}</small></span><ArrowRight size={17}/></Link>)}
            </div>}
        </details>
        {workspace?.twin.now&&<details className={compact.panel}><summary>Next action</summary>


          <p><strong>{workspace.twin.now.title}</strong></p>
          {workspace.twin.now.actionUrl&&<Link className={styles.secondary} href={safeInternalRoute(workspace.twin.now.actionUrl)}>
            {workspace.twin.now.actionLabel||'Open activity'} <ArrowRight size={16}/></Link>}
        </details>}
        {readiness&&<details className={compact.panel}><summary>Study plan</summary>
          <div className={styles.split}><div><h2>{readiness.examName} study plan</h2>
            <p className={styles.muted}>{readiness.psychologyHeadline}</p></div>
            <button type="button" onClick={()=>setEditing(value=>!value)} className={styles.secondary}>{editing?'Close':'Edit plan'}</button>
          </div>
          <p className={styles.muted}>Daily target: {readiness.dailyRevisionMinutes} minutes · {readiness.attemptCount} verified attempts</p>
          {editing&&<div className={styles.form}>
            <label>Exam date<input type="date" value={examDate} onChange={e=>setExamDate(e.target.value)}/></label>
            <label>Daily revision minutes<input type="number" min={15} max={480} value={dailyMinutes}
              onChange={e=>setDailyMinutes(Math.max(15,Math.min(480,Number(e.target.value)||15)))}/></label>
            <label>Confidence today<select value={confidence??''} onChange={e=>setConfidence(e.target.value?Number(e.target.value):null)}>
              <option value="">Not set</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} of 5</option>)}
            </select></label>
            <button type="button" disabled={saving} className={styles.primary} onClick={()=>void savePlan()}>{saving?'Saving…':'Save plan'}</button>
          </div>}
          <details><summary style={{cursor:'pointer',fontSize:12}}>About this study estimate</summary><p className={styles.muted}>{readiness.predictionDisclaimer}</p></details>
        </details>}
      </div>}
      </div>
    </div>
  </main>
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useStudent } from '@/lib/student-context'
import { supabase } from '@/lib/supabase'
import { ArrowRight, BookOpen, ClipboardList, CalendarDays, PencilLine, RotateCcw, FolderOpen, Users, CheckCircle2 } from 'lucide-react'
import {
  getVibeLearnWorkstation, getAssignedReading, getExamReadinessBrief, updateExamReadiness,
  getAdaptiveLearningPath, getAdaptiveResourceRecommendations,
  type VibeLearnWorkstation, type AssignedReadingItem, type ExamReadinessBrief,
  type AdaptiveLearningPath, type AdaptiveResourceRecommendations,
} from '@/lib/student/vibelearn'
import styles from './study.module.css'

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
  return <main className={styles.page}>
    <div className={styles.wrap}>
      <Link href="/learn" className={styles.back}>← Back to Learn</Link>
      <header className={styles.hero}>
        <div><div className={styles.kicker}>My learning · {identity.className}</div>
          <h1>Continue where you left off</h1>
          <p>Your learning tasks, assigned reading, exam plan and verified practice stay connected to your learner account.</p>
        </div>
        <Link className={styles.primary} href="/learn"><BookOpen size={18}/> Browse lessons</Link>
      </header>

      <nav className={styles.shortcuts} aria-label="My learning tools">
        <Link href="/student/tasks"><ClipboardList size={20}/> My tasks</Link>
        <Link href="/student/vibelearn/topic-practice"><PencilLine size={20}/> Topic Practice</Link>
        <Link href="/student/vibelearn/revision"><RotateCcw size={20}/> Revision</Link>
        <Link href="/student/vibelearn/exams"><CalendarDays size={20}/> Exams</Link>
        <Link href="/student/resources"><BookOpen size={20}/> Shared materials</Link>
        <Link href={identity.classId ? '/student/projects' : '/student/projects/independent'}><FolderOpen size={20}/> Projects</Link>
        <Link href="/student/tutoring"><Users size={20}/> My tuition</Link>
        <Link href="/student/vibelearn/mistakes"><CheckCircle2 size={20}/> Review mistakes</Link>
      </nav>

      {error&&<p className={styles.alert} role="alert">{error}</p>}
      {loading?<p className={styles.card} role="status">Loading your current learning activities…</p>:
      <div className={styles.layout}>
        <section className={styles.card} aria-label="Continue reading">
          <h2>Continue reading</h2>
          {(workspace?.continueLearning.length??0)===0
            ? <p className={styles.muted}>Your saved reading will appear here after you open a textbook.</p>
            : <div className={styles.rows}>{workspace!.continueLearning.slice(0,6).map(item=>
              <Link key={item.publicationId} href={safeInternalRoute(item.actionUrl)} className={styles.item}>
                <span><strong>{item.title}</strong><small>{item.chapterTitle??'Continue textbook'} · {item.progressPercent}% read</small></span>
                <ArrowRight size={17}/>
              </Link>)}</div>}
        </section>
        <section className={styles.card} aria-label="Assigned learning">
          <h2>Assigned learning</h2>
          {assigned.length===0&&(workspace?.assignedAssessments.length??0)===0
            ? <p className={styles.muted}>No reading or assessments are currently assigned to your learner account.</p>
            : <div className={styles.rows}>
              {assigned.slice(0,5).map(item=><Link key={item.assignmentId} href={safeInternalRoute(item.actionUrl)} className={styles.item}>
                <span><strong>{item.title}</strong><small>{item.subjectName??'Reading'} · {item.chapterTitle}</small></span><ArrowRight size={17}/></Link>)}
              {(workspace?.assignedAssessments??[]).slice(0,5).map(item=>
                <Link key={item.assignmentId} href={safeInternalRoute(item.actionUrl)} className={styles.item}>
                  <span><strong>{item.title}</strong><small>{item.subjectName??'Assessment'} · {item.assessmentType.replaceAll('_',' ')}</small></span><ArrowRight size={17}/></Link>)}
            </div>}
        </section>
        <section className={styles.card} aria-label="Live class learning resources">
          <h2>Learn by subject</h2>
          <p className={styles.muted}>Live class resources that are linked to your current subject enrolments. Private and unpublished items are not shown.</p>
          {classResources.length===0
            ? <p className={styles.muted}>No class resource is live yet. Your tasks and published lessons remain available.</p>
            : <div className={styles.rows}>
                {classResources.map(item=>{
                  const href=safeResourceHref(item.url)
                  if(!href) return <div className={styles.item} key={item.id}><span><strong>{item.title}</strong>
                    <small>The link for this resource could not be verified.</small></span></div>
                  const subject=workspace?.subjects.find(s=>s.id===item.subject_id)?.name??'Class resource'
                  return <a key={item.id} className={styles.item} href={href}
                    target={href.startsWith('/')?undefined:'_blank'}
                    rel={href.startsWith('/')?undefined:'noopener noreferrer'}>
                    <span><strong>{item.title}</strong><small>{subject}{item.description?' · '+item.description:''}</small></span><ArrowRight size={17}/>
                  </a>
                })}
              </div>}
        </section>
        <section className={styles.card} aria-label="Available practice">
          <h2>Practise a subject</h2>
          {(workspace?.practiceBySubject.length??0)===0
            ? <p className={styles.muted}>Verified practice will appear when questions are available for your subjects.</p>
            : <div className={styles.rows}>{workspace!.practiceBySubject.slice(0,8).map(item=>
              <Link key={item.subject} href={safeInternalRoute(item.actionUrl,'/student/vibelearn/topic-practice')} className={styles.item}>
                <span><strong>{item.subject}</strong><small>{item.questionCount} verified questions</small></span><ArrowRight size={17}/></Link>)}</div>}
        </section>
        <section className={styles.card} aria-label="Your learning path">
          <h2>Your learning path</h2>
          <p className={styles.muted}>Build foundation first when earlier ideas need more practice. VibeLearn does not invent a weakness when evidence is missing.</p>
          {!learningPath || learningPath.path.length===0
            ? <p className={styles.muted}>Your verified learning priorities will appear when there is sufficient evidence.</p>
            : <div className={styles.rows}>
              {learningPath.path.slice(0,5).map(item=>
                <div key={item.outcomeId} className={styles.item}>
                  <span><strong>{item.outcomeText}</strong>
                    <small>{item.prerequisitesReady?'Ready for practice':'Build foundation first'} · Based on verified learning evidence</small></span>
                </div>)}
            </div>}
          <Link className={styles.secondary} href="/student/vibelearn/revision">Open revision <ArrowRight size={16}/></Link>
        </section>
        <section className={styles.card} aria-label="Recommended support">
          <h2>Recommended support</h2>
          {(!recommendations || recommendations.recommendations.length===0)
            ? <p className={styles.muted}>No approved support resource is available yet. Your current learning evidence is not treated as a weakness.</p>
            : <div className={styles.rows}>
              {recommendations.recommendations.filter(item=>item.certified&&item.actionUrl).slice(0,5).map(item=>
                <Link key={item.resourceId} href={safeInternalRoute(item.actionUrl)} className={styles.item}>
                  <span><strong>{item.title}</strong><small>{item.outcomeText}</small></span><ArrowRight size={17}/></Link>)}
            </div>}
        </section>
        {workspace?.twin.now&&<section className={styles.card} aria-label="Suggested next action">
          <h2>Your next helpful action</h2>
          <p className={styles.muted}>{workspace.twin.now.reason||'Based on your available learning evidence.'}</p>
          <p><strong>{workspace.twin.now.title}</strong></p>
          {workspace.twin.now.actionUrl&&<Link className={styles.secondary} href={safeInternalRoute(workspace.twin.now.actionUrl)}>
            {workspace.twin.now.actionLabel||'Open activity'} <ArrowRight size={16}/></Link>}
        </section>}
        {readiness&&<section className={styles.card} aria-label="Exam readiness plan">
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
          <p className={styles.muted}>{readiness.predictionDisclaimer}</p>
        </section>}
      </div>}
    </div>
  </main>
}

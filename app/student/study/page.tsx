'use client'
import StudentIntro from "@/components/student/StudentIntro";
import compact from "@/components/student/LearnerCompact.module.css";

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useStudent } from '@/lib/student-context'
import { supabase } from '@/lib/supabase'
import { ArrowRight, BookOpen, ClipboardList, CalendarDays, Compass, Gamepad2, PenLine, Search, LibraryBig, PencilLine, BrainCircuit, ChartNoAxesColumn, ChevronDown } from 'lucide-react'
import {
  getVibeLearnWorkstation, getAssignedReading, getExamReadinessBrief, updateExamReadiness,
  getAdaptiveLearningPath, getAdaptiveResourceRecommendations,
  type VibeLearnWorkstation, type AssignedReadingItem, type ExamReadinessBrief,
  type AdaptiveLearningPath, type AdaptiveResourceRecommendations,
} from '@/lib/student/vibelearn'
import styles from './study.module.css'
import StudentLearningFeatureLinks from '@/components/student/StudentLearningFeatureLinks'
import { recogniseLearnerGrade } from '@/lib/learn/schoolCatalog'

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
  const [moreOpen,setMoreOpen]=useState(false)
  const [moreLoading,setMoreLoading]=useState(false)
  const [moreLoaded,setMoreLoaded]=useState(false)
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
    setLoading(true);setError('');setMoreOpen(false);setMoreLoaded(false)
    setWorkspace(null);setAssigned([]);setClassResources([])
    setReadiness(null);setLearningPath(null);setRecommendations(null)
    void getVibeLearnWorkstation().then(brief=>{
      if(active)setWorkspace(brief)
    }).catch(reason=>{
      if(active)setError(reason instanceof Error?reason.message:'Your learning desk could not load.')
    }).finally(()=>{if(active)setLoading(false)})
    void getAssignedReading().then(reading=>{if(active)setAssigned(reading)}).catch(()=>undefined)
    return ()=>{active=false}
  },[identity?.studentId,identityLoading])

  // Defer optional evidence and class-resource requests until the learner opens
  // More. A slow support service must not delay opening a book or starting practice.
  useEffect(()=>{
    if(!moreOpen||loading||!workspace||moreLoaded)return
    let active=true
    setMoreLoading(true)
    Promise.all([
      isForm4?getExamReadinessBrief().catch(()=>null):Promise.resolve(null),
      getAdaptiveLearningPath().catch(()=>null),
      getAdaptiveResourceRecommendations().catch(()=>null),
      getLiveClassResources(workspace).catch(()=>[]),
    ]).then(([exam,path,support,resources])=>{
      if(!active)return
      setReadiness(exam);setLearningPath(path);setRecommendations(support);setClassResources(resources)
      if(exam){setExamDate(exam.examDate??'');setDailyMinutes(exam.dailyRevisionMinutes);setConfidence(exam.confidenceCheck)}
    }).finally(()=>{if(active){setMoreLoaded(true);setMoreLoading(false)}})
    return ()=>{active=false}
  },[moreOpen,loading,workspace,moreLoaded,isForm4,identity?.studentId])

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
  const grade = recogniseLearnerGrade(identity.className)
  const browseHref = grade ? '/learn?grade=' + encodeURIComponent(grade) : '/learn'
  return <main className={styles.page}>
    <div className={styles.wrap}>
      <div className={styles.screen}>
        <header className={styles.topBar}>
          <div className={styles.heading}>
            <h1>Learn</h1>
            {identity.className && <span className={styles.grade}>{identity.className}</span>}
          </div>
          <Link href={browseHref} className={styles.findLink}><Search size={17} aria-hidden="true"/> Find a lesson</Link>
        </header>
        <section className={styles.resume} aria-label="Reading">
          {!loading && savedReading.length > 0 ? savedReading.slice(0,1).map(item =>
            <div key={item.publicationId} className={styles.resumeContent}>
              <span className={styles.eyebrow}>Continue reading</span>
              <h2>{item.title}</h2>
              {item.chapterTitle && <p className={styles.resumeMeta}>{item.chapterTitle}</p>}
              <span className={styles.progressLabel}>{Math.round(Math.max(0,Math.min(100,item.progressPercent)))}% read</span>
              <div className={styles.progressTrack} role="progressbar" aria-label="Reading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.max(0,Math.min(100,item.progressPercent)))}>
                <div style={{width: Math.max(0,Math.min(100,item.progressPercent)) + '%'}}/>
              </div>
              <Link href={safeInternalRoute(item.actionUrl)} className={styles.resumeAction}><span>Continue</span><ArrowRight size={18} aria-hidden="true"/></Link>
            </div>
          ) : loading ? <p className={styles.resumeLoading} role="status">Finding your last lesson…</p> :
            <div className={styles.resumeContent}>
              <span className={styles.eyebrow}>Start learning</span>
              <h2>What would you like to learn?</h2>
              <Link href={browseHref} className={styles.resumeAction}>Browse lessons <ArrowRight size={18} aria-hidden="true"/></Link>
            </div>}
        </section>
        <section className={styles.learningSection} aria-label="Learning tools">
          <h2 className={styles.sectionTitle}>Choose what to do</h2>
          <nav className={styles.learningGrid} aria-label="Learn destinations">
            <Link href={browseHref} className={styles.learningTile}><span className={styles.tileIcon}><BookOpen size={22} aria-hidden="true"/></span><span>Books & lessons</span><ArrowRight className={styles.tileArrow} size={15} aria-hidden="true"/></Link>
            <Link href="/student/vibelearn/topic-practice" className={styles.learningTile}><span className={styles.tileIcon}><PencilLine size={22} aria-hidden="true"/></span><span>Practice</span><ArrowRight className={styles.tileArrow} size={15} aria-hidden="true"/></Link>
            <Link href="/learn/stories" className={styles.learningTile}><span className={styles.tileIcon}><LibraryBig size={22} aria-hidden="true"/></span><span>Stories</span><ArrowRight className={styles.tileArrow} size={15} aria-hidden="true"/></Link>
            <Link href="/student/explore" className={styles.learningTile}><span className={styles.tileIcon}><Compass size={22} aria-hidden="true"/></span><span>Explore</span><ArrowRight className={styles.tileArrow} size={15} aria-hidden="true"/></Link>
          </nav>
          <nav className={styles.creativeLinks} aria-label="Creative activities">
            <Link href="/student/funhub"><Gamepad2 size={17} aria-hidden="true"/> Play & learn <ArrowRight size={14} aria-hidden="true"/></Link>
            <Link href="/student/create"><PenLine size={17} aria-hidden="true"/> Create <ArrowRight size={14} aria-hidden="true"/></Link>
          </nav>
        </section>
        {!loading && assigned.length > 0 && <section className={styles.teacherRow} aria-label="Assigned reading">
          <span className={styles.eyebrow}>From your teacher</span>
          <Link href={safeInternalRoute(assigned[0].actionUrl)}>{assigned[0].title}<ArrowRight size={16} aria-hidden="true"/></Link>
        </section>}
      {error&&<p className={styles.alert} role="alert">{error}</p>}
        <details className={styles.more} onToggle={event=>setMoreOpen(event.currentTarget.open)}>
          <summary>More learning <ChevronDown size={17} aria-hidden="true"/></summary>
          <div className={styles.moreBody}>
            <nav className={styles.moreNav} aria-label="Additional learning tools">
              <Link href="/student/vibelearn/exams"><CalendarDays size={17} aria-hidden="true"/> My Exams</Link>
              <Link href="/student/vibelearn/revision"><BrainCircuit size={17} aria-hidden="true"/> Revision</Link>
              <Link href="/student/tasks"><ClipboardList size={17} aria-hidden="true"/> My tasks</Link>
              <Link href="/student/marks"><ChartNoAxesColumn size={17} aria-hidden="true"/> Progress</Link>
            </nav>
            {!loading && savedReading.length > 1 && <section className={styles.advancedBlock}>
              <h3>Other saved reading</h3>
              {savedReading.slice(1).map(item => <Link key={item.publicationId} href={safeInternalRoute(item.actionUrl)} className={styles.item}>{item.title} · {Math.round(item.progressPercent)}% <ArrowRight size={16}/></Link>)}
            </section>}
            <details className={styles.advancedBlock}><summary>More reading tools</summary><StudentLearningFeatureLinks mode="learn" grade={identity.className}/></details>
            <StudentIntro feature="learn-overview"><p>Open a lesson, continue reading or choose a learning activity.</p></StudentIntro>
      {!loading && !workspace ? <p className={styles.card} role="status">Personal learning details are unavailable. You can still browse books and practise.</p> : !moreLoaded?<p className={styles.card} role="status">Opening more learning…</p>:
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
        </details>
      </div>
    </div>
  </main>
}

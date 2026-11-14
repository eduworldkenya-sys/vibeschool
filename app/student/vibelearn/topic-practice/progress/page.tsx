'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useStudent } from '@/lib/student-context'
import { supabase } from '@/lib/supabase'
import { listMyAssessmentAssignments, type LearnerAssessmentAssignment } from '@/lib/assessment/discovery'

type TopicSummary = {
  assignment_id: string
  subject: string
  topic: string
  in_progress: boolean
  completed_attempts: number
  max_attempts: number
}

function parseTopics(value: unknown): TopicSummary[] {
  if (!Array.isArray(value)) throw new Error('Topic Practice history could not be read.')
  return value.flatMap((item): TopicSummary[] => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const row = item as Record<string, unknown>
    if (typeof row.assignment_id !== 'string' || typeof row.subject !== 'string' || typeof row.topic !== 'string') return []
    return [{
      assignment_id: row.assignment_id,
      subject: row.subject,
      topic: row.topic,
      in_progress: row.in_progress === true,
      completed_attempts: typeof row.completed_attempts === 'number' ? row.completed_attempts : 0,
      max_attempts: typeof row.max_attempts === 'number' ? row.max_attempts : 0,
    }]
  })
}

const shell: React.CSSProperties = {maxWidth:780,margin:'0 auto',padding:'20px 14px 120px',color:'var(--vs-text)'}
const card: React.CSSProperties = {background:'var(--vs-card)',border:'1px solid var(--vs-border)',borderRadius:16,padding:18,marginTop:14}
const link: React.CSSProperties = {color:'var(--vs-accent)',fontWeight:750,textDecoration:'none'}
const muted: React.CSSProperties = {color:'var(--vs-muted)',fontSize:13,lineHeight:1.5}

export default function TopicPracticeProgressPage() {
  const {identity,loading:identityLoading}=useStudent()
  const params=useSearchParams()
  const subject=params.get('subject')?.trim().toLowerCase()??''
  const [topics,setTopics]=useState<TopicSummary[]>([])
  const [assignments,setAssignments]=useState<LearnerAssessmentAssignment[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const className=identity?.className?.trim()??''
  const match=className.match(/^(Grade\s*(?:[1-9]|1[0-2])|Form\s*[1-4])(?:\s+.+)?$/i)
  const grade=match?.[1]?.replace(/\s+/g,' ').replace(/^grade/i,'Grade').replace(/^form/i,'Form')??''
  const supported=/^grade\s*(?:4|9)$/i.test(grade)

  useEffect(()=>{
    if(identityLoading)return
    if(!identity || !supported){setLoading(false);return}
    let cancelled=false
    setLoading(true);setError('')
    Promise.all([
      supabase.rpc('student_list_canonical_topic_practice' as never,{p_grade:grade}).then(({data,error:rpcError})=>{
        if(rpcError)throw new Error(rpcError.message)
        return parseTopics(data)
      }),
      listMyAssessmentAssignments(),
    ]).then(([items,results])=>{
      if(!cancelled){setTopics(items);setAssignments(results)}
    }).catch(cause=>{if(!cancelled)setError(cause instanceof Error?cause.message:'Could not load practice progress.')})
      .finally(()=>{if(!cancelled)setLoading(false)})
    return ()=>{cancelled=true}
  },[identityLoading,identity?.studentId,grade,supported])

  const visible=useMemo(()=>topics.filter(item=>!subject||item.subject.toLowerCase()===subject),[topics,subject])
  const byAssignment=useMemo(()=>new Map(assignments.map(a=>[a.assignmentId,a])),[assignments])
  const completed=visible.reduce((total,item)=>total+item.completed_attempts,0)
  const continuing=visible.filter(item=>item.in_progress).length

  return <main style={shell}>
    <nav aria-label="Topic Practice progress navigation" style={{display:'flex',gap:15,flexWrap:'wrap'}}>
      <Link href={'/student/vibelearn/topic-practice'+(subject?'?subject='+encodeURIComponent(subject):'')} style={link}>← Topic Practice</Link>
      <Link href="/student/marks" style={link}>Overall progress</Link>
    </nav>
    <h1 style={{margin:'22px 0 6px',fontSize:29}}>Topic Practice progress</h1>
    <p style={muted}>Your practice attempts and latest available results, kept separate from overall learner progress.</p>
    {identityLoading||loading?<p role="status">Loading your practice records…</p>
      : !identity?<section style={card}>Sign in to see your own practice progress.</section>
      : !supported?<section style={card}>Canonical Topic Practice progress is currently available for Grade 4 and Grade 9.</section>
      : error?<section role="alert" style={card}>{error}</section>
      : <>
        <section style={card} aria-label="Practice summary">
          <strong style={{fontSize:22}}>{completed} completed attempt{completed===1?'':'s'}</strong>
          <p style={muted}>{visible.length} published set{visible.length===1?'':'s'} · {continuing} in progress · {grade}</p>
        </section>
        {visible.length===0?<section style={card}>No published practice sets match this subject yet. <Link href="/student/vibelearn/topic-practice" style={link}>Explore available topics</Link></section>
          : <section aria-label="Progress by topic">{visible.map(item=>{
            const latest=byAssignment.get(item.assignment_id)
            const scoreVisible=latest?.attemptId && (latest.resultStatus==='released' || (latest.assessmentType==='practice' && latest.showScorePolicy==='immediate' && latest.resultStatus==='marked'))
            const practiceHref='/student/vibelearn/topic-practice?subject='+encodeURIComponent(item.subject)+'&topic='+encodeURIComponent(item.topic)
            return <article key={item.assignment_id} style={card}>
              <h2 style={{margin:'0 0 6px',fontSize:18}}>{item.topic}</h2>
              <p style={{...muted,margin:'0 0 12px'}}>{item.subject} · {item.completed_attempts} of {item.max_attempts} allowed attempts completed{item.in_progress?' · In progress':''}</p>
              {scoreVisible && latest?.score!==null && latest?.maxScore!==null
                ? <p style={{margin:'0 0 12px',fontWeight:750}}>Latest available score: {latest?.score}/{latest?.maxScore}</p>
                : <p style={{...muted,margin:'0 0 12px'}}>No released score is available for the latest attempt.</p>}
              <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
                <Link href={practiceHref} style={link}>{item.in_progress?'Continue practice':'Open topic'}</Link>
                {scoreVisible && latest?.attemptId && <Link href={'/student/results/'+encodeURIComponent(latest.attemptId)+'?from=topic-practice'} style={link}>View saved result</Link>}
              </div>
            </article>
          })}</section>}
      </>}
  </main>
}

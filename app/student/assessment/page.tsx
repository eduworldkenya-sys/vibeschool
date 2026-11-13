'use client'
export const dynamic = 'force-dynamic'

import {useEffect,useMemo,useState} from 'react'
import {useRouter} from 'next/navigation'
import Link from 'next/link'
import {listMyAssessmentAssignments,type LearnerAssessmentAssignment} from '@/lib/assessment/discovery'

function isClasswork(item:LearnerAssessmentAssignment):boolean {
  // Timed practice and formal exams belong in the Exams hub, not Classwork.
  const kind=item.assessmentType.toLowerCase()
  return kind!=='exam' && kind!=='formal_exam' && kind!=='mock_exam' &&
    !(kind==='practice' && item.timeLimitMinutes!==null)
}
function resultAvailable(item:LearnerAssessmentAssignment):boolean {
  return Boolean(item.attemptId && item.percentage!==null &&
    (item.resultStatus==='released'||(item.resultStatus==='marked'&&item.showScorePolicy==='immediate')))
}
function actionLabel(item:LearnerAssessmentAssignment):string {
  if(resultAvailable(item))return 'Review result'
  if(item.attemptStatus==='in_progress')return 'Continue'
  if(item.availability==='upcoming')return 'Not open yet'
  if(item.availability==='closed')return 'Closed'
  if(item.availability==='attempts_exhausted')return 'Attempts used'
  return 'Start classwork'
}

export default function StudentAssessmentsPage(){
  const router=useRouter()
  const [items,setItems]=useState<LearnerAssessmentAssignment[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  useEffect(()=>{
    let active=true
    void listMyAssessmentAssignments()
      .then(items=>{if(active)setItems(items)})
      .catch(err=>{if(active)setError(err instanceof Error?err.message:'Classwork could not be loaded.')})
      .finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[])
  const classwork=useMemo(()=>items.filter(isClasswork),[items])
  const open=(item:LearnerAssessmentAssignment)=>{
    if(resultAvailable(item) && item.attemptId){router.push('/student/results/'+encodeURIComponent(item.attemptId));return}
    if(item.canStart||item.attemptStatus==='in_progress')
      router.push('/student/assessment/'+encodeURIComponent(item.assignmentId))
  }
  return <main style={{maxWidth:890,margin:'0 auto',padding:'10px 0 60px',color:'var(--vs-text)'}}>
    <header style={{marginBottom:19}}>
      <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:1.3,color:'var(--vs-accent)',fontWeight:800}}>Assigned work</div>
      <h1 style={{fontSize:'clamp(24px,3vw,31px)',letterSpacing:'-.04em',margin:'7px 0'}}>Classwork & Quizzes</h1>
      <p style={{fontSize:13,color:'var(--vs-muted)',lineHeight:1.6}}>Open your classwork in one place. Timed exams, Topic Practice and released results have their own clear destinations.</p>
    </header>
    <section aria-label="Available classwork" style={{display:'grid',gap:11}}>
      {loading?<div role="status" style={card}>Loading classwork…</div>:
       error?<div role="alert" style={{...card,color:'var(--vs-error)'}}>{error}</div>:
       classwork.length===0?<div style={card}><strong>Nothing assigned here yet.</strong><p style={muted}>Your teacher's quizzes and classwork will appear here when they are ready.</p><Link style={link} href="/student/tasks">Open My Tasks</Link></div>:
       classwork.map(item=>{
         const active=item.attemptStatus==='in_progress'
         const available=item.canStart||active||resultAvailable(item)
         return <article key={item.assignmentId} style={card}>
           <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
             <span style={status}>{item.assessmentType.replaceAll('_',' ')}</span>
             <span style={muted}>{item.closesAt?'Due '+new Date(item.closesAt).toLocaleDateString('en-KE'):item.availability.replaceAll('_',' ')}</span>
           </div>
           <h2 style={{fontSize:17,margin:'11px 0 5px',lineHeight:1.4}}>{item.title}</h2>
           {item.instructions&&<p style={muted}>{item.instructions}</p>}
           <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',margin:'10px 0'}}>
             {item.timeLimitMinutes!==null&&<span style={chip}>{item.timeLimitMinutes} min</span>}
             {item.attemptNumber&&<span style={chip}>Attempt {item.attemptNumber}/{item.maxAttempts}</span>}
             {resultAvailable(item)&&<span style={chip}>{item.percentage?.toFixed(0)}% result ready</span>}
           </div>
           <button type="button" disabled={!available} onClick={()=>open(item)} style={{...primary,opacity:available?1:.55}}>{actionLabel(item)}</button>
         </article>
       })}
    </section>
    <nav aria-label="Other learning activities" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10,marginTop:19}}>
      <Link href="/student/vibelearn/exams" style={link}>Exams and timed practice →</Link>
      <Link href="/student/vibelearn/topic-practice" style={link}>Untimed Topic Practice →</Link>
      <Link href="/student/marks" style={link}>Results and progress →</Link>
    </nav>
  </main>
}
const card:React.CSSProperties={border:'1px solid var(--vs-border)',borderRadius:16,padding:18,background:'var(--vs-card)'}
const muted:React.CSSProperties={fontSize:12,color:'var(--vs-muted)',lineHeight:1.55,margin:0}
const primary:React.CSSProperties={border:0,background:'var(--vs-accent)',color:'var(--vs-on-accent)',padding:'12px 16px',borderRadius:12,minHeight:44,fontSize:13,fontWeight:800,cursor:'pointer'}
const link:React.CSSProperties={border:'1px solid var(--vs-border)',borderRadius:12,minHeight:45,padding:'12px 14px',fontSize:12,color:'var(--vs-accent)',background:'var(--vs-card)',fontWeight:800,textDecoration:'none',display:'flex',alignItems:'center'}
const status:React.CSSProperties={background:'var(--vs-accent-soft)',color:'var(--vs-accent)',borderRadius:999,padding:'5px 9px',fontSize:10,fontWeight:800,textTransform:'capitalize'}
const chip:React.CSSProperties={background:'var(--vs-soft)',color:'var(--vs-muted)',borderRadius:8,padding:'4px 8px',fontSize:10,fontWeight:750}

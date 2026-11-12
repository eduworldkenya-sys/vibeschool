'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import VibeLearnSubnav from '@/components/student/VibeLearnSubnav'
import { useStudent } from '@/lib/student-context'
import { getRevisionWorkspace, isCurrentGradeMistake, type RevisionWorkspace } from '@/lib/student/vibelearn'

export default function VibeLearnMistakesPage() {
  const router = useRouter()
  const { identity } = useStudent()
  const isForm4 = /^form\s*4$/i.test(identity?.className?.trim() ?? '')
  const [workspace, setWorkspace] = useState<RevisionWorkspace | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => { try { setWorkspace(await getRevisionWorkspace()) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load mistakes.') } finally { setLoading(false) } }, [])
  useEffect(() => { void load() }, [load])

  const mistakes = workspace?.mistakes ?? []
  const currentMistakes = mistakes.filter(item => isCurrentGradeMistake(item, identity?.className))
  const historicMistakes = mistakes.filter(item => !isCurrentGradeMistake(item, identity?.className))
  return <main style={shell}><div className="vs-learn-page" style={{maxWidth:1040,margin:'0 auto'}}><VibeLearnSubnav/>
    <section style={hero}><div style={eyebrow}>Mistake notebook</div><h1 style={{margin:'7px 0 5px'}}>Mistakes become recovery evidence</h1><p style={{margin:0,color:'#64748b',lineHeight:1.6}}>Recover the exact learning outcome, review the explanation, practise and answer a new question. Opening a resource is not evidence of mastery.</p></section>
    {error && <section style={{...card,color:'#b91c1c'}}>{error}</section>}
    {loading ? <section style={card}>Loading your mistakes…</section> : <section style={card}>{currentMistakes.length===0 ? <div><strong>No eligible current-grade mistakes to recover.</strong><p style={muted}>New wrong or skipped answers will appear here after scoring. Historical practice is kept separately below.</p></div> : <div style={{display:'grid',gap:10}}>{currentMistakes.map(item => <article key={item.id} style={{...mistakeCard,opacity:item.status==='resolved'?0.72:1}}><div style={{display:'flex',justifyContent:'space-between',gap:10}}><div><strong>{item.subject} · {item.topic}</strong><div style={muted}>{item.status}</div></div><span style={pill}>{item.repeatCount}× missed</span></div><p style={{lineHeight:1.5}}>{item.prompt}</p>{item.explanation&&<details style={{margin:'9px 0',fontSize:13,color:'#475569'}}><summary style={{cursor:'pointer',fontWeight:700,color:'#4338ca',padding:'6px 0'}}>Show explanation</summary><p style={{...muted,fontSize:13,marginTop:8}}>{item.explanation}</p></details>}<div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}>{item.reviewUrl&&<button style={secondaryButton} onClick={()=>router.push(item.reviewUrl!)}>Review source</button>}<button style={secondaryButton} onClick={()=>router.push(`${isForm4 ? '/student/vibelearn/kcse/practice' : '/student/vibelearn/practice'}?subject=${encodeURIComponent(item.subject)}&topic=${encodeURIComponent(item.topic)}`)}>Practise topic</button><button style={primaryButton} onClick={()=>router.push(`/student/vibelearn/recovery?mistake=${encodeURIComponent(item.id)}`)}>Recover exact outcome</button></div></article>)}</div>}</section>}
    {!loading && historicMistakes.length>0 && <section style={card}>
      <details>
        <summary style={{cursor:'pointer',fontWeight:800}}>Past or unverified practice ({historicMistakes.length})</summary>
        <p style={muted}>These records are preserved for review, but are not recommendations for your current grade. Unverified source questions cannot count as certified recovery.</p>
        <div style={{display:'grid',gap:8,marginTop:12}}>{historicMistakes.map(item => <article key={item.id} style={{...mistakeCard,background:'#f8fafc',borderColor:'#e2e8f0'}}>
          <strong>{item.subject} · {item.topic}</strong>
          <p style={muted}>{item.sourceGrade ?? 'Grade not recorded'} · {item.sourceVerified?'Verified source':'Source verification pending'}</p>
          <p style={{lineHeight:1.5}}>{item.prompt}</p>
          {item.explanation && <details><summary style={{cursor:'pointer'}}>Review earlier explanation</summary><p style={muted}>{item.explanation}</p></details>}
        </article>)}</div>
      </details>
    </section>}
  </div></main>
}
const shell:React.CSSProperties={minHeight:'100vh',background:'#f8fafc',padding:'18px 14px 90px',color:'#0f172a',fontFamily:"'Plus Jakarta Sans', sans-serif"}
const hero:React.CSSProperties={background:'#ffffff',border:'1px solid #e2e8f0',color:'#0f172a',borderRadius:20,padding:20,marginBottom:12}
const card:React.CSSProperties={background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:16,marginBottom:12}
const eyebrow:React.CSSProperties={fontSize:10,fontWeight:900,textTransform:'uppercase',letterSpacing:1.1,color:'#4f46e5'}
const muted:React.CSSProperties={fontSize:13,color:'#64748b',margin:'5px 0',lineHeight:1.55}
const mistakeCard:React.CSSProperties={border:'1px solid #fed7aa',background:'#fff7ed',borderRadius:13,padding:13}
const pill:React.CSSProperties={fontSize:10,fontWeight:800,color:'#7c2d12',background:'#ffedd5',borderRadius:999,padding:'4px 8px',height:'fit-content'}
const primaryButton:React.CSSProperties={border:'none',background:'#4f46e5',color:'#fff',borderRadius:10,padding:'8px 11px',fontWeight:800,cursor:'pointer',fontFamily:'inherit'}
const secondaryButton:React.CSSProperties={border:'1px solid #c7d2fe',background:'#eef2ff',color:'#4338ca',borderRadius:10,padding:'8px 11px',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}

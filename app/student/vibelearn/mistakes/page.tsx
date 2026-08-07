'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import VibeLearnSubnav from '@/components/student/VibeLearnSubnav'
import { getRevisionWorkspace, type RevisionWorkspace } from '@/lib/student/vibelearn'
import { verifyMistakeMastery } from '@/lib/student/kcse'

export default function VibeLearnMistakesPage() {
  const router = useRouter()
  const [workspace, setWorkspace] = useState<RevisionWorkspace | null>(null)
  const [working, setWorking] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => { try { setWorkspace(await getRevisionWorkspace()) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load mistakes.') } finally { setLoading(false) } }, [])
  useEffect(() => { void load() }, [load])

  async function verify(id: string) {
    setWorking(id); setError(''); setMessage('')
    try {
      const result = await verifyMistakeMastery(id)
      setMessage(result.resolved ? 'Mastery verified from later practice evidence.' : `Not mastered yet: ${result.correct_since_miss}/${result.attempts_since_miss} correct across ${result.distinct_practice_days} day(s). Required: ${result.required}.`)
      await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not verify mastery.') }
    finally { setWorking(null) }
  }

  const mistakes = workspace?.mistakes ?? []
  return <main style={shell}><div style={{maxWidth:900,margin:'0 auto'}}><VibeLearnSubnav/>
    <section style={hero}><div style={eyebrow}>Mistake notebook</div><h1 style={{margin:'7px 0 5px'}}>Mistakes become recovery evidence</h1><p style={{margin:0,color:'#cbd5e1',lineHeight:1.6}}>A mistake is resolved only after later practice proves mastery. Clicking a button cannot manufacture understanding.</p></section>
    {error && <section style={{...card,color:'#b91c1c'}}>{error}</section>}{message && <section style={{...card,borderColor:'#a7f3d0',background:'#ecfdf5'}}>{message}</section>}
    {loading ? <section style={card}>Loading your mistakes…</section> : <section style={card}>{mistakes.length===0 ? <div><strong>No mistakes recorded yet.</strong><p style={muted}>Wrong practice answers will appear here automatically.</p></div> : <div style={{display:'grid',gap:10}}>{mistakes.map(item => <article key={item.id} style={{...mistakeCard,opacity:item.status==='resolved'?0.72:1}}><div style={{display:'flex',justifyContent:'space-between',gap:10}}><div><strong>{item.subject} · {item.topic}</strong><div style={muted}>{item.status}</div></div><span style={pill}>{item.repeatCount}× missed</span></div><p style={{lineHeight:1.5}}>{item.prompt}</p>{item.explanation&&<p style={muted}>{item.explanation}</p>}<div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}>{item.reviewUrl&&<button style={secondaryButton} onClick={()=>router.push(item.reviewUrl!)}>Review source</button>}<button style={secondaryButton} onClick={()=>router.push(`/student/vibelearn/kcse/practice?subject=${encodeURIComponent(item.subject)}&topic=${encodeURIComponent(item.topic)}`)}>Practise topic</button>{item.status!=='resolved'&&<button style={primaryButton} disabled={working===item.id} onClick={()=>void verify(item.id)}>{working===item.id?'Checking evidence…':'Verify mastery'}</button>}</div></article>)}</div>}</section>}
  </div></main>
}
const shell:React.CSSProperties={minHeight:'100vh',background:'#f8fafc',padding:'18px 14px 90px',color:'#0f172a',fontFamily:"'Plus Jakarta Sans', sans-serif"}
const hero:React.CSSProperties={background:'linear-gradient(135deg,#0f172a,#7c2d12)',color:'#fff',borderRadius:20,padding:20,marginBottom:12}
const card:React.CSSProperties={background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:16,marginBottom:12}
const eyebrow:React.CSSProperties={fontSize:10,fontWeight:900,textTransform:'uppercase',letterSpacing:1.1,color:'#fed7aa'}
const muted:React.CSSProperties={fontSize:12,color:'#64748b',margin:'5px 0',lineHeight:1.55}
const mistakeCard:React.CSSProperties={border:'1px solid #fed7aa',background:'#fff7ed',borderRadius:13,padding:13}
const pill:React.CSSProperties={fontSize:10,fontWeight:800,color:'#7c2d12',background:'#ffedd5',borderRadius:999,padding:'4px 8px',height:'fit-content'}
const primaryButton:React.CSSProperties={border:'none',background:'#4f46e5',color:'#fff',borderRadius:10,padding:'8px 11px',fontWeight:800,cursor:'pointer',fontFamily:'inherit'}
const secondaryButton:React.CSSProperties={border:'1px solid #c7d2fe',background:'#eef2ff',color:'#4338ca',borderRadius:10,padding:'8px 11px',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}

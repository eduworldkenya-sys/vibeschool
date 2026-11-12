'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import VibeLearnSubnav from '@/components/student/VibeLearnSubnav'
import { supabase } from '@/lib/supabase'
import { recordGroundedPracticeAnswer } from '@/lib/student/vibelearn'

type Source = { block_id: string; title: string; block_type: string; url: string }
type Question = { content_block_id: string; outcome_id: string; prompt: string }
type Recovery = {
  recovery_key: string
  origin: 'released_assessment' | 'practice_notebook'
  attempt_id: string | null
  assessment_item_id: string | null
  reason: 'skipped' | 'incorrect'
  prompt: string
  context_title: string
  missed_at: string
  outcome_id: string | null
  outcome_code: string | null
  outcome_text: string | null
  identity_state: 'verified' | 'outcome_unlinked' | 'outcome_not_verified'
  core: Source | null
  activity: Source | null
  reassessment: Question | null
  reassessment_attempts: number
  correct_distinct_questions: number
  correct_distinct_days: number
  recovery_evidence_met: boolean
}
type Payload = { ok: boolean; cases: Recovery[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function parsePayload(value: unknown): Payload {
  if (!isRecord(value) || value.ok !== true || !Array.isArray(value.cases)) {
    throw new Error('Recovery evidence could not be verified.')
  }
  return { ok: true, cases: value.cases.filter((c): c is Recovery =>
    isRecord(c) && typeof c.recovery_key === 'string' &&
    typeof c.prompt === 'string' &&
    ['verified', 'outcome_unlinked', 'outcome_not_verified'].includes(String(c.identity_state))
  ) }
}

export default function ExactLearningRecoveryPage() {
  const router = useRouter()
  const search = useSearchParams()
  const attemptId = search.get('attempt')
  const mistakeId = search.get('mistake')
  const assessmentItemId = search.get('item')
  const [cases, setCases] = useState<Recovery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [answers, setAnswers] = useState<Record<string,string>>({})
  const [feedback, setFeedback] = useState<Record<string,string>>({})
  const [working, setWorking] = useState<string | null>(null)
  const startedAt = useRef<Record<string,number>>({})

  const load = useCallback(async () => {
    const { data, error: dbError } = await supabase.rpc(
      'student_get_exact_learning_recovery' as never,
      { p_attempt_id: attemptId || null, p_limit: 80 } as never
    )
    if (dbError) throw new Error(dbError.message)
    setCases(parsePayload(data).cases)
  }, [attemptId])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const fetch = async () => {
      try { await load() }
      catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Could not load recovery.') }
      finally { if (active) setLoading(false) }
    }
    void fetch()
    return () => { active = false }
  }, [load])

  const displayed = mistakeId
    ? cases.filter(item => item.recovery_key === `notebook:${mistakeId}`)
    : assessmentItemId
      ? cases.filter(item => item.assessment_item_id === assessmentItemId)
      : cases

  async function reassess(item: Recovery) {
    if (!item.reassessment || !item.outcome_id || working) return
    const key = item.recovery_key
    const answer = answers[key]?.trim()
    if (!answer) {
      setFeedback(previous => ({ ...previous, [key]: 'Enter an answer before checking.' }))
      return
    }
    setWorking(key)
    setFeedback(previous => ({ ...previous, [key]: '' }))
    try {
      const response = await recordGroundedPracticeAnswer({
        contentBlockId: item.reassessment.content_block_id,
        responseText: answer,
        responseMs: Math.max(0, Date.now() - (startedAt.current[key] ?? Date.now())),
        sessionId: null,
      })
      if (!isRecord(response) || response.ok !== true ||
          response.outcome_id !== item.outcome_id) {
        throw new Error('The marked question did not confirm the required outcome. No recovery credit was claimed.')
      }
      const correct = response.correct === true
      setFeedback(previous => ({
        ...previous,
        [key]: correct
          ? 'Correct. Your answer has been recorded as evidence. One answer alone does not prove mastery.'
          : 'Not correct yet. Review the explanation and activity before trying a different question.',
      }))
      setAnswers(previous => ({ ...previous, [key]: '' }))
      startedAt.current[key] = Date.now()
      await load()
    } catch (cause) {
      setFeedback(previous => ({
        ...previous,
        [key]: cause instanceof Error ? cause.message : 'The answer was not recorded. Try again.',
      }))
    } finally { setWorking(null) }
  }

  return <main style={shell}><div style={{maxWidth:860,margin:'0 auto'}}>
    <VibeLearnSubnav />
    <button style={link} onClick={() => router.push(attemptId ? `/student/results/${encodeURIComponent(attemptId)}` : '/student/vibelearn/mistakes')}>← Back</button>
    <header style={hero}>
      <div style={kicker}>Exact learning recovery</div>
      <h1 style={{margin:'6px 0'}}>Understand. Practise. Prove it.</h1>
      <p style={muted}>Each missed or skipped answer is connected to its exact curriculum outcome. Reading and opening activities are not counted as completed learning. Only later, independently marked answers provide reassessment evidence.</p>
    </header>
    {error && <section role="alert" style={card}><strong>Recovery could not be loaded.</strong><p style={muted}>Your recorded attempts are safe. Please retry to load your learning steps.</p><button style={secondary} onClick={() => { setLoading(true); setError(''); void load().catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load recovery.')).finally(() => setLoading(false)) }}>Retry recovery</button></section>}
    {loading ? <section style={card}>Checking your recorded learning evidence…</section>
    : error ? null
    : displayed.length === 0 ? <section style={card}>No missed or skipped questions with released results are available for this view.</section>
    : displayed.map(item => {
      const verified = item.identity_state === 'verified'
      const question = item.reassessment
      const evidence = item.recovery_evidence_met
      return <article style={card} key={item.recovery_key}>
        <div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
          <span style={kicker}>{item.context_title}</span>
          <span style={{...tag,color:item.reason==='skipped'?'#9a3412':'#7c2d12'}}>{item.reason === 'skipped' ? 'Skipped' : 'Needs another look'}</span>
        </div>
        <h2 style={{fontSize:18,margin:'12px 0'}}>{item.prompt}</h2>
        <div style={outcome}>
          <strong>Exact learning outcome</strong>
          <p style={{margin:'5px 0 0'}}>{item.outcome_text || 'No verified curriculum outcome is attached yet.'}</p>
          {item.outcome_code && <small>Outcome {item.outcome_code}</small>}
        </div>
        {!verified ? <div style={notice}>
          <strong>Curriculum verification required</strong>
          <p style={{margin:'5px 0 0'}}>This question does not yet have a verified learning-outcome link. VibeSchool will not guess from its subject or topic, or recommend unrelated content.</p>
        </div> : <>
          <div style={steps}>
            <section style={step}>
              <strong>1 · Relearn the explanation</strong>
              {item.core ? <><p style={muted}>{item.core.title}</p><button style={secondary} onClick={() => router.push(item.core!.url)}>Open exact explanation</button></>
                : <p style={muted}>No accessible, published core explanation is linked to this outcome yet.</p>}
            </section>
            <section style={step}>
              <strong>2 · Practise the skill</strong>
              {item.activity ? <><p style={muted}>{item.activity.title}</p><button style={secondary} onClick={() => router.push(item.activity!.url)}>Open supplementary activity</button></>
                : <p style={muted}>No accessible, published activity is linked to this outcome yet.</p>}
            </section>
            <section style={step}>
              <strong>3 · Try a fresh question</strong>
              {question ? <>
                <p style={{lineHeight:1.55,margin:'9px 0'}}>{question.prompt}</p>
                <label style={{display:'block',fontSize:13,fontWeight:700}} htmlFor={`answer-${item.recovery_key}`}>Your answer</label>
                <input id={`answer-${item.recovery_key}`} value={answers[item.recovery_key] ?? ''}
                  onChange={event=>setAnswers(previous=>({...previous,[item.recovery_key]:event.target.value}))}
                  disabled={working===item.recovery_key} style={input} maxLength={1000} autoComplete="off" />
                <button style={primary} disabled={working!==null || !(answers[item.recovery_key] ?? '').trim()}
                  onClick={() => void reassess(item)}>{working===item.recovery_key?'Checking…':'Check answer'}</button>
              </> : <p style={muted}>No unused, server-markable question for this exact outcome is available. Nothing has been marked complete.</p>}
              {feedback[item.recovery_key] && <p role="status" style={{...muted,marginTop:12}}>{feedback[item.recovery_key]}</p>}
            </section>
          </div>
          <div style={{...outcome,marginTop:14}}>
            <strong>Evidence, not a tick box</strong>
            <p style={{margin:'5px 0'}}>Later scored attempts: {item.reassessment_attempts}. Distinct correct questions: {item.correct_distinct_questions}. Different practice days: {item.correct_distinct_days}.</p>
            <p style={{margin:'5px 0 0',fontWeight:700}}>{evidence
              ? 'Repeat recovery evidence threshold met. This is not an automatic overall mastery award.'
              : item.reassessment_attempts>0 ? 'Reassessment recorded; stronger evidence is still needed.'
                : 'No reassessment evidence recorded yet.'}</p>
            <small>Recovery evidence threshold: 3 different correct questions across at least 2 days.</small>
          </div>
        </>}
      </article>
    })}
  </div></main>
}
const shell:React.CSSProperties={minHeight:'100vh',background:'#f8fafc',padding:'18px 14px 90px',color:'#0f172a',fontFamily:"'Plus Jakarta Sans', sans-serif"}
const hero:React.CSSProperties={background:'#fff',border:'1px solid #e2e8f0',borderRadius:18,padding:22,marginBottom:14}
const card:React.CSSProperties={background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:18,marginBottom:14}
const kicker:React.CSSProperties={color:'#4f46e5',fontSize:12,fontWeight:800,letterSpacing:.4}
const muted:React.CSSProperties={color:'#64748b',fontSize:13,lineHeight:1.6}
const tag:React.CSSProperties={background:'#fff7ed',borderRadius:30,padding:'4px 9px',fontSize:11,fontWeight:700}
const outcome:React.CSSProperties={background:'#f1f5f9',padding:12,borderRadius:10,fontSize:14,lineHeight:1.5}
const notice:React.CSSProperties={background:'#fffbeb',border:'1px solid #fcd34d',borderRadius:10,padding:12,marginTop:12,fontSize:13,lineHeight:1.5}
const steps:React.CSSProperties={display:'grid',gap:10,marginTop:14}
const step:React.CSSProperties={border:'1px solid #e2e8f0',borderRadius:12,padding:14}
const input:React.CSSProperties={border:'1px solid #cbd5e1',borderRadius:9,padding:11,width:'100%',boxSizing:'border-box',margin:'8px 0 12px',fontSize:16}
const primary:React.CSSProperties={background:'#4f46e5',color:'#fff',border:0,borderRadius:9,padding:'10px 15px',fontWeight:700,cursor:'pointer'}
const secondary:React.CSSProperties={background:'#eef2ff',color:'#4338ca',border:'1px solid #c7d2fe',borderRadius:9,padding:'8px 12px',fontWeight:700,cursor:'pointer'}
const link:React.CSSProperties={...secondary,marginBottom:12}

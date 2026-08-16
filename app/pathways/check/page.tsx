'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { QUICK_CHECK_PATHWAYS, QUICK_CHECK_QUESTIONS, QUICK_CHECK_RULE_VERSION, QUICK_CHECK_STORAGE_KEY, calculateQuickCheck, rankQuickCheck } from '@/lib/pathways/quickCheck'

type StoredCheck = { step:number; answers:Record<string,number>; complete:boolean; ruleVersion:string }

export default function PathwayQuickCheckPage() {
  const [step,setStep] = useState(0)
  const [answers,setAnswers] = useState<Record<string,number>>({})
  const [complete,setComplete] = useState(false)
  const [hydrated,setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(QUICK_CHECK_STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as Partial<StoredCheck>
        if (saved.ruleVersion === QUICK_CHECK_RULE_VERSION) {
          if (saved.answers && typeof saved.answers === 'object') setAnswers(saved.answers)
          if (typeof saved.step === 'number') setStep(Math.max(0,Math.min(QUICK_CHECK_QUESTIONS.length-1,saved.step)))
          if (saved.complete === true) setComplete(true)
        }
      }
    } catch {}
    setHydrated(true)
  },[])

  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(QUICK_CHECK_STORAGE_KEY,JSON.stringify({step,answers,complete,ruleVersion:QUICK_CHECK_RULE_VERSION})) } catch {}
  },[step,answers,complete,hydrated])

  const scores = useMemo(() => calculateQuickCheck(answers),[answers])
  const ranking = useMemo(() => rankQuickCheck(scores),[scores])
  const leader = ranking[0]
  const runnerUp = ranking[1]
  const close = scores[leader]-scores[runnerUp] <= 2

  function choose(index:number) {
    const question = QUICK_CHECK_QUESTIONS[step]
    setAnswers(current => ({...current,[question.id]:index}))
    if (step === QUICK_CHECK_QUESTIONS.length-1) setComplete(true)
    else setStep(current => current+1)
  }

  function reset() {
    setStep(0); setAnswers({}); setComplete(false)
    try { localStorage.removeItem(QUICK_CHECK_STORAGE_KEY) } catch {}
  }

  if (!hydrated) return <main style={S.root}><div style={S.shell}>Loading Pathways…</div></main>

  if (complete) {
    const primary = QUICK_CHECK_PATHWAYS[leader]
    const secondary = QUICK_CHECK_PATHWAYS[runnerUp]
    return <main style={S.root}><div style={S.shell}>
      <Link href="/pathways" style={S.back}>← Pathways</Link>
      <p style={S.kicker}>EARLY GUIDANCE · NOT AN OFFICIAL PLACEMENT</p>
      <h1 style={S.h1}>{close ? 'Two directions are worth exploring.' : `${primary.name} is your strongest signal so far.`}</h1>
      <p style={S.lead}>This result comes only from your answers to a short interest check. It can change when you add subject preferences, actual learning evidence, career goals or guidance from people who know you.</p>
      <section style={S.result}><span style={S.resultLabel}>{close?'STRONGEST SIGNALS':'STRONGEST DIRECTION'}</span><h2 style={S.resultTitle}>{primary.name}</h2><p style={S.resultBody}>{primary.summary}</p>{close&&<div style={S.runner}><strong>{secondary.name}</strong><span>{secondary.summary}</span></div>}</section>
      <section style={S.card}><h2 style={S.cardTitle}>Next useful action</h2><div style={S.actions}><Link href={`/pathways/schools?pathway=${encodeURIComponent(primary.canonicalSlug)}`} style={S.primary}>Find source-verified schools</Link><Link href={`/pathways#${primary.canonicalSlug}`} style={S.secondary}>Understand {primary.name}</Link><Link href="/pathways/continue" style={S.secondary}>Save this direction later</Link><button type="button" onClick={reset} style={S.textButton}>Retake check</button></div><p style={S.small}>Your answers stay in this browser unless you explicitly choose to save them after signing in to an eligible learner account.</p></section>
    </div></main>
  }

  const question = QUICK_CHECK_QUESTIONS[step]
  const selected = answers[question.id]
  const pct = Math.round(((step+1)/QUICK_CHECK_QUESTIONS.length)*100)
  return <main style={S.root}><div style={S.shell}>
    <Link href="/pathways" style={S.back}>← Pathways</Link><p style={S.kicker}>QUICK PATHWAY CHECK</p>
    <div style={S.track}><div style={{...S.fill,width:`${pct}%`}}/></div><p style={S.step}>Question {step+1} of {QUICK_CHECK_QUESTIONS.length}</p>
    <h1 style={S.question}>{question.prompt}</h1>
    <div style={S.choiceGrid}>{question.choices.map((choice,index)=><button key={choice.label} type="button" aria-pressed={selected===index} onClick={()=>choose(index)} style={{...S.choice,...(selected===index?S.choiceSelected:{})}}>{choice.label}</button>)}</div>
    <div style={S.footer}><button type="button" disabled={step===0} onClick={()=>setStep(current=>Math.max(0,current-1))} style={{...S.textButton,opacity:step===0?.35:1}}>Back</button><span style={S.small}>No login required · no answer is sent to VibeSchool yet</span></div>
  </div></main>
}

const S: Record<string,CSSProperties> = {
  root:{minHeight:'100dvh',background:'#f7f7fb',color:'#111827',padding:'24px 16px 56px'},shell:{width:'100%',maxWidth:680,margin:'0 auto'},back:{display:'inline-block',color:'#4f46e5',textDecoration:'none',fontSize:13,fontWeight:800,marginBottom:28},kicker:{color:'#4f46e5',fontSize:10,fontWeight:900,letterSpacing:'.16em',marginBottom:10},h1:{fontSize:'clamp(30px,6vw,46px)',lineHeight:1.08,letterSpacing:'-.035em',margin:'0 0 12px'},lead:{fontSize:14,lineHeight:1.65,color:'#5b6475'},track:{height:7,background:'#e6e7ee',borderRadius:999,overflow:'hidden'},fill:{height:'100%',background:'#4f46e5',borderRadius:999,transition:'width 180ms ease'},step:{fontSize:11,color:'#7c8494',margin:'8px 0 24px'},question:{fontSize:27,lineHeight:1.16,letterSpacing:'-.025em',margin:'0 0 22px'},choiceGrid:{display:'grid',gap:10},choice:{width:'100%',textAlign:'left',border:'1px solid #e2e4ea',borderRadius:16,padding:'17px 16px',background:'#fff',color:'#111827',fontSize:15,fontWeight:750,cursor:'pointer'},choiceSelected:{borderColor:'#4f46e5',background:'#eef2ff'},footer:{marginTop:22,display:'flex',justifyContent:'space-between',alignItems:'center',gap:16},small:{display:'block',color:'#7c8494',fontSize:10,lineHeight:1.5,marginTop:12},result:{padding:21,borderRadius:20,background:'#171642',color:'#fff',margin:'20px 0 12px'},resultLabel:{fontSize:9,fontWeight:900,letterSpacing:'.16em',opacity:.65},resultTitle:{fontSize:30,margin:'5px 0 6px'},resultBody:{margin:0,color:'#d8d8e6',fontSize:13,lineHeight:1.6},runner:{display:'grid',gap:3,borderTop:'1px solid rgba(255,255,255,.16)',marginTop:16,paddingTop:14,fontSize:12},card:{background:'#fff',border:'1px solid #e5e7eb',borderRadius:18,padding:18},cardTitle:{margin:'0 0 10px',fontSize:16},actions:{display:'grid',gap:9},primary:{display:'block',textAlign:'center',padding:'13px 14px',borderRadius:13,background:'#4f46e5',color:'#fff',fontSize:13,fontWeight:850,textDecoration:'none'},secondary:{display:'block',textAlign:'center',padding:'12px 14px',borderRadius:13,border:'1px solid #d8dae2',color:'#3730a3',fontSize:13,fontWeight:850,textDecoration:'none'},textButton:{border:0,background:'transparent',padding:4,color:'#4f46e5',fontSize:12,fontWeight:850,cursor:'pointer'}
}

'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { QUICK_CHECK_PATHWAYS, QUICK_CHECK_QUESTIONS, QUICK_CHECK_STORAGE_KEY, calculateQuickCheck, rankQuickCheck } from '@/lib/pathways/quickCheck'

export default function PathwayQuickCheckPage() {
  const [step,setStep]=useState(0)
  const [answers,setAnswers]=useState<Record<string,number>>({})
  const [complete,setComplete]=useState(false)
  const [hydrated,setHydrated]=useState(false)

  useEffect(()=>{try{const stored=window.localStorage.getItem(QUICK_CHECK_STORAGE_KEY);if(stored){const parsed=JSON.parse(stored) as {step?:number;answers?:Record<string,number>;complete?:boolean};if(parsed.answers&&typeof parsed.answers==='object')setAnswers(parsed.answers);if(typeof parsed.step==='number')setStep(Math.max(0,Math.min(QUICK_CHECK_QUESTIONS.length-1,parsed.step)));if(parsed.complete===true)setComplete(true)}}catch{}finally{setHydrated(true)}},[])
  useEffect(()=>{if(!hydrated)return;try{window.localStorage.setItem(QUICK_CHECK_STORAGE_KEY,JSON.stringify({step,answers,complete}))}catch{}},[answers,complete,hydrated,step])

  const scores=useMemo(()=>calculateQuickCheck(answers),[answers])
  const ranking=useMemo(()=>rankQuickCheck(scores),[scores])
  const leader=ranking[0]
  const runnerUp=ranking[1]
  const close=scores[leader]-scores[runnerUp]<=2

  function select(index:number){const q=QUICK_CHECK_QUESTIONS[step];setAnswers(v=>({...v,[q.id]:index}));if(step===QUICK_CHECK_QUESTIONS.length-1)setComplete(true);else setStep(v=>v+1)}
  function reset(){setAnswers({});setStep(0);setComplete(false);try{window.localStorage.removeItem(QUICK_CHECK_STORAGE_KEY)}catch{}}

  if(!hydrated)return <main style={S.root}><div style={S.shell}><p style={S.muted}>Loading your free pathway check…</p></div></main>

  if(complete){const primary=QUICK_CHECK_PATHWAYS[leader];const secondary=QUICK_CHECK_PATHWAYS[runnerUp];return <main style={S.root}><div style={S.shell}>
    <Link href="/pathways" style={S.back}>← Pathways</Link>
    <div style={S.kicker}>EARLY GUIDANCE · FREE</div>
    <h1 style={S.h1}>{close?'Two directions are worth exploring':`${primary.name} is your strongest signal so far`}</h1>
    <p style={S.lead}>This is an early indication from a short interest check, not an official placement decision or a judgment about what you can become.</p>
    <section style={S.resultCard}><div style={S.resultLabel}>{close?'STRONGEST SIGNALS':'STRONGEST DIRECTION'}</div><h2 style={S.resultTitle}>{primary.name}</h2><p style={{...S.body,color:'#d8d8e6'}}>{primary.summary}</p>{close&&<div style={S.secondary}><strong>{secondary.name}</strong><span>{secondary.summary}</span></div>}</section>
    <section style={S.card}><h2 style={S.cardTitle}>Why this result?</h2><p style={S.body}>Your answers produced more interest signals for {primary.name}{close?`, with ${secondary.name} close behind`:''}. Subject preferences, actual learning evidence and career goals can strengthen or change this guidance later.</p></section>
    <section style={S.card}><h2 style={S.cardTitle}>What should I do next?</h2><div style={S.actions}><Link href="/learn/careers" style={S.primaryAction}>Explore careers</Link><Link href={primary.href} style={S.secondaryAction}>Understand {primary.name}</Link><button type="button" onClick={reset} style={S.textButton}>Retake the quick check</button></div><p style={{...S.small,marginTop:12}}>Your answers stay on this device. Account saving is intentionally disabled until the continuation and learner-identity contract is certified against current authentication.</p></section>
    <section style={S.trustCard}><strong>Trust note</strong><p style={S.small}>VibeSchool separates this guidance from official placement and verified school-offering facts. Detailed combinations and school claims must be backed by authoritative evidence before they are presented as verified.</p></section>
  </div></main>}

  const question=QUICK_CHECK_QUESTIONS[step]
  const selected=answers[question.id]
  const pct=Math.round(((step+1)/QUICK_CHECK_QUESTIONS.length)*100)
  return <main style={S.root}><div style={S.shell}>
    <Link href="/pathways" style={S.back}>← Pathways</Link><div style={S.kicker}>QUICK PATHWAY CHECK</div><div style={S.progressTrack}><div style={{...S.progressFill,width:`${pct}%`}}/></div><div style={S.stepText}>Question {step+1} of {QUICK_CHECK_QUESTIONS.length}</div><h1 style={S.question}>{question.prompt}</h1>
    <div style={S.choiceGrid}>{question.choices.map((choice,index)=><button key={choice.label} type="button" onClick={()=>select(index)} style={{...S.choice,...(selected===index?S.choiceSelected:{})}}><span style={S.choiceTitle}>{choice.label}</span>{choice.hint&&<span style={S.small}>{choice.hint}</span>}</button>)}</div>
    <div style={S.footerRow}><button type="button" disabled={step===0} onClick={()=>setStep(v=>Math.max(0,v-1))} style={{...S.textButton,opacity:step===0?.35:1}}>Back</button><span style={S.small}>No login required · answers stay on this device</span></div>
  </div></main>
}

const S:Record<string,CSSProperties>={root:{minHeight:'100dvh',background:'#f7f7fb',color:'#111827',padding:'24px 16px 56px'},shell:{width:'100%',maxWidth:680,margin:'0 auto'},back:{display:'inline-block',color:'#4f46e5',textDecoration:'none',fontSize:13,fontWeight:800,marginBottom:28},kicker:{color:'#4f46e5',fontSize:10,fontWeight:900,letterSpacing:'.18em',marginBottom:10},h1:{fontSize:30,lineHeight:1.08,margin:'0 0 12px',letterSpacing:'-.03em'},lead:{fontSize:15,lineHeight:1.6,color:'#5b6475',margin:'0 0 20px'},progressTrack:{height:7,background:'#e6e7ee',borderRadius:999,overflow:'hidden',marginBottom:8},progressFill:{height:'100%',background:'#4f46e5',borderRadius:999,transition:'width 180ms ease'},stepText:{fontSize:11,color:'#7c8494',marginBottom:24},question:{fontSize:27,lineHeight:1.16,margin:'0 0 22px',letterSpacing:'-.025em'},choiceGrid:{display:'grid',gap:10},choice:{width:'100%',textAlign:'left',border:'1px solid #e2e4ea',borderRadius:16,padding:'17px 16px',background:'#fff',color:'#111827',cursor:'pointer'},choiceSelected:{borderColor:'#4f46e5',background:'#eef2ff'},choiceTitle:{display:'block',fontSize:15,lineHeight:1.4,fontWeight:780},footerRow:{marginTop:22,display:'flex',justifyContent:'space-between',alignItems:'center',gap:16},textButton:{border:'none',background:'none',padding:0,color:'#4f46e5',fontSize:12,fontWeight:850,cursor:'pointer'},resultCard:{padding:20,borderRadius:20,background:'#171642',color:'#fff',marginBottom:12},resultLabel:{fontSize:9,letterSpacing:'.16em',opacity:.65,fontWeight:900},resultTitle:{fontSize:28,margin:'5px 0 6px',letterSpacing:'-.025em'},secondary:{display:'grid',gap:3,borderTop:'1px solid rgba(255,255,255,.16)',marginTop:16,paddingTop:14,fontSize:12,lineHeight:1.5},card:{background:'#fff',border:'1px solid #e5e7eb',borderRadius:18,padding:18,marginBottom:12},trustCard:{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:18,padding:16,fontSize:12,lineHeight:1.55},cardTitle:{margin:'0 0 8px',fontSize:16},body:{margin:0,color:'#5b6475',fontSize:13,lineHeight:1.6},small:{color:'#7c8494',fontSize:10,lineHeight:1.45},muted:{color:'#7c8494',fontSize:13},actions:{display:'grid',gap:9,marginTop:12},primaryAction:{display:'block',textAlign:'center',padding:'13px 14px',borderRadius:13,background:'#4f46e5',color:'#fff',fontSize:13,fontWeight:850,textDecoration:'none'},secondaryAction:{display:'block',textAlign:'center',padding:'12px 14px',borderRadius:13,border:'1px solid #d8dae2',color:'#3730a3',fontSize:13,fontWeight:850,textDecoration:'none'}}

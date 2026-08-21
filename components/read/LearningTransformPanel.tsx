"use client"

import React,{useEffect,useMemo,useState}from"react"
import{getLearningTransformation,getRecommendedLearningRepresentation,recordLearningTransformationEvent,type LearningRepresentation,type LearningTransformation,type LearningTransformNode}from"@/lib/student/learningTransform"
import{getLearningTransformAccess,type LearningTransformAccess}from"@/lib/student/learningTransformAccess"

const ACTIONS:Array<{representation:LearningRepresentation;label:string;hint:string}>=[
  {representation:"simplify",label:"Explain",hint:"Clearer language"},
  {representation:"quiz",label:"Quiz",hint:"Check understanding"},
  {representation:"flashcards",label:"Flashcards",hint:"Recall key ideas"},
  {representation:"revision_sheet",label:"Revision",hint:"Must-know summary"},
  {representation:"worked_examples",label:"Examples",hint:"See it worked out"},
  {representation:"visual_explainer",label:"Visualise",hint:"Follow the relationships"},
]

const actionStyle:React.CSSProperties={minHeight:68,border:"1px solid rgba(255,255,255,.1)",borderRadius:14,padding:"10px 12px",background:"rgba(255,255,255,.035)",color:"white",cursor:"pointer",textAlign:"left"}
const cardStyle:React.CSSProperties={border:"1px solid rgba(255,255,255,.09)",borderRadius:14,padding:14,background:"rgba(255,255,255,.025)"}

function friendlyError(reason:unknown):string{
  const raw=reason instanceof Error?reason.message.toLowerCase():''
  if(raw.includes('learner')||raw.includes('403')||raw.includes('not authenticated')||raw.includes('jwt'))return 'Personal learning tools need a learner profile. You can keep reading or practise this unit.'
  if(raw.includes('network')||raw.includes('fetch')||raw.includes('timeout'))return 'This learning view could not connect right now. Check your connection and try again.'
  return 'This learning view is temporarily unavailable. Your chapter is safe — keep reading or try again.'
}

function accessMessage(access:LearningTransformAccess):string|null{
  if(access==='signed_out')return 'Sign in with a learner account to use personalised explanations, quizzes, flashcards and revision tools.'
  if(access==='account_without_learner')return 'This account does not have a learner profile. Open this unit with a learner account to use personalised learning tools.'
  if(access==='unavailable')return 'Personal learning tools cannot be checked right now. Keep reading or try again shortly.'
  return null
}

function NodeTree({nodes}:{nodes:LearningTransformNode[]}){return <ul style={{margin:"8px 0",paddingLeft:20}}>{nodes.map((node,index)=><li key={`${node.label}-${index}`} style={{marginBottom:7}}><strong>{node.label}</strong>{node.children?.length?<NodeTree nodes={node.children}/>:null}</li>)}</ul>}

function QuizView({result}:{result:LearningTransformation}){
  const questions=result.payload.questions??[]
  const[answers,setAnswers]=useState<Record<number,number>>({})
  return <div style={{display:"grid",gap:14}}>{questions.map((question,index)=>{const selected=answers[index];const answered=Number.isInteger(selected);const correct=selected===question.correctIndex;return <section key={`${question.prompt}-${index}`} style={cardStyle}><strong>{index+1}. {question.prompt}</strong><div style={{display:"grid",gap:7,marginTop:10}}>{question.options.map((option,optionIndex)=><button key={`${option}-${optionIndex}`} type="button" onClick={()=>setAnswers(value=>({...value,[index]:optionIndex}))} style={{minHeight:44,border:"1px solid rgba(255,255,255,.1)",borderRadius:11,padding:"9px 11px",background:selected===optionIndex?"rgba(207,255,0,.1)":"transparent",color:"white",textAlign:"left",cursor:"pointer"}}>{String.fromCharCode(65+optionIndex)}. {option}</button>)}</div>{answered?<div role="status" style={{marginTop:10,fontSize:13,lineHeight:1.55,color:correct?"#cfff00":"#ffb0b0"}}><strong>{correct?'Correct.':'Not quite.'}</strong>{!correct?` The best answer is ${String.fromCharCode(65+question.correctIndex)}.`:''}{question.explanation?<div style={{color:"rgba(255,255,255,.78)",marginTop:4}}>{question.explanation}</div>:null}</div>:null}</section>})}</div>
}

function FlashcardView({result}:{result:LearningTransformation}){
  const cards=result.payload.cards??[]
  const[index,setIndex]=useState(0);const[revealed,setRevealed]=useState(false)
  const card=cards[index]
  if(!card)return null
  return <div style={cardStyle}><div style={{fontSize:11,color:"rgba(255,255,255,.55)",marginBottom:8}}>CARD {index+1} OF {cards.length}</div><div style={{fontSize:18,fontWeight:850,lineHeight:1.4}}>{card.front}</div>{revealed?<div style={{marginTop:14,paddingTop:14,borderTop:"1px solid rgba(255,255,255,.08)",lineHeight:1.65}}>{card.back}</div>:null}<div style={{display:"flex",gap:8,marginTop:16}}><button type="button" onClick={()=>setRevealed(value=>!value)} style={actionStyle}>{revealed?'Hide answer':'Show answer'}</button><button type="button" disabled={index<=0} onClick={()=>{setIndex(value=>Math.max(0,value-1));setRevealed(false)}} style={{...actionStyle,opacity:index<=0?.45:1}}>←</button><button type="button" disabled={index>=cards.length-1} onClick={()=>{setIndex(value=>Math.min(cards.length-1,value+1));setRevealed(false)}} style={{...actionStyle,opacity:index>=cards.length-1?.45:1}}>→</button></div></div>
}

function ResultBody({result}:{result:LearningTransformation}){
  const p=result.payload
  if(p.questions?.length)return <QuizView result={result}/>
  if(p.cards?.length)return <FlashcardView result={result}/>
  if(p.workedExamples?.length)return <div style={{display:"grid",gap:12}}>{p.workedExamples.map((example,index)=><section key={`${example.problem}-${index}`} style={cardStyle}><strong>{example.problem}</strong><ol style={{paddingLeft:22,lineHeight:1.65}}>{example.steps.map((step,i)=><li key={`${step}-${i}`}>{step}</li>)}</ol><div style={{paddingTop:8,borderTop:"1px solid rgba(255,255,255,.08)"}}><strong>Answer:</strong> {example.answer}</div></section>)}</div>
  if(p.visualSteps?.length)return <ol style={{display:"grid",gap:10,padding:0,listStyle:"none"}}>{p.visualSteps.map((step,index)=><li key={`${step.label}-${index}`} style={cardStyle}><div style={{fontSize:11,color:"#cfff00",fontWeight:850}}>STEP {index+1}</div><strong style={{display:"block",marginTop:4}}>{step.label}</strong><div style={{marginTop:5,lineHeight:1.6,color:"rgba(255,255,255,.78)"}}>{step.description}</div></li>)}</ol>
  if(p.nodes?.length)return <div style={cardStyle}><NodeTree nodes={p.nodes}/></div>
  if(p.script?.length)return <div style={{display:"grid",gap:8}}>{p.script.map((line,index)=><div key={`${line.speaker}-${index}`} style={cardStyle}><strong style={{color:"#cfff00"}}>{line.speaker}</strong><div style={{marginTop:4,lineHeight:1.6}}>{line.text}</div></div>)}</div>
  if(p.story?.narrative)return <div style={cardStyle}>{p.story.setting?<div style={{fontSize:12,color:"#cfff00",fontWeight:800}}>{p.story.setting}</div>:null}<p style={{lineHeight:1.7}}>{p.story.narrative}</p>{p.story.learningLink?<p style={{lineHeight:1.7,color:"rgba(255,255,255,.78)"}}><strong>Learning link:</strong> {p.story.learningLink}</p>:null}</div>
  return <div style={{display:"grid",gap:14}}>{p.intro?<p style={{margin:0,lineHeight:1.7}}>{p.intro}</p>:null}{(p.sections??[]).map((section,index)=><section key={`${section.heading??"section"}-${index}`} style={cardStyle}>{section.heading?<h4 style={{margin:"0 0 7px"}}>{section.heading}</h4>:null}{section.body?<p style={{margin:0,lineHeight:1.7}}>{section.body}</p>:null}{section.bullets?.length?<ul style={{lineHeight:1.65}}>{section.bullets.map((item,i)=><li key={`${item}-${i}`}>{item}</li>)}</ul>:null}{section.check?.question?<details style={{marginTop:10}}><summary style={{cursor:"pointer",fontWeight:800}}>Quick check: {section.check.question}</summary>{section.check.answer?<div style={{marginTop:7,color:"rgba(255,255,255,.78)"}}>{section.check.answer}</div>:null}</details>:null}</section>)}{p.takeaways?.length?<section style={cardStyle}><strong>Remember</strong><ul style={{lineHeight:1.65}}>{p.takeaways.map((item,i)=><li key={`${item}-${i}`}>{item}</li>)}</ul></section>:null}</div>
}

export function LearningTransformPanel({chapterId,chapterTitle}:{chapterId:string;chapterTitle:string}){
  const[loading,setLoading]=useState<LearningRepresentation|null>(null)
  const[result,setResult]=useState<LearningTransformation|null>(null)
  const[error,setError]=useState<string|null>(null)
  const[recommended,setRecommended]=useState<LearningRepresentation|null>(null)
  const[access,setAccess]=useState<LearningTransformAccess|'checking'>('checking')
  const title=useMemo(()=>result?.payload.title?.trim()||chapterTitle,[chapterTitle,result?.payload.title])

  useEffect(()=>{let cancelled=false;setResult(null);setError(null);setRecommended(null);setAccess('checking');void getLearningTransformAccess().then(value=>{if(cancelled)return;setAccess(value);if(value==='learner')void getRecommendedLearningRepresentation('chapter',chapterId).then(recommendation=>{if(!cancelled&&ACTIONS.some(action=>action.representation===recommendation.representation))setRecommended(recommendation.representation)}).catch(()=>undefined)});return()=>{cancelled=true}},[chapterId])

  async function run(representation:LearningRepresentation){if(loading||access!=='learner')return;setLoading(representation);setError(null);try{const next=await getLearningTransformation('chapter',chapterId,representation);setResult(next);void recordLearningTransformationEvent(next.id,'viewed').catch(()=>undefined)}catch(reason){setError(friendlyError(reason))}finally{setLoading(null)}}
  function feedback(event:'completed'|'helpful'|'not_helpful'){if(result)void recordLearningTransformationEvent(result.id,event).catch(()=>undefined)}

  if(result)return <section aria-label="Learning view"><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}><button type="button" onClick={()=>setResult(null)} style={{...actionStyle,minHeight:42,padding:"7px 10px"}}>← Formats</button><div style={{minWidth:0}}><div style={{fontSize:11,color:"#cfff00",fontWeight:850,textTransform:"uppercase"}}>{result.cached?'Ready from your recent learning':'Prepared from this unit'}</div><strong style={{display:"block",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{title}</strong></div></div>{result.payload.degraded?<div role="status" style={{...cardStyle,marginBottom:12,fontSize:13}}>This is a source-grounded fallback view while richer generation is unavailable.</div>:null}<ResultBody result={result}/><div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:16}}><button type="button" onClick={()=>feedback('completed')} style={actionStyle}>Done</button><button type="button" onClick={()=>feedback('helpful')} style={actionStyle}>Helpful</button><button type="button" onClick={()=>feedback('not_helpful')} style={actionStyle}>Needs improvement</button></div></section>

  const message=access==='checking'?null:accessMessage(access)
  return <section aria-label="Learn with this unit"><p style={{margin:"0 0 14px",color:"rgba(255,255,255,.7)",lineHeight:1.55}}>Choose another way to understand this unit. Every view stays grounded in the chapter you are reading.</p>{access==='checking'?<div role="status" style={{...cardStyle,fontSize:13}}>Checking your learning tools…</div>:message?<div role="status" style={{...cardStyle,borderColor:"rgba(207,255,0,.18)",fontSize:13,lineHeight:1.55}}>{message}</div>:<>{recommended?<div style={{...cardStyle,marginBottom:12,padding:10,fontSize:12}}>Recommended for you: <strong>{ACTIONS.find(action=>action.representation===recommended)?.label}</strong></div>:null}<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(132px,1fr))",gap:9}}>{ACTIONS.map(action=><button type="button" key={action.representation} onClick={()=>void run(action.representation)} disabled={Boolean(loading)} style={{...actionStyle,borderColor:recommended===action.representation?'rgba(207,255,0,.45)':'rgba(255,255,255,.1)',opacity:loading&&loading!==action.representation?0.58:1}}><strong style={{display:"block"}}>{loading===action.representation?'Preparing…':action.label}</strong><span style={{display:"block",fontSize:11,color:"rgba(255,255,255,.55)",marginTop:3}}>{action.hint}</span></button>)}</div>{error?<div role="alert" style={{...cardStyle,marginTop:12,borderColor:"rgba(255,120,120,.28)",background:"rgba(255,80,80,.06)",fontSize:13,lineHeight:1.55}}>{error}<div><button type="button" onClick={()=>setError(null)} style={{...actionStyle,minHeight:40,marginTop:10,padding:"6px 10px"}}>Dismiss</button></div></div>:null}</>}</section>
}

'use client'

import type { AdaptivePracticeQuestion, AdaptiveTeachingTurn, LearnerTwinState } from '@/lib/student/twin'
import type { TwinCoreRouteResult } from '@/lib/student/twinCore'
import type { TwinMessage, TwinState } from '../types'
import { T } from './TwinHeader'

type Stage = 'understand' | 'try' | 'reflect' | 'revisit'

interface TwinLearningCanvasProps {
  userName: string
  learnerState: LearnerTwinState | null
  practiceQuestion: AdaptivePracticeQuestion | null
  coachTurn: AdaptiveTeachingTurn | null
  practiceFeedback: string | null
  practiceLoading: boolean
  hintIndex: number
  sessionSummary: string | null
  coreResult: TwinCoreRouteResult | null
  messages: TwinMessage[]
  twinState: TwinState
  onStartPractice: () => void
  onContinueTask: (url: string) => void
  onAnswer: (index: number) => void
  onCoach: () => void
  onHint: () => void
  onExplainAnotherWay: () => void
  onEasier: () => void
  onHarder: () => void
  onEndPractice: () => void
  onResumeCompanion: () => void
}

function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function text(value: unknown): string { return typeof value === 'string' ? value : '' }
function number(value: unknown): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0 }
function list(value: unknown): Record<string, unknown>[] { return Array.isArray(value) ? value.map(record) : [] }

function stageFor(question: AdaptivePracticeQuestion | null, feedback: string | null, coach: AdaptiveTeachingTurn | null, summary: string | null): Stage {
  if (summary) return 'revisit'
  if (!question) return 'understand'
  if (feedback) return 'reflect'
  if (coach) return 'try'
  return 'try'
}

function CorePanel({ result, onContinueTask, onResumeCompanion }: { result: TwinCoreRouteResult; onContinueTask: (url:string)=>void; onResumeCompanion:()=>void }) {
  const payload = result.payload
  if (result.intent === 'tasks') {
    const taskRoot = record(payload.tasks)
    const tasks = list(taskRoot.tasks).slice(0, 6)
    return <section style={sectionCard}><div style={eyebrow}>Twin Core · assigned work</div><div style={body}>{result.reply}</div>{tasks.map((task,index)=><div key={text(task.task_id)||index} style={resultRow}><div><strong style={{color:T.text}}>{text(task.title)||'Task'}</strong><div style={muted}>{text(task.subject)} · {text(task.status).replaceAll('_',' ')}</div></div>{text(task.action_url)&&<button style={smallButton} onClick={()=>onContinueTask(text(task.action_url))}>{text(task.action_label)||'Open'}</button>}</div>)}</section>
  }
  if (result.intent === 'priority') {
    const now = record(payload.now)
    return <section style={sectionCard}><div style={eyebrow}>Twin Core · next move</div><strong style={{fontSize:16,color:T.text}}>{text(now.title)||result.reply}</strong><div style={body}>{text(now.reason)}</div>{text(now.action_url)&&<button style={primaryButton} onClick={()=>onContinueTask(text(now.action_url))}>{text(now.action_label)||'Continue'}</button>}</section>
  }
  if (result.intent === 'revision') {
    const revision = list(payload.today_revision)
    return <section style={sectionCard}><div style={eyebrow}>Twin Core · safe revision</div><div style={body}>{result.reply}</div>{revision.length ? revision.slice(0,5).map((item,index)=><div key={text(item.id)||index} style={resultRow}><div><strong style={{color:T.text}}>{text(item.topic)||'Revision'}</strong><div style={muted}>{text(item.subject)} · {number(item.target_minutes)} min</div></div>{text(item.action_url)&&<button style={smallButton} onClick={()=>onContinueTask(text(item.action_url))}>Open</button>}</div>) : <div style={muted}>Nothing due right now.</div>}</section>
  }
  if (result.intent === 'memory') {
    const memories = list(payload.memories).slice(0,6)
    return <section style={sectionCard}><div style={eyebrow}>Twin Core · safe memory</div><div style={body}>{result.reply}</div>{memories.map((item,index)=><div key={text(item.id)||index} style={{display:'grid',gap:3,padding:'7px 0',borderBottom:`1px solid ${T.border}`}}><strong style={{color:T.text,fontSize:11.5}}>{text(item.claim)}</strong><span style={muted}>{text(item.type).replaceAll('_',' ')}</span></div>)}<button style={secondaryButton} onClick={onResumeCompanion}>Open companion</button></section>
  }
  if (result.intent === 'resume') {
    const session = record(payload.resume_session)
    const now = record(payload.what_matters_now)
    return <section style={sectionCard}><div style={eyebrow}>Twin Core · resume</div><div style={body}>{result.reply}</div>{Object.keys(session).length>0&&<div style={resultRow}><div><strong style={{color:T.text}}>{number(session.planned_minutes)||25}-minute {text(session.mode)||'learning'} session</strong><div style={muted}>{text(session.reason)}</div></div><button style={smallButton} onClick={onResumeCompanion}>Resume</button></div>}{text(now.action_url)&&<button style={secondaryButton} onClick={()=>onContinueTask(text(now.action_url))}>Do {text(now.title)||'current task'}</button>}</section>
  }
  if (result.intent === 'private_space' || result.intent === 'search') {
    const privateRoot = result.intent === 'search' ? record(payload.private) : payload
    const items = list(privateRoot.items).slice(0,8)
    return <section style={sectionCard}><div style={eyebrow}>Twin Core · private space</div><div style={body}>{result.reply}</div>{items.length ? items.map((item,index)=><div key={text(item.id)||index} style={{display:'grid',gap:3,padding:'8px 0',borderBottom:`1px solid ${T.border}`}}><strong style={{color:T.text,fontSize:11.5}}>{text(item.title)||text(item.body).slice(0,80)||'Saved item'}</strong><span style={muted}>{text(item.item_type).replaceAll('_',' ')} · {text(item.visibility)||'private'}</span></div>) : <div style={muted}>Nothing saved here yet.</div>}</section>
  }
  if (result.intent === 'weakness') {
    const outcomes = list(payload.outcomes).slice(0,5)
    return <section style={sectionCard}><div style={eyebrow}>Twin Core · learning state</div><div style={body}>{result.reply}</div>{outcomes.map((item,index)=><div key={text(item.outcome_id)||index} style={resultRow}><div><strong style={{color:T.text}}>{text(item.outcome_text)||'Learning outcome'}</strong><div style={muted}>Mastery {Math.round(number(item.effective_mastery))}% · forgetting risk {Math.round(number(item.forgetting_risk)*100)}%</div></div></div>)}</section>
  }
  if (result.intent === 'save_prompt') return <section style={sectionCard}><div style={eyebrow}>Twin Core · save</div><div style={body}>{result.reply}</div><div style={muted}>Use “save privately …”, “save for Twin …”, or “ask teacher later …” to choose where it belongs.</div></section>
  return <section style={sectionCard}><div style={eyebrow}>Twin Core</div><div style={body}>{result.reply}</div></section>
}

export default function TwinLearningCanvas({ userName, learnerState, practiceQuestion, coachTurn, practiceFeedback, practiceLoading, hintIndex, sessionSummary, coreResult, messages, twinState, onStartPractice, onContinueTask, onAnswer, onCoach, onHint, onExplainAnotherWay, onEasier, onHarder, onEndPractice, onResumeCompanion }: TwinLearningCanvasProps) {
  const now = learnerState?.decision.now
  const weakest = learnerState?.mastery.outcomes[0] ?? null
  const stage = stageFor(practiceQuestion, practiceFeedback, coachTurn, sessionSummary)
  const stages: Array<{ id: Stage; label: string }> = [{id:'understand',label:'Understand'},{id:'try',label:'Try'},{id:'reflect',label:'Reflect'},{id:'revisit',label:'Revisit'}]

  return <div style={{ flex:1,minHeight:0,overflowY:'auto',padding:'12px 14px 18px',display:'grid',gap:12,alignContent:'start',WebkitOverflowScrolling:'touch' }}>
    <section style={sectionCard}><div style={eyebrow}>What matters now</div><div style={{fontSize:18,lineHeight:1.25,fontWeight:900,color:T.text}}>{now?.title||weakest?.outcomeText||'Build your next verified learning signal'}</div><div style={body}>{now?.reason||(weakest?`Twin can strengthen ${weakest.outcomeText} next.`:'Twin is waiting for enough verified evidence to choose a stronger next step.')}</div><div style={{display:'flex',gap:7,flexWrap:'wrap'}}>{now?.actionUrl&&<button onClick={()=>onContinueTask(now.actionUrl!)} style={primaryButton}>{now.actionLabel||'Continue current task'}</button>}<button onClick={onStartPractice} disabled={practiceLoading} style={now?.actionUrl?secondaryButton:primaryButton}>{practiceLoading?'Preparing…':practiceQuestion?'New question':'Practice weakest skill'}</button><button onClick={onResumeCompanion} style={secondaryButton}>What Twin remembers</button></div></section>

    {coreResult && <CorePanel result={coreResult} onContinueTask={onContinueTask} onResumeCompanion={onResumeCompanion} />}

    <section style={sectionCard}><div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>{stages.map(item=>{const active=item.id===stage;return <div key={item.id} style={{textAlign:'center',padding:'7px 4px',borderRadius:10,border:`1px solid ${active?T.accentBdr:T.border}`,background:active?T.accentBg:'transparent'}}><div style={{fontSize:9,fontWeight:900,color:active?T.text:T.muted}}>{item.label}</div></div>})}</div>
      {sessionSummary ? <div style={{display:'grid',gap:8,padding:'4px 2px'}}><div style={{fontSize:15,fontWeight:900,color:T.text}}>Session wrapped up</div><div style={body}>{sessionSummary}</div><div style={muted}>Twin keeps only the evidence already recorded. Ending the workspace does not manufacture mastery.</div><div style={{display:'flex',gap:7,flexWrap:'wrap'}}><button onClick={onStartPractice} style={secondaryButton}>Keep learning</button><button onClick={onResumeCompanion} style={secondaryButton}>Continue later</button>{now?.actionUrl&&<button onClick={()=>onContinueTask(now.actionUrl!)} style={primaryButton}>Do current task</button>}</div></div> : !practiceQuestion ? <div style={{padding:'8px 2px 2px',display:'grid',gap:8}}><div style={{fontSize:15,fontWeight:900,color:T.text}}>Ready when you are, {userName}.</div><div style={body}>You do not need to know what prompt to type. Ask, find, learn, plan, resume or save something in your private Twin space.</div></div> : <><div><div style={eyebrow}>Adaptive practice · {practiceQuestion.difficulty}</div><div style={{marginTop:4,fontSize:11,color:T.muted}}>{practiceQuestion.outcomeCode??'Curriculum outcome'} · {practiceQuestion.outcomeText}</div></div><div style={{fontSize:16,lineHeight:1.5,color:T.text,fontWeight:850}}>{practiceQuestion.prompt}</div>{coachTurn&&<div style={{padding:11,borderRadius:12,background:T.accentBg,border:`1px solid ${T.accentBdr}`}}><div style={eyebrow}>{coachTurn.mode.replaceAll('_',' ')}</div><div style={{marginTop:4,fontSize:12,lineHeight:1.55,color:T.text}}>{coachTurn.prompt}</div></div>}<div style={{display:'grid',gap:7}}>{practiceQuestion.options.map((option,index)=><button key={`${practiceQuestion.id}-${index}`} onClick={()=>onAnswer(index)} disabled={practiceLoading} style={optionButton}><strong>{String.fromCharCode(65+index)}.</strong> {option}</button>)}</div><div style={{display:'flex',gap:7,flexWrap:'wrap'}}><button onClick={onCoach} disabled={practiceLoading} style={secondaryButton}>Coach me</button>{practiceQuestion.hints.length>hintIndex&&<button onClick={onHint} style={secondaryButton}>Hint</button>}<button onClick={onExplainAnotherWay} style={secondaryButton}>Show another way</button><button onClick={onEasier} style={secondaryButton}>Easier</button><button onClick={onHarder} style={secondaryButton}>Harder</button><button onClick={onEndPractice} style={quietButton}>Finish</button></div>{hintIndex>0&&<div style={body}>{practiceQuestion.hints.slice(0,hintIndex).join(' ')}</div>}{practiceFeedback&&<div role="status" style={{padding:10,borderRadius:12,background:T.bg,border:`1px solid ${T.border}`,fontSize:11.5,lineHeight:1.55,color:T.text}}>{practiceFeedback}</div>}</>}
    </section>

    <section style={sectionCard}><div style={eyebrow}>Conversation</div>{messages.length===0?<div style={body}>Ask a question whenever you need to. Conversation supports the learning session; it does not replace it.</div>:messages.slice(-6).map(message=><div key={message.id} style={{justifySelf:message.role==='user'?'end':'start',maxWidth:'88%',padding:'9px 11px',borderRadius:12,background:message.role==='user'?T.accentMsg:T.bg,border:`1px solid ${message.role==='user'?T.accentMsgBdr:T.border}`,fontSize:11.5,lineHeight:1.5,color:T.text}}>{message.text}</div>)}{twinState==='processing'&&<div style={{fontSize:10.5,color:T.muted}}>Twin Core is checking your learning state first…</div>}</section>
  </div>
}

const sectionCard: React.CSSProperties={border:`1px solid ${T.border}`,background:T.card,borderRadius:16,padding:12,display:'grid',gap:10}
const eyebrow: React.CSSProperties={fontSize:9,fontWeight:900,letterSpacing:.9,textTransform:'uppercase',color:T.muted}
const body: React.CSSProperties={fontSize:11.5,lineHeight:1.55,color:T.muted}
const muted: React.CSSProperties={fontSize:10.5,lineHeight:1.45,color:T.muted}
const resultRow: React.CSSProperties={display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'8px 0',borderBottom:`1px solid ${T.border}`}
const primaryButton: React.CSSProperties={border:0,borderRadius:10,padding:'9px 11px',background:T.accent,color:'#000',fontWeight:900,cursor:'pointer',fontSize:11}
const secondaryButton: React.CSSProperties={border:`1px solid ${T.border}`,borderRadius:10,padding:'8px 10px',background:'transparent',color:T.text,fontWeight:750,cursor:'pointer',fontSize:10.5}
const smallButton: React.CSSProperties={border:`1px solid ${T.border}`,borderRadius:9,padding:'6px 8px',background:'transparent',color:T.text,fontWeight:700,cursor:'pointer',fontSize:9.5,flexShrink:0}
const quietButton: React.CSSProperties={border:0,borderRadius:10,padding:'8px 10px',background:'transparent',color:T.muted,cursor:'pointer',fontSize:10.5}
const optionButton: React.CSSProperties={textAlign:'left',border:`1px solid ${T.border}`,background:T.bg,color:T.text,borderRadius:11,padding:'10px 11px',cursor:'pointer',fontSize:11.5,lineHeight:1.45}

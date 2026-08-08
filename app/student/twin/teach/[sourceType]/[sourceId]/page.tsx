'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  getLearningTransformation,
  recordLearningTransformationEvent,
  type LearningRepresentation,
  type LearningSourceType,
  type LearningTransformation,
} from '@/lib/student/learningTransform'
import { getMultimodalTeachingSequence, type MultimodalTeachingSequence } from '@/lib/student/multimodalTeaching'

const SOURCE_TYPES = new Set<LearningSourceType>(['chapter','homework','teacher_content','vibelearn_content','resource'])

export default function MultimodalTeachingPage() {
  const params = useParams()
  const router = useRouter()
  const sourceTypeRaw = typeof params.sourceType === 'string' ? params.sourceType : ''
  const sourceId = typeof params.sourceId === 'string' ? params.sourceId : ''
  const sourceType = SOURCE_TYPES.has(sourceTypeRaw as LearningSourceType) ? sourceTypeRaw as LearningSourceType : null
  const [sequence, setSequence] = useState<MultimodalTeachingSequence | null>(null)
  const [index, setIndex] = useState(0)
  const [items, setItems] = useState<Partial<Record<LearningRepresentation, LearningTransformation>>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const stage = sequence?.stages[index]
  const item = stage ? items[stage.representation] : undefined

  useEffect(() => {
    if (!sourceType || !sourceId) return
    let cancelled = false
    void (async () => {
      setLoading(true); setError('')
      try {
        const next = await getMultimodalTeachingSequence(sourceType, sourceId)
        if (cancelled) return
        setSequence(next)
        const first = next.stages[0]
        if (!first) throw new Error('Twin could not prepare a teaching sequence.')
        const value = await getLearningTransformation(sourceType, sourceId, first.representation)
        if (cancelled) return
        setItems({ [first.representation]: value })
        void recordLearningTransformationEvent(value.id, 'viewed', { representation: first.representation, multimodal_stage: 1 }).catch(() => undefined)
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Twin could not prepare this learning session.')
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [sourceType, sourceId])

  async function go(nextIndex: number) {
    if (!sequence || !sourceType || !sourceId) return
    const nextStage = sequence.stages[nextIndex]
    if (!nextStage) return
    setLoading(true); setError('')
    try {
      let value = items[nextStage.representation]
      if (!value) {
        value = await getLearningTransformation(sourceType, sourceId, nextStage.representation)
        setItems(current => ({ ...current, [nextStage.representation]: value! }))
      }
      setIndex(nextIndex)
      void recordLearningTransformationEvent(value.id, 'viewed', { representation: nextStage.representation, multimodal_stage: nextStage.stage }).catch(() => undefined)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Twin could not switch teaching mode.') }
    finally { setLoading(false) }
  }

  async function completeAndContinue() {
    if (!stage || !item || !sequence) return
    void recordLearningTransformationEvent(item.id, 'completed', { representation: stage.representation, multimodal_stage: stage.stage }).catch(() => undefined)
    if (index < sequence.stages.length - 1) await go(index + 1)
  }

  const progress = sequence?.stages.length ? Math.round(((index + 1) / sequence.stages.length) * 100) : 0
  const title = item?.payload.title || 'Twin teaching path'
  const representationLabel = useMemo(() => stage?.representation.replaceAll('_',' ') || '', [stage])

  if (!sourceType || !sourceId) return <main style={shell}><section style={card}><h1>Learning source unavailable</h1><button style={primary} onClick={() => router.push('/student/twin')}>Back to VibeTwin</button></section></main>

  return <main style={shell}>
    <header style={header}>
      <button style={back} onClick={() => router.back()}>← Back</button>
      <div><strong>✦ VibeTwin · Guided learning</strong><div style={muted}>One source. More than one way to understand it.</div></div>
    </header>

    <section style={hero}>
      <div style={eyebrow}>ADAPTIVE MULTIMODAL PATH</div>
      <h1 style={{margin:'6px 0 8px'}}>{title}</h1>
      <p style={muted}>Twin starts with the format most likely to help, then deliberately changes representation before finishing with retrieval.</p>
      <div style={progressTrack}><div style={{...progressFill,width:`${progress}%`}} /></div>
      <div style={stageRow}>{sequence?.stages.map((entry, stageIndex) => <button key={entry.stage} onClick={() => void go(stageIndex)} style={{...stageButton,...(stageIndex===index?stageActive:{})}}><strong>{entry.stage}</strong><span>{entry.representation.replaceAll('_',' ')}</span></button>)}</div>
    </section>

    {error && <section role="alert" style={errorBox}>{error}</section>}
    {loading && !item ? <section style={card}>Preparing this teaching stage…</section> : item && stage ? <section style={card}>
      <div style={eyebrow}>STAGE {stage.stage} · {representationLabel.toUpperCase()}</div>
      <p style={muted}>{stage.intent}</p>
      <StageContent item={item} representation={stage.representation} />
      <div style={actions}>
        {index>0 && <button style={secondary} onClick={() => void go(index-1)}>← Previous way</button>}
        {index<((sequence?.stages.length??1)-1) ? <button style={primary} onClick={() => void completeAndContinue()}>I’m ready — teach it another way →</button> : <button style={primary} onClick={() => { void recordLearningTransformationEvent(item.id,'completed',{representation:stage.representation,multimodal_stage:stage.stage}).catch(()=>undefined); router.push('/student/twin?layer=grow') }}>Finish and see my growth</button>}
      </div>
      <div style={notice}>Changing teaching mode does not change your marks or verified mastery. Mastery moves only through authoritative learning evidence.</div>
    </section> : null}
  </main>
}

function StageContent({ item, representation }: { item: LearningTransformation; representation: LearningRepresentation }) {
  const p = item.payload
  if (representation === 'mind_map') return <div style={grid}>{p.nodes?.map((node,index)=><article style={miniCard} key={index}><strong>{node.label}</strong>{node.children?.map((child,i)=><div style={muted} key={i}>↳ {child.label}</div>)}</article>)}</div>
  if (representation === 'worked_examples') return <div style={grid}>{p.workedExamples?.map((example,index)=><article style={miniCard} key={index}><strong>{example.problem}</strong><ol>{example.steps.map((step,i)=><li key={i}>{step}</li>)}</ol>{example.answer&&<b>Answer: {example.answer}</b>}</article>)}</div>
  if (representation === 'quiz') return <div style={grid}>{p.questions?.map((question,index)=><article style={miniCard} key={index}><strong>{index+1}. {question.prompt}</strong><ul>{question.options.map((option,i)=><li key={i}>{String.fromCharCode(65+i)}. {option}</li>)}</ul><details><summary>Check answer</summary><p>{question.options[question.correctIndex]}</p>{question.explanation&&<p>{question.explanation}</p>}</details></article>)}</div>
  if (representation === 'flashcards') return <div style={grid}>{p.cards?.map((entry,index)=><article style={miniCard} key={index}><strong>{entry.front}</strong><details><summary>Reveal</summary><p>{entry.back}</p></details></article>)}</div>
  if (representation === 'visual_explainer') return <div style={grid}>{p.visualSteps?.map((step,index)=><article style={miniCard} key={index}><b>{index+1}. {step.label}</b><p>{step.description}</p></article>)}</div>
  if (representation === 'audio_lesson') return <div style={grid}>{p.script?.map((line,index)=><article style={miniCard} key={index}><b>{line.speaker}</b><p>{line.text}</p></article>)}</div>
  if (representation === 'story_mode' && p.story) return <article style={miniCard}><strong>{p.story.setting}</strong><p>{p.story.narrative}</p><p>{p.story.learningLink}</p></article>
  return <div style={grid}>{p.sections?.map((section,index)=><article style={miniCard} key={index}>{section.heading&&<h3>{section.heading}</h3>}<p>{section.body}</p>{section.bullets?.length?<ul>{section.bullets.map((bullet,i)=><li key={i}>{bullet}</li>)}</ul>:null}</article>)}</div>
}

const shell={maxWidth:960,margin:'0 auto',padding:'18px 14px 90px',fontFamily:'Inter,system-ui,sans-serif'}
const header={display:'flex',gap:12,alignItems:'center',marginBottom:16}
const hero={padding:22,border:'1px solid #d9dde7',borderRadius:20,background:'#fff',marginBottom:16}
const card={padding:20,border:'1px solid #d9dde7',borderRadius:18,background:'#fff',marginBottom:16}
const muted={color:'#667085',fontSize:14}
const eyebrow={fontSize:11,fontWeight:800,letterSpacing:'.08em',color:'#475467'}
const progressTrack={height:8,background:'#eef1f5',borderRadius:999,overflow:'hidden',margin:'16px 0 12px'}
const progressFill={height:'100%',background:'#111827',transition:'width .2s ease'}
const stageRow={display:'flex',gap:8,flexWrap:'wrap' as const}
const stageButton={display:'flex',gap:7,alignItems:'center',padding:'9px 11px',border:'1px solid #d0d5dd',borderRadius:12,background:'#fff',cursor:'pointer'}
const stageActive={borderColor:'#111827',background:'#f3f4f6'}
const grid={display:'grid',gap:12,marginTop:16}
const miniCard={padding:16,border:'1px solid #e4e7ec',borderRadius:14,background:'#fafafa'}
const actions={display:'flex',gap:10,flexWrap:'wrap' as const,marginTop:18}
const primary={border:0,borderRadius:12,padding:'11px 14px',background:'#111827',color:'#fff',fontWeight:700,cursor:'pointer'}
const secondary={border:'1px solid #d0d5dd',borderRadius:12,padding:'11px 14px',background:'#fff',fontWeight:700,cursor:'pointer'}
const back={...secondary,padding:'8px 10px'}
const notice={marginTop:14,fontSize:12,color:'#667085'}
const errorBox={...card,borderColor:'#fda29b',background:'#fffbfa',color:'#b42318'}

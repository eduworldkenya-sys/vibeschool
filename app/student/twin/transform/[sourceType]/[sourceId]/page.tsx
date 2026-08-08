'use client'

import { useEffect, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  getLearningGeneratedAssets,
  getLearningTransformation,
  getRecommendedLearningRepresentation,
  recordLearningTransformationEvent,
  type LearningGeneratedAsset,
  type LearningRepresentation,
  type LearningRepresentationRecommendation,
  type LearningSourceType,
  type LearningTransformation,
  type LearningTransformNode,
  type LearningTransformPayload,
} from '@/lib/student/learningTransform'
import { persistDeterministicRichAssets } from '@/lib/student/richLearningAssets'

const REPRESENTATIONS: Array<{ id: LearningRepresentation; label: string; icon: string; hint: string }> = [
  { id: 'immersive', label: 'Learn', icon: '✦', hint: 'Interactive explanation' },
  { id: 'simplify', label: 'Simplify', icon: 'A', hint: 'Make it easier' },
  { id: 'mind_map', label: 'Mind map', icon: '⌘', hint: 'See the big picture' },
  { id: 'flashcards', label: 'Cards', icon: '▤', hint: 'Recall key ideas' },
  { id: 'quiz', label: 'Quiz', icon: '?', hint: 'Check understanding' },
  { id: 'worked_examples', label: 'Examples', icon: '∑', hint: 'See steps' },
  { id: 'visual_explainer', label: 'Visual', icon: '◫', hint: 'Picture the process' },
  { id: 'audio_lesson', label: 'Audio', icon: '◉', hint: 'Listen and learn' },
  { id: 'story_mode', label: 'Story', icon: '◇', hint: 'Make it relatable' },
  { id: 'revision_sheet', label: 'Revision', icon: '✓', hint: 'Keep what matters' },
]
const SOURCES = new Set<LearningSourceType>(['chapter','homework','teacher_content','vibelearn_content','resource'])

export default function LearningTransformationPage() {
  const params = useParams(); const router = useRouter(); const search = useSearchParams()
  const sourceTypeRaw = typeof params.sourceType === 'string' ? params.sourceType : ''
  const sourceId = typeof params.sourceId === 'string' ? params.sourceId : ''
  const sourceType = SOURCES.has(sourceTypeRaw as LearningSourceType) ? sourceTypeRaw as LearningSourceType : null
  const [active, setActive] = useState<LearningRepresentation>('immersive')
  const [recommendation, setRecommendation] = useState<LearningRepresentationRecommendation | null>(null)
  const [items, setItems] = useState<Partial<Record<LearningRepresentation, LearningTransformation>>>({})
  const [assets, setAssets] = useState<LearningGeneratedAsset[]>([])
  const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [feedback, setFeedback] = useState('')
  const [flipped, setFlipped] = useState<Record<number, boolean>>({}); const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({})
  const viewedRef = useRef(new Set<string>())
  const item = items[active]

  useEffect(() => {
    if (!sourceType || !sourceId) return
    let cancelled = false
    void (async () => {
      let first: LearningRepresentation = 'immersive'
      try {
        const next = await getRecommendedLearningRepresentation(sourceType, sourceId)
        if (cancelled) return
        setRecommendation(next)
        first = next.representation
      } catch {
        if (cancelled) return
        setRecommendation(null)
      }
      await load(first)
    })()
    return () => { cancelled = true }
  }, [sourceType, sourceId])

  async function load(next: LearningRepresentation) {
    if (!sourceType || !sourceId || loading) return
    setActive(next); setError(''); setFeedback('')
    if (items[next]) return
    setLoading(true)
    try {
      const value = await getLearningTransformation(sourceType, sourceId, next)
      setItems(current => ({ ...current, [next]: value }))
      try {
        const cachedAssets = await getLearningGeneratedAssets(value.id)
        if (cachedAssets.length) setAssets(cachedAssets)
        else {
          await persistDeterministicRichAssets(value)
          setAssets(await getLearningGeneratedAssets(value.id))
        }
      } catch {
        setAssets([])
      }
      if (!viewedRef.current.has(value.id)) {
        viewedRef.current.add(value.id)
        void recordLearningTransformationEvent(value.id, 'viewed', { representation: next }).catch(() => undefined)
      }
    } catch (cause) { setError(friendlyError(cause instanceof Error ? cause.message : 'This learning view could not be prepared.')) }
    finally { setLoading(false) }
  }

  async function rate(event: 'helpful' | 'not_helpful') {
    if (!item) return
    setFeedback(event === 'helpful' ? 'Twin will remember that this format helped.' : 'Twin will try different teaching formats more often.')
    try { await recordLearningTransformationEvent(item.id, event, { representation: active }) }
    catch { setFeedback('Your feedback could not be saved, but you can keep learning.') }
  }

  function speak() {
    if (!item || typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const lines = item.payload.script?.map(line => `${line.speaker}. ${line.text}`).join(' ') || item.payload.intro || item.payload.sections?.map(section => `${section.heading ?? ''}. ${section.body ?? ''}`).join(' ') || ''
    if (!lines) return
    const utterance = new SpeechSynthesisUtterance(lines); utterance.rate = .95; window.speechSynthesis.speak(utterance)
  }

  const returnPath = search.get('return')
  const title = item?.payload.title || 'Learn your way'
  const sourceGrounded = item?.payload.sourceGrounded !== false
  const recommendedLabel = recommendation ? REPRESENTATIONS.find(rep => rep.id === recommendation.representation)?.label : null

  if (!sourceType || !sourceId) return <main style={shell}><section style={card}><h1>Learning source unavailable</h1><button style={primary} onClick={() => router.push('/student/twin')}>Back to VibeTwin</button></section></main>

  return <main style={shell}>
    <header style={header}>
      <button style={backButton} onClick={() => returnPath ? router.push(returnPath) : router.back()}>← Back</button>
      <div style={{ minWidth: 0 }}><div style={brand}>✦ VibeTwin · Learn your way</div><div style={muted}>Same source. The way that helps you understand it.</div></div>
    </header>

    <section style={hero}>
      <div style={eyebrow}>PERSONALIZED FROM YOUR VERIFIED LEARNING STATE</div>
      <h1 style={heroTitle}>{title}</h1>
      <p style={heroText}>Switch formats whenever an explanation is not clicking. Twin keeps the source facts fixed while changing the route you take to understand them.</p>
      <div style={heroMeta}><span>{sourceType.replaceAll('_',' ')}</span><span>{sourceGrounded ? 'Source grounded' : 'Check source'}</span>{recommendedLabel && <span>Twin started with {recommendedLabel}</span>}{item?.cached && <span>Cached for speed</span>}{item?.payload.degraded && <span>Offline-safe view</span>}</div>
    </section>

    <nav style={tabs} aria-label="Ways to learn">{REPRESENTATIONS.map(rep => <button key={rep.id} onClick={() => void load(rep.id)} aria-pressed={active===rep.id} style={{ ...tab, ...(active===rep.id ? tabActive : {}) }}><span style={tabIcon}>{rep.icon}</span><strong>{rep.label}{recommendation?.representation===rep.id ? ' · Twin pick' : ''}</strong><small>{rep.hint}</small></button>)}</nav>

    {error && <section role="alert" style={errorBox}>{error}<div style={{ marginTop: 10 }}><button style={secondary} onClick={() => void load(active)}>Try again</button></div></section>}
    {loading && !item ? <section style={loadingCard}><div style={spinner}/><strong>Transforming this source for you…</strong><span style={muted}>Twin is keeping the source fixed while changing the presentation.</span></section> : item ? <TransformationView item={item} active={active} flipped={flipped} setFlipped={setFlipped} quizAnswers={quizAnswers} setQuizAnswers={setQuizAnswers} onSpeak={speak} /> : null}
    {item && assets.length > 0 && <RichAssetShelf assets={assets} onSpeak={speak} />}

    {item && <section style={feedbackCard}><div><strong>Did this way of learning help?</strong><div style={muted}>Your answer changes future presentation choices, not your marks or mastery.</div></div><div style={feedbackActions}><button style={secondary} onClick={() => void rate('helpful')}>Yes, this helped</button><button style={secondary} onClick={() => void rate('not_helpful')}>Try another way</button></div>{feedback && <div role="status" style={feedbackText}>{feedback}</div>}</section>}
    <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
  </main>
}

function TransformationView({ item, active, flipped, setFlipped, quizAnswers, setQuizAnswers, onSpeak }: {
  item: LearningTransformation
  active: LearningRepresentation
  flipped: Record<number,boolean>
  setFlipped: Dispatch<SetStateAction<Record<number,boolean>>>
  quizAnswers: Record<number,number>
  setQuizAnswers: Dispatch<SetStateAction<Record<number,number>>>
  onSpeak:()=>void
}) {
  const payload=item.payload
  useEffect(()=>{ const timer=window.setTimeout(()=>{ void recordLearningTransformationEvent(item.id,'completed',{representation:active}).catch(()=>undefined) },12000); return()=>window.clearTimeout(timer) },[item.id,active])
  return <section style={card}>
    {payload.intro && <p style={intro}>{payload.intro}</p>}
    {(active==='immersive'||active==='simplify'||active==='revision_sheet') && <>
      <div style={sectionGrid}>{payload.sections?.map((section,index)=><article key={index} style={sectionCard}>{section.heading&&<h2 style={sectionTitle}>{section.heading}</h2>}{section.body&&<p style={body}>{section.body}</p>}{(section.bullets?.length??0)>0&&<ul style={list}>{section.bullets?.map((bullet,itemIndex)=><li key={itemIndex}>{bullet}</li>)}</ul>}{section.check?.question&&<details style={check}><summary>{section.check.question}</summary>{section.check.answer&&<p style={body}>{section.check.answer}</p>}</details>}</article>)}</div>
      {(payload.takeaways?.length??0)>0&&<div style={takeaway}><div style={eyebrowDark}>KEEP THESE</div><ul style={list}>{payload.takeaways?.map((item,index)=><li key={index}>{item}</li>)}</ul></div>}
    </>}
    {active==='mind_map' && <div style={mapRoot}>{payload.nodes?.map((node,index)=><MapNode key={index} node={node} depth={0}/>)}</div>}
    {active==='flashcards' && <div style={flashGrid}>{payload.cards?.map((cardItem,index)=><button key={index} onClick={()=>setFlipped(value=>({...value,[index]:!value[index]}))} style={flashCard}><span style={eyebrowDark}>{flipped[index]?'ANSWER':'RECALL'}</span><strong>{flipped[index]?cardItem.back:cardItem.front}</strong><small>{flipped[index]?'Tap to hide':'Think first, then tap'}</small></button>)}</div>}
    {active==='quiz' && <div style={sectionGrid}>{payload.questions?.map((question,index)=>{const chosen=quizAnswers[index];return <article key={index} style={questionCard}><strong>{index+1}. {question.prompt}</strong><div style={optionGrid}>{question.options.map((option,optionIndex)=><button key={optionIndex} onClick={()=>setQuizAnswers(value=>({...value,[index]:optionIndex}))} style={{...optionButton,...(chosen===optionIndex?selectedOption:{})}}>{String.fromCharCode(65+optionIndex)}. {option}</button>)}</div>{chosen!==undefined&&<div style={chosen===question.correctIndex?correct:incorrect}>{chosen===question.correctIndex?'Correct — good retrieval.':'Not yet — use the explanation, then retry mentally.'}{question.explanation&&<div style={{marginTop:5}}>{question.explanation}</div>}</div>}</article>})}<p style={disclaimer}>These generated checks help you learn. They do not change verified mastery until evidence comes through an authoritative practice or assessment flow.</p></div>}
    {active==='audio_lesson' && <><button style={primary} onClick={onSpeak}>▶ Play lesson</button><div style={{display:'grid',gap:8,marginTop:14}}>{payload.script?.map((line,index)=><div key={index} style={{...speechLine,marginLeft:line.speaker.toLowerCase().includes('learner')?30:0}}><strong>{line.speaker}</strong><span>{line.text}</span></div>)}</div></>}
    {active==='worked_examples' && <div style={sectionGrid}>{payload.workedExamples?.map((example,index)=><article key={index} style={sectionCard}><div style={eyebrowDark}>EXAMPLE {index+1}</div><h3>{example.problem}</h3><ol style={list}>{example.steps.map((step,stepIndex)=><li key={stepIndex}>{step}</li>)}</ol>{example.answer&&<div style={takeaway}><strong>Answer: {example.answer}</strong></div>}</article>)}</div>}
    {active==='visual_explainer' && <div style={visualFlow}>{payload.visualSteps?.map((step,index)=><div key={index} style={visualStep}><span style={numberStyle}>{index+1}</span><div><strong>{step.label}</strong><p style={body}>{step.description}</p></div></div>)}</div>}
    {active==='story_mode' && payload.story && <article style={storyCard}>{payload.story.setting&&<div style={eyebrowDark}>{payload.story.setting}</div>}<p style={storyText}>{payload.story.narrative}</p>{payload.story.learningLink&&<div style={takeaway}><strong>Back to the lesson</strong><p style={body}>{payload.story.learningLink}</p></div>}</article>}
    {!hasUsefulContent(payload,active)&&<div style={empty}><strong>This format needs a little more source material.</strong><span>Choose another representation; Twin will not invent missing facts.</span></div>}
  </section>
}

function RichAssetShelf({assets,onSpeak}:{assets:LearningGeneratedAsset[];onSpeak:()=>void}) {
  const [simulationSteps,setSimulationSteps]=useState<Record<string,number>>({})
  return <section style={card}>
    <div style={eyebrowDark}>RICH LEARNING ASSETS · SOURCE GROUNDED</div>
    <div style={richGrid}>{assets.map(asset=>{
      const p=asset.payload
      if(asset.assetType==='diagram') return <article key={asset.id} style={richCard}><h3>Concept diagram</h3><div style={diagramFlow}>{Array.isArray(p.nodes)&&p.nodes.map((raw,index)=>{const node=asRecord(raw);return <div key={index} style={diagramNode}><strong>{asText(node.label)}</strong>{asText(node.detail)&&<small>{asText(node.detail)}</small>}</div>})}</div></article>
      if(asset.assetType==='timeline') return <article key={asset.id} style={richCard}><h3>Learning timeline</h3><div style={timeline}>{Array.isArray(p.items)&&p.items.map((raw,index)=>{const row=asRecord(raw);return <div key={index} style={timelineRow}><span style={numberStyle}>{index+1}</span><div><strong>{asText(row.label)}</strong><div style={muted}>{asText(row.detail)}</div></div></div>})}</div></article>
      if(asset.assetType==='simulation'){const steps=Array.isArray(p.steps)?p.steps:[];const current=Math.min(simulationSteps[asset.id]??0,Math.max(steps.length-1,0));const row=asRecord(steps[current]);return <article key={asset.id} style={richCard}><h3>Step-through simulation</h3><p style={body}>{asText(p.prompt)}</p>{steps.length>0&&<div style={takeaway}><strong>Step {current+1} of {steps.length}</strong><p style={body}>{asText(row.text)}</p></div>}<div style={feedbackActions}><button style={secondary} disabled={current===0} onClick={()=>setSimulationSteps(v=>({...v,[asset.id]:Math.max(0,current-1)}))}>Previous</button><button style={secondary} disabled={current>=steps.length-1} onClick={()=>setSimulationSteps(v=>({...v,[asset.id]:Math.min(steps.length-1,current+1)}))}>Next step</button></div>{asText(p.answer)&&current===steps.length-1&&<div style={correct}>Answer: {asText(p.answer)}</div>}</article>}
      if(asset.assetType==='formula_visual') return <article key={asset.id} style={richCard}><h3>Relationship visual</h3><div style={formulaBox}>{asText(p.expression)}</div><p style={body}>{asText(p.explanation)}</p><small style={muted}>Semantic visual from the source; not a symbolic algebra engine.</small></article>
      if(asset.assetType==='audio') return <article key={asset.id} style={richCard}><h3>Audio companion</h3><button style={primary} onClick={onSpeak}>▶ Listen</button><p style={muted}>Uses on-device/browser speech synthesis from the source-grounded lesson script. No external audio file is claimed.</p></article>
      return null
    })}</div>
  </section>
}

function asRecord(value:unknown):Record<string,unknown>{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>: {}}
function asText(value:unknown):string{return typeof value==='string'?value:''}
function hasUsefulContent(payload:LearningTransformPayload,active:LearningRepresentation){if(['immersive','simplify','revision_sheet'].includes(active))return !!(payload.sections?.length||payload.takeaways?.length);if(active==='mind_map')return !!payload.nodes?.length;if(active==='flashcards')return !!payload.cards?.length;if(active==='quiz')return !!payload.questions?.length;if(active==='audio_lesson')return !!payload.script?.length;if(active==='worked_examples')return !!payload.workedExamples?.length;if(active==='visual_explainer')return !!payload.visualSteps?.length;if(active==='story_mode')return !!payload.story?.narrative;return true}
function MapNode({node,depth}:{node:LearningTransformNode;depth:number}){return <div style={{...mapNode,marginLeft:depth*14,borderLeft:depth?'2px solid var(--vs-border)':'none'}}><strong>{node.label}</strong>{node.children?.map((child,index)=><MapNode key={index} node={child} depth={depth+1}/>)}</div>}
function friendlyError(message:string){if(message.includes('learner_identity'))return 'Learn your way is available from a learner account.';if(message.includes('source_not_available')||message.includes('chapter_not_available'))return 'This learning source is not available to this learner.';if(message.includes('source_has_no_transformable_text'))return 'This resource does not contain enough text to transform yet.';return 'This learning view could not be prepared. Your original material is still safe and unchanged.'}

const shell:CSSProperties={maxWidth:1050,margin:'0 auto',paddingBottom:110,display:'grid',gap:14}
const header:CSSProperties={display:'flex',alignItems:'center',gap:12,position:'sticky',top:0,zIndex:30,padding:'12px 0',background:'color-mix(in srgb,var(--vs-bg) 94%,transparent)',backdropFilter:'blur(16px)'}
const backButton:CSSProperties={border:'1px solid var(--vs-border)',background:'var(--vs-card)',color:'var(--vs-text)',borderRadius:12,padding:'9px 11px',fontWeight:800,cursor:'pointer'}
const brand:CSSProperties={fontSize:18,fontWeight:950}
const hero:CSSProperties={background:'linear-gradient(135deg,#312e81,#6d5dfc 58%,#8b7cff)',color:'#fff',borderRadius:24,padding:'22px 20px',boxShadow:'0 18px 45px rgba(79,70,229,.22)'}
const heroTitle:CSSProperties={fontSize:'clamp(24px,5vw,38px)',lineHeight:1.06,letterSpacing:-1,margin:'7px 0 8px'}
const heroText:CSSProperties={maxWidth:760,lineHeight:1.6,margin:0,opacity:.94}
const heroMeta:CSSProperties={display:'flex',gap:8,flexWrap:'wrap',marginTop:14,fontSize:12,fontWeight:800}
const eyebrow:CSSProperties={fontSize:11,fontWeight:950,letterSpacing:1.4,opacity:.75}
const eyebrowDark:CSSProperties={fontSize:11,fontWeight:950,letterSpacing:1.2,color:'var(--vs-muted)'}
const muted:CSSProperties={fontSize:13,color:'var(--vs-muted)',lineHeight:1.45}
const tabs:CSSProperties={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:8}
const tab:CSSProperties={border:'1px solid var(--vs-border)',background:'var(--vs-card)',color:'var(--vs-text)',borderRadius:15,padding:'10px',display:'grid',gap:3,textAlign:'left',cursor:'pointer'}
const tabActive:CSSProperties={outline:'2px solid #6d5dfc',background:'color-mix(in srgb,#6d5dfc 10%,var(--vs-card))'}
const tabIcon:CSSProperties={fontSize:18,fontWeight:900}
const card:CSSProperties={background:'var(--vs-card)',border:'1px solid var(--vs-border)',borderRadius:20,padding:16,boxShadow:'0 10px 28px rgba(15,23,42,.06)'}
const sectionGrid:CSSProperties={display:'grid',gap:12}
const sectionCard:CSSProperties={border:'1px solid var(--vs-border)',borderRadius:16,padding:15,background:'var(--vs-bg)'}
const sectionTitle:CSSProperties={fontSize:20,margin:'0 0 8px'}
const intro:CSSProperties={fontSize:17,lineHeight:1.65,fontWeight:650}
const body:CSSProperties={lineHeight:1.6,margin:'7px 0'}
const list:CSSProperties={lineHeight:1.65,paddingLeft:20}
const check:CSSProperties={marginTop:10,borderTop:'1px solid var(--vs-border)',paddingTop:10}
const takeaway:CSSProperties={marginTop:14,padding:14,borderRadius:15,background:'color-mix(in srgb,#6d5dfc 9%,var(--vs-bg))'}
const mapRoot:CSSProperties={display:'grid',gap:9}
const mapNode:CSSProperties={padding:'8px 10px',borderRadius:12,background:'var(--vs-bg)',display:'grid',gap:7}
const flashGrid:CSSProperties={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:10}
const flashCard:CSSProperties={minHeight:150,border:'1px solid var(--vs-border)',borderRadius:16,background:'var(--vs-bg)',color:'var(--vs-text)',padding:16,display:'grid',gap:10,textAlign:'left',cursor:'pointer'}
const questionCard:CSSProperties={border:'1px solid var(--vs-border)',borderRadius:16,padding:15}
const optionGrid:CSSProperties={display:'grid',gap:8,marginTop:12}
const optionButton:CSSProperties={border:'1px solid var(--vs-border)',borderRadius:12,padding:'10px 12px',background:'var(--vs-bg)',color:'var(--vs-text)',textAlign:'left',cursor:'pointer'}
const selectedOption:CSSProperties={outline:'2px solid #6d5dfc'}
const correct:CSSProperties={marginTop:10,padding:10,borderRadius:10,background:'rgba(34,197,94,.12)',fontWeight:750}
const incorrect:CSSProperties={marginTop:10,padding:10,borderRadius:10,background:'rgba(245,158,11,.12)',fontWeight:750}
const disclaimer:CSSProperties={fontSize:12,color:'var(--vs-muted)'}
const speechLine:CSSProperties={display:'grid',gap:3,padding:12,borderRadius:14,background:'var(--vs-bg)'}
const visualFlow:CSSProperties={display:'grid',gap:10}
const visualStep:CSSProperties={display:'grid',gridTemplateColumns:'36px 1fr',gap:10,alignItems:'start',padding:12,border:'1px solid var(--vs-border)',borderRadius:14}
const numberStyle:CSSProperties={width:28,height:28,borderRadius:999,display:'grid',placeItems:'center',background:'#6d5dfc',color:'#fff',fontWeight:900,fontSize:12,flex:'0 0 auto'}
const storyCard:CSSProperties={padding:18,borderRadius:18,background:'var(--vs-bg)'}
const storyText:CSSProperties={fontSize:17,lineHeight:1.8}
const empty:CSSProperties={display:'grid',gap:6,padding:18,border:'1px dashed var(--vs-border)',borderRadius:14,color:'var(--vs-muted)'}
const feedbackCard:CSSProperties={background:'var(--vs-card)',border:'1px solid var(--vs-border)',borderRadius:18,padding:15,display:'grid',gap:10}
const feedbackActions:CSSProperties={display:'flex',gap:8,flexWrap:'wrap'}
const feedbackText:CSSProperties={fontSize:13,fontWeight:750}
const primary:CSSProperties={border:0,borderRadius:12,padding:'10px 14px',background:'#6d5dfc',color:'#fff',fontWeight:850,cursor:'pointer'}
const secondary:CSSProperties={border:'1px solid var(--vs-border)',borderRadius:12,padding:'9px 12px',background:'var(--vs-card)',color:'var(--vs-text)',fontWeight:800,cursor:'pointer'}
const errorBox:CSSProperties={padding:15,borderRadius:15,background:'rgba(239,68,68,.10)',border:'1px solid rgba(239,68,68,.25)'}
const loadingCard:CSSProperties={...card,display:'grid',placeItems:'center',gap:10,minHeight:180,textAlign:'center'}
const spinner:CSSProperties={width:30,height:30,border:'3px solid var(--vs-border)',borderTopColor:'#6d5dfc',borderRadius:'50%',animation:'spin .8s linear infinite'}
const richGrid:CSSProperties={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:12,marginTop:12}
const richCard:CSSProperties={border:'1px solid var(--vs-border)',borderRadius:16,padding:14,background:'var(--vs-bg)',display:'grid',gap:10,alignContent:'start'}
const diagramFlow:CSSProperties={display:'grid',gap:8}
const diagramNode:CSSProperties={padding:12,borderRadius:13,background:'var(--vs-card)',border:'1px solid var(--vs-border)',display:'grid',gap:4}
const timeline:CSSProperties={display:'grid',gap:10}
const timelineRow:CSSProperties={display:'grid',gridTemplateColumns:'34px 1fr',gap:10,alignItems:'start'}
const formulaBox:CSSProperties={padding:16,borderRadius:14,background:'var(--vs-card)',border:'1px solid var(--vs-border)',fontSize:18,fontWeight:900,wordBreak:'break-word'}

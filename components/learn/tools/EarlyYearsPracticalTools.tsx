'use client'

import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { VisualLearningAsset } from '@/components/learn/VisualLearningAsset'
import type { TeachingToolSpec } from '@/lib/learn/teachingToolCatalog'
import styles from './TeachingTools.module.css'

/**
 * Stage 3: interactive presentations for author-supplied, already-admitted
 * lesson data. This file performs no publication, authorisation, assessment,
 * learner-data storage or network writes.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function readable(value: unknown, max = 240): value is string {
  return typeof value === 'string' && !!value.trim() && value.length <= max
}
function lines(value: readonly string[] | undefined, max = 10): string[] {
  return Array.isArray(value) && value.length <= max
    ? value.filter((v): v is string => readable(v, 250))
    : []
}
function AllowedVisual({ spec }: { spec: TeachingToolSpec }) {
  if (!spec.visualId || !UUID.test(spec.visualId) ||
    (spec.resourceVersionId && !UUID.test(spec.resourceVersionId))) {
    return <p role="status">No approved illustration has been attached to this activity.</p>
  }
  // The existing API validates the resource/version and serves only admitted media.
  return <VisualLearningAsset id={spec.visualId} resourceVersionId={spec.resourceVersionId} />
}
function Empty({ name }: { name: string }) {
  return <p role="status">This {name} activity needs lesson-specific instructions from the content author.</p>
}
function CopyNotes({ text }: { text: string }) {
  const [status, setStatus] = useState('')
  return <div className={styles.actions}>
    <button type="button" disabled={!text.trim()} onClick={async () => {
      try {
        if (!navigator.clipboard?.writeText) throw Error('Clipboard unavailable')
        await navigator.clipboard.writeText(text)
        setStatus('Copied. Paste this into your existing assignment submission or share with your teacher.')
      } catch {
        setStatus('Copy unavailable. Select your notes and copy them manually.')
      }
    }}>Copy my work</button>
    <span role="status">{status}</span>
  </div>
}

function VisualExplorer({ spec }: { spec: TeachingToolSpec }) {
  const notes = Array.isArray(spec.visualNotes) && spec.visualNotes.length <= 12
    ? spec.visualNotes.filter(n => n && readable(n.label, 80) && readable(n.detail, 500)) : []
  const [selected, setSelected] = useState<number | null>(null)
  return <div className={styles.stack}>
    <AllowedVisual spec={spec} />
    {notes.length > 0 && <>
      <p>Choose a label to explore the illustration.</p>
      <div className={styles.tokenRow}>{notes.map((n, i) =>
        <button type="button" key={i} className={styles.token} aria-pressed={selected === i}
          onClick={() => setSelected(i)}>{n.label}</button>)}</div>
      {selected !== null && <p className={styles.resultBox} role="status">{notes[selected].detail}</p>}
    </>}
  </div>
}

function AudioLearning({ spec }: { spec: TeachingToolSpec }) {
  const spokenText = readable(spec.spokenText, 1500) ? spec.spokenText : ''
  const [status, setStatus] = useState('')
  useEffect(() => () => { if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel() }, [])
  return <div className={styles.stack}>
    {spokenText ? <>
      <p className={styles.resultBox}>{spokenText}</p>
      <div className={styles.actions}>
        <button type="button" onClick={() => {
          if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
            setStatus('Audio is unavailable on this device. Read the text above.')
            return
          }
          window.speechSynthesis.cancel()
          const utterance = new SpeechSynthesisUtterance(spokenText)
          if (spec.language && /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(spec.language)) utterance.lang = spec.language
          utterance.rate = 0.9
          utterance.onerror = () => setStatus('Audio could not play. Read the text above.')
          utterance.onend = () => setStatus('Audio finished.')
          window.speechSynthesis.speak(utterance)
          setStatus('Playing audio.')
        }}>Listen</button>
        <button type="button" className={styles.secondary} onClick={() => {
          if ('speechSynthesis' in window) window.speechSynthesis.cancel()
          setStatus('Audio stopped.')
        }}>Stop</button>
      </div>
      <p role="status">{status}</p>
    </> : <Empty name="listening" />}
  </div>
}

function ObservationJournal({ spec }: { spec: TeachingToolSpec }) {
  const questions = lines(spec.observationQuestions, 8)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  if (!questions.length) return <Empty name="observation" />
  const text = questions.map((q, i) => q + '\n' + (answers[i] ?? '')).join('\n\n')
  return <div className={styles.stack}>
    <p>Observe carefully. Record only what you actually notice; do not guess.</p>
    {questions.map((q, i) => <label key={i} className={styles.promptLine}>
      <span>{q}</span><textarea rows={3} maxLength={1000} value={answers[i] ?? ''}
        onChange={e => setAnswers(previous => ({ ...previous, [i]: e.target.value }))}
        placeholder="Write or describe what you observed" />
    </label>)}
    <CopyNotes text={text} />
    <p className={styles.note}>Your answers stay on this screen until you copy them. They are not submitted or graded automatically.</p>
  </div>
}

function DrawingPad({ spec }: { spec: TeachingToolSpec }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const activePointer = useRef<number | null>(null)
  const [colour, setColour] = useState('#245c92')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('')
  const position = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: (e.clientX - rect.left) * e.currentTarget.width / rect.width,
      y: (e.clientY - rect.top) * e.currentTarget.height / rect.height }
  }
  const start = (e: PointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current !== null || (e.pointerType === 'mouse' && e.button !== 0)) return
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    activePointer.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = position(e)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = colour
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(p.x + 0.01, p.y + 0.01)
    ctx.stroke()
  }
  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current !== e.pointerId) return
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    const p = position(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }
  const finish = (e: PointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current !== e.pointerId) return
    activePointer.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }
  return <div className={styles.stack}>
    <p>{readable(spec.prompt, 400) ? spec.prompt : 'Draw or trace what you are learning. You can also draw on paper.'}</p>
    <div className={styles.controlRow}><label>Pen colour
      <select value={colour} onChange={e => setColour(e.target.value)}>
        <option value="#245c92">Blue</option><option value="#176244">Green</option>
        <option value="#a83434">Red</option><option value="#282828">Black</option>
      </select>
    </label></div>
    <canvas ref={canvas} width={640} height={360} className={styles.drawingBoard}
      aria-label="Freehand drawing board. You can also describe your drawing in the text box below."
      onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} />
    <label>Describe your drawing (also available without touch or mouse)
      <textarea rows={3} maxLength={1000} value={description} onChange={e => setDescription(e.target.value)}
        placeholder="Explain the shapes, colours or objects you drew" />
    </label>
    <div className={styles.actions}>
      <button type="button" onClick={() => {
        canvas.current?.getContext('2d')?.clearRect(0, 0, 640, 360)
        setStatus('Canvas cleared.')
      }} className={styles.secondary}>Clear drawing</button>
      <button type="button" onClick={() => {
        const image = canvas.current?.toDataURL('image/png')
        if (!image) { setStatus('Drawing not available.'); return }
        const link = document.createElement('a')
        link.href = image
        link.download = 'my-learning-drawing.png'
        link.click()
        setStatus('Drawing downloaded to this device. It has not been submitted.')
      }}>Save drawing to device</button>
    </div>
    <CopyNotes text={description} />
    <p role="status">{status}</p>
  </div>
}

function PracticalSteps({ spec }: { spec: TeachingToolSpec }) {
  const steps = lines(spec.steps, 15)
  const materials = lines(spec.materials, 20)
  const [index, setIndex] = useState(0)
  if (!steps.length) return <Empty name="practical" />
  return <div className={styles.stack}>
    {materials.length > 0 && <div className={styles.promptLine}>
      <strong>Materials</strong><ul>{materials.map((m, i) => <li key={i}>{m}</li>)}</ul>
    </div>}
    <p>Step {index + 1} of {steps.length}</p>
    <div className={styles.resultBox} aria-live="polite">{steps[index]}</div>
    <div className={styles.actions}>
      <button className={styles.secondary} type="button" disabled={index === 0} onClick={() => setIndex(i => i - 1)}>Previous step</button>
      <button type="button" disabled={index === steps.length - 1} onClick={() => setIndex(i => i + 1)}>Next step</button>
    </div>
    {index === steps.length - 1 && <p className={styles.note}>All instructions displayed. Ask your teacher for help with equipment or activities that require supervision.</p>}
  </div>
}

function MapExplorer({ spec }: { spec: TeachingToolSpec }) {
  const places = Array.isArray(spec.places) && spec.places.length <= 12
    ? spec.places.filter(p => p && readable(p.label, 100) && readable(p.description, 500)) : []
  const [selected, setSelected] = useState<number | null>(null)
  if (!places.length) return <Empty name="map" />
  const positioned = places.every(p => typeof p.x === 'number' && Number.isFinite(p.x) && p.x >= 0 && p.x <= 100
    && typeof p.y === 'number' && Number.isFinite(p.y) && p.y >= 0 && p.y <= 100)
  return <div className={styles.stack}>
    {spec.visualId && <AllowedVisual spec={spec} />}
    {positioned && <div className={styles.schematicMap} role="group" aria-label="Schematic learning map, not to scale">
      {places.map((p, i) => <button type="button" key={i} className={styles.mapPin}
        aria-label={'Explore ' + p.label} aria-pressed={selected === i}
        style={{ left: String(p.x) + '%', top: String(p.y) + '%' }}
        onClick={() => setSelected(i)}>{i + 1}</button>)}
      <small>Schematic positions only — not to scale</small>
    </div>}
    <div className={styles.tokenRow}>{places.map((p, i) => <button className={styles.token}
      aria-pressed={selected === i} type="button" key={i} onClick={() => setSelected(i)}>
      {i + 1}. {p.label}</button>)}</div>
    {selected !== null && <div className={styles.resultBox} role="status">
      <strong>{places[selected].label}</strong><p>{places[selected].description}</p>
    </div>}
  </div>
}

function TimelineExplorer({ spec }: { spec: TeachingToolSpec }) {
  const events = Array.isArray(spec.events) && spec.events.length <= 15
    ? spec.events.filter(e => e && readable(e.date, 70) && readable(e.label, 150)) : []
  const [selected, setSelected] = useState<number | null>(null)
  if (!events.length) return <Empty name="timeline" />
  return <div className={styles.stack}>
    <p>Explore events in the order supplied in this lesson.</p>
    <ol className={styles.timeline}>{events.map((event, i) => <li key={i}>
      <button type="button" aria-pressed={selected === i} onClick={() => setSelected(i)}>
        <strong>{event.date}</strong> — {event.label}
      </button>
    </li>)}</ol>
    {selected !== null && <p className={styles.resultBox} role="status">
      {readable(events[selected].description, 700) ? events[selected].description : events[selected].label}
    </p>}
  </div>
}

function EvidenceNotes({ spec }: { spec: TeachingToolSpec }) {
  const questions = lines(spec.observationQuestions, 8)
  const [notes, setNotes] = useState('')
  return <div className={styles.stack}>
    {questions.length > 0 && <ul>{questions.map((q, i) => <li key={i}>{q}</li>)}</ul>}
    <label>What did you do, make, notice or learn?
      <textarea rows={7} maxLength={3000} value={notes} onChange={e => setNotes(e.target.value)}
        placeholder="Describe your activity and what you found out" />
    </label>
    <CopyNotes text={notes} />
    <p className={styles.note}>This is a private, unsaved worksheet. To submit evidence, paste your notes into an existing VibeSchool assignment. Do not include another learner's personal information.</p>
  </div>
}

export default function EarlyYearsPracticalTool({ spec }: { spec: TeachingToolSpec }) {
  switch (spec.id) {
    case 'visual-explorer': return <VisualExplorer spec={spec} />
    case 'audio-learning': return <AudioLearning spec={spec} />
    case 'observation-journal': return <ObservationJournal spec={spec} />
    case 'drawing-pad': return <DrawingPad spec={spec} />
    case 'practical-steps': return <PracticalSteps spec={spec} />
    case 'map-explorer': return <MapExplorer spec={spec} />
    case 'timeline-explorer': return <TimelineExplorer spec={spec} />
    case 'evidence-notes': return <EvidenceNotes spec={spec} />
    default: return null
  }
}

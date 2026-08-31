'use client'

import { useEffect, useMemo, useState } from 'react'
import type { LessonPlanSections } from '@/lib/teaching/lessonPlanCodec'

type Props = {
  subject: string
  className: string
  topic: string
  sections: LessonPlanSections
  onClose: () => void
}

const PHASES: Array<{ key: keyof LessonPlanSections; label: string }> = [
  { key: 'introduction', label: 'Introduction' },
  { key: 'development', label: 'Development' },
  { key: 'consolidation', label: 'Consolidation' },
  { key: 'assessmentHook', label: 'Assessment & Exit Check' },
]

function parsePositiveMinutes(value: string | undefined): number | null {
  if (!value) return null
  const minutes = Number(value)
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null
}

/**
 * Lesson sections are built from the exact timetable duration. Teach Mode must
 * use that persisted timing authority and must never invent a conventional
 * 40-minute period when timing metadata is missing.
 */
function totalMinutes(sections: LessonPlanSections): number | null {
  const explicit = sections.assessmentHook.match(
    /Total lesson time:\s*(\d+)\/(\d+)\s*min/i,
  )
  const explicitTotal = parsePositiveMinutes(explicit?.[1])
  const explicitDenominator = parsePositiveMinutes(explicit?.[2])

  if (
    explicitTotal !== null &&
    explicitDenominator !== null &&
    explicitTotal === explicitDenominator
  ) {
    return explicitTotal
  }

  // Backward-compatible recovery for deterministic plans that contain exact
  // phase ranges but predate the explicit total marker. The final phase end is
  // the lesson duration because lessonTimingRanges() is contiguous and exact.
  const rangeEnds = PHASES.flatMap(({ key }) => {
    const match = sections[key].match(/Timing:\s*\d+\s*[–-]\s*(\d+)\s*min/i)
    const end = parsePositiveMinutes(match?.[1])
    return end === null ? [] : [end]
  })

  return rangeEnds.length > 0 ? Math.max(...rangeEnds) : null
}

export default function LessonTeachMode({ subject, className, topic, sections, onClose }: Props) {
  const total = useMemo(() => totalMinutes(sections), [sections])
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    if (total === null) return undefined
    const timer = window.setInterval(() => setElapsedSeconds(value => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [total])

  const remainingSeconds = total === null
    ? null
    : Math.max(0, total * 60 - elapsedSeconds)
  const remainingMinutes = remainingSeconds === null
    ? null
    : Math.floor(remainingSeconds / 60)
  const remainingRemainder = remainingSeconds === null
    ? null
    : String(remainingSeconds % 60).padStart(2, '0')
  const phase = PHASES[phaseIndex]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: '#f8fafc', overflowY: 'auto', padding: '18px 16px 90px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 1 }}>
              Teach Mode · {total === null ? 'Timing unavailable' : `${total} minutes`}
            </div>
            <h1 style={{ margin: '4px 0', fontSize: 22 }}>{topic || subject}</h1>
            <div style={{ fontSize: 12, color: '#64748b' }}>{subject} · {className}</div>
          </div>
          <button type="button" onClick={onClose} style={{ border: '1px solid #d1d5db', background: '#fff', borderRadius: 10, padding: '9px 12px', fontWeight: 800 }}>Close</button>
        </div>

        {total === null && (
          <div style={{ background: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412', borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 12, fontWeight: 700 }}>
            This saved plan has no authoritative timing metadata. The timer is disabled rather than assuming a 40-minute period. Rebuild the plan from its timetable occurrence to restore exact timing.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div style={{ background: '#1e1b4b', color: '#fff', borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase', fontWeight: 800 }}>Lesson remaining</div>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4 }}>
              {remainingMinutes === null || remainingRemainder === null
                ? '—:—'
                : `${remainingMinutes}:${remainingRemainder}`}
            </div>
          </div>
          <div style={{ background: '#eef2ff', color: '#3730a3', borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 10, opacity: 0.75, textTransform: 'uppercase', fontWeight: 800 }}>Current phase</div>
            <div style={{ fontSize: 17, fontWeight: 900, marginTop: 7 }}>{phase.label}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12 }}>
          {PHASES.map((item, index) => (
            <button key={item.key} type="button" onClick={() => setPhaseIndex(index)} style={{ whiteSpace: 'nowrap', borderRadius: 20, padding: '7px 10px', border: index === phaseIndex ? '1px solid #4338ca' : '1px solid #d1d5db', background: index === phaseIndex ? '#eef2ff' : '#fff', color: index === phaseIndex ? '#4338ca' : '#475569', fontSize: 11, fontWeight: 800 }}>{index + 1}. {item.label}</button>
          ))}
        </div>

        <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 18, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>{phaseIndex + 1}. {phase.label}</div>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75, fontSize: 14, color: '#0f172a' }}>{sections[phase.key]}</div>
        </section>

        {phaseIndex === 1 && (
          <section style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#92400e', marginBottom: 6 }}>Resources ready</div>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 13, color: '#78350f' }}>{sections.resources}</div>
          </section>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button type="button" disabled={phaseIndex === 0} onClick={() => setPhaseIndex(index => Math.max(0, index - 1))} style={{ padding: 13, borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 800, opacity: phaseIndex === 0 ? 0.5 : 1 }}>← Previous</button>
          <button type="button" disabled={phaseIndex === PHASES.length - 1} onClick={() => setPhaseIndex(index => Math.min(PHASES.length - 1, index + 1))} style={{ padding: 13, borderRadius: 12, border: 'none', background: '#4338ca', color: '#fff', fontWeight: 800, opacity: phaseIndex === PHASES.length - 1 ? 0.5 : 1 }}>Next →</button>
        </div>
      </div>
    </div>
  )
}

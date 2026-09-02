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

type TeachStep = {
  key: keyof LessonPlanSections
  label: string
  timed: boolean
}

type PackView = 'notes' | 'resources' | 'assessment' | 'homework'

const STEPS: TeachStep[] = [
  { key: 'objectives', label: 'Objectives', timed: false },
  { key: 'introduction', label: 'Introduction', timed: true },
  { key: 'development', label: 'Teach & Learn', timed: true },
  { key: 'consolidation', label: 'Consolidation', timed: true },
  { key: 'assessmentHook', label: 'Assessment & Exit Check', timed: true },
  { key: 'homework', label: 'Homework', timed: false },
]

const TIMED_STEPS = STEPS.filter(step => step.timed)

function parsePositiveMinutes(value: string | undefined): number | null {
  if (!value) return null
  const minutes = Number(value)
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null
}

function totalMinutes(sections: LessonPlanSections): number | null {
  const explicit = sections.assessmentHook.match(/Total lesson time:\s*(\d+)\/(\d+)\s*min/i)
  const explicitTotal = parsePositiveMinutes(explicit?.[1])
  const explicitDenominator = parsePositiveMinutes(explicit?.[2])

  if (explicitTotal !== null && explicitDenominator !== null && explicitTotal === explicitDenominator) {
    return explicitTotal
  }

  const rangeEnds = TIMED_STEPS.flatMap(({ key }) => {
    const match = sections[key].match(/Timing:\s*\d+\s*[–-]\s*(\d+)\s*min/i)
    const end = parsePositiveMinutes(match?.[1])
    return end === null ? [] : [end]
  })

  return rangeEnds.length > 0 ? Math.max(...rangeEnds) : null
}

function PackButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        border: active ? '1px solid #4338ca' : '1px solid #cbd5e1',
        background: active ? '#eef2ff' : '#fff',
        color: active ? '#3730a3' : '#475569',
        borderRadius: 999,
        padding: '8px 11px',
        fontSize: 11,
        fontWeight: 900,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

function PreparedNotes({ sections }: { sections: LessonPlanSections }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {[
        ['Opening notes', sections.introduction],
        ['Core teaching notes', sections.development],
        ['Closure notes', sections.consolidation],
        ['Differentiation', sections.differentiation],
      ].map(([label, value]) => (
        <div key={label} style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 5 }}>{label}</div>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 13, color: '#0f172a' }}>{value}</div>
        </div>
      ))}
    </div>
  )
}

export default function LessonTeachMode({ subject, className, topic, sections, onClose }: Props) {
  const total = useMemo(() => totalMinutes(sections), [sections])
  const [stepIndex, setStepIndex] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [packView, setPackView] = useState<PackView>('notes')

  useEffect(() => {
    if (total === null) return undefined
    const timer = window.setInterval(() => setElapsedSeconds(value => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [total])

  const remainingSeconds = total === null ? null : Math.max(0, total * 60 - elapsedSeconds)
  const remainingMinutes = remainingSeconds === null ? null : Math.floor(remainingSeconds / 60)
  const remainingRemainder = remainingSeconds === null ? null : String(remainingSeconds % 60).padStart(2, '0')
  const step = STEPS[stepIndex]
  const isFinalStep = stepIndex === STEPS.length - 1

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: '#f8fafc', overflowY: 'auto', padding: '18px 16px 90px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 1 }}>
              Teach Now · Prepared Teaching Pack · {total === null ? 'Timing unavailable' : `${total} minutes`}
            </div>
            <h1 style={{ margin: '4px 0', fontSize: 22 }}>{topic || subject}</h1>
            <div style={{ fontSize: 12, color: '#64748b' }}>{subject} · {className}</div>
          </div>
          <button type="button" onClick={onClose} style={{ border: '1px solid #d1d5db', background: '#fff', borderRadius: 10, padding: '9px 12px', fontWeight: 800 }}>Close</button>
        </div>

        {total === null && (
          <div style={{ background: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412', borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 12, fontWeight: 700 }}>
            This saved plan has no authoritative timing metadata. The timer is disabled rather than assuming a conventional period.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10, marginBottom: 14 }}>
          <div style={{ background: '#1e1b4b', color: '#fff', borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase', fontWeight: 800 }}>Lesson remaining</div>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4 }}>{remainingMinutes === null || remainingRemainder === null ? '—:—' : `${remainingMinutes}:${remainingRemainder}`}</div>
          </div>
          <div style={{ background: '#eef2ff', color: '#3730a3', borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 10, opacity: 0.75, textTransform: 'uppercase', fontWeight: 800 }}>Current step</div>
            <div style={{ fontSize: 17, fontWeight: 900, marginTop: 7 }}>{step.label}</div>
          </div>
        </div>

        <section aria-label="Prepared lesson materials" style={{ background: '#fff', border: '1px solid #c7d2fe', borderRadius: 16, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, color: '#3730a3', textTransform: 'uppercase', letterSpacing: '.08em' }}>Ready beside you</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>Resources ready. Use the prepared lesson pack without leaving Teach Now.</div>
            </div>
            <span style={{ borderRadius: 999, background: '#ecfdf5', color: '#065f46', padding: '4px 8px', fontSize: 10, fontWeight: 900 }}>No extra preparation</span>
          </div>
          <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4 }}>
            <PackButton active={packView === 'notes'} label="📄 Notes" onClick={() => setPackView('notes')} />
            <PackButton active={packView === 'resources'} label="🗂 Resources" onClick={() => setPackView('resources')} />
            <PackButton active={packView === 'assessment'} label="📝 Check learning" onClick={() => setPackView('assessment')} />
            <PackButton active={packView === 'homework'} label="🏠 Homework" onClick={() => setPackView('homework')} />
          </div>
          <div style={{ marginTop: 12, borderRadius: 12, background: '#f8fafc', padding: 13 }}>
            {packView === 'notes' && <PreparedNotes sections={sections} />}
            {packView === 'resources' && <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 13, color: '#0f172a' }}>{sections.resources}</div>}
            {packView === 'assessment' && <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 13, color: '#0f172a' }}>{sections.assessmentHook}</div>}
            {packView === 'homework' && (
              <div>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 13, color: '#0f172a' }}>{sections.homework}</div>
                <div style={{ marginTop: 10, fontSize: 11, fontWeight: 900, color: '#4338ca' }}>View · Edit · Assign · Share</div>
              </div>
            )}
          </div>
        </section>

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12 }}>
          {STEPS.map((item, index) => (
            <button key={item.key} type="button" onClick={() => setStepIndex(index)} style={{ whiteSpace: 'nowrap', borderRadius: 20, padding: '7px 10px', border: index === stepIndex ? '1px solid #4338ca' : '1px solid #d1d5db', background: index === stepIndex ? '#eef2ff' : '#fff', color: index === stepIndex ? '#4338ca' : '#475569', fontSize: 11, fontWeight: 800 }}>{index + 1}. {item.label}</button>
          ))}
        </div>

        <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 18, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 1 }}>{stepIndex + 1}. {step.label}</div>
            {!step.timed && <span style={{ borderRadius: 999, background: '#f1f5f9', color: '#475569', padding: '3px 7px', fontSize: 9, fontWeight: 800 }}>Prepared reference</span>}
          </div>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75, fontSize: 14, color: '#0f172a' }}>{sections[step.key]}</div>
        </section>

        {step.key === 'development' && (
          <section style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 14, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#5b21b6', marginBottom: 6 }}>Differentiation ready</div>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 13, color: '#5b21b6' }}>{sections.differentiation}</div>
          </section>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
          <button type="button" disabled={stepIndex === 0} onClick={() => setStepIndex(index => Math.max(0, index - 1))} style={{ padding: 13, borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 800, opacity: stepIndex === 0 ? 0.5 : 1 }}>← Previous</button>
          {isFinalStep ? (
            <button type="button" onClick={onClose} style={{ padding: 13, borderRadius: 12, border: 'none', background: '#4338ca', color: '#fff', fontWeight: 800 }}>Return to lesson workspace →</button>
          ) : (
            <button type="button" onClick={() => setStepIndex(index => Math.min(STEPS.length - 1, index + 1))} style={{ padding: 13, borderRadius: 12, border: 'none', background: '#4338ca', color: '#fff', fontWeight: 800 }}>Next →</button>
          )}
        </div>
      </div>
    </div>
  )
}

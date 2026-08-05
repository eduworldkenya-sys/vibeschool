'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  getCurriculumIntelligence,
  type CurriculumIntelligence,
} from '@/lib/assessment/curriculumIntelligence'

function Dashboard() {
  const params = useSearchParams()
  const assignmentId = params.get('assignmentId') ?? ''
  const [data, setData] = useState<CurriculumIntelligence | null>(null)
  const [loading, setLoading] = useState(Boolean(assignmentId))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!assignmentId) return
    let cancelled = false

    async function load() {
      try {
        const result = await getCurriculumIntelligence(assignmentId)
        if (!cancelled) setData(result)
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not load curriculum intelligence.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [assignmentId])

  return (
    <main style={shell}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <section style={card}>
          <div style={eyebrow}>Assessment Engine</div>
          <h1 style={{ margin: '6px 0' }}>Curriculum Intelligence</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>
            Outcome mastery, competency evidence, and targeted learner interventions.
          </p>
        </section>

        {!assignmentId ? (
          <section style={card}>
            Open Curriculum Intelligence from an assessment analytics record.
          </section>
        ) : loading ? (
          <section style={card}>Loading curriculum intelligence…</section>
        ) : error ? (
          <section style={{ ...card, color: '#b91c1c' }}>{error}</section>
        ) : data ? (
          <>
            <section style={card}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>Outcome mastery</h2>
              {data.outcomes.length === 0 ? (
                <p style={{ color: '#6b7280', marginBottom: 0 }}>
                  No learning outcomes are linked to this assessment yet.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.outcomes.map(outcome => (
                    <div key={outcome.outcomeId} style={row}>
                      <div style={{ minWidth: 0 }}>
                        <strong>
                          {outcome.outcomeCode ? `${outcome.outcomeCode} · ` : ''}
                          {outcome.outcomeText}
                        </strong>
                        <div style={muted}>
                          {outcome.responseCount} responses · {outcome.learnersBelow50} learners below 50%
                        </div>
                        {outcome.competencyTags.length > 0 && (
                          <div style={{ ...muted, marginTop: 5 }}>
                            {outcome.competencyTags.join(' · ')}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <strong style={{ color: masteryColor(outcome.averagePercentage) }}>
                          {outcome.averagePercentage === null
                            ? 'No data'
                            : `${outcome.averagePercentage.toFixed(1)}%`}
                        </strong>
                        <div style={muted}>{outcome.masteryBand.replaceAll('_', ' ')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={card}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>Intervention list</h2>
              {data.interventions.length === 0 ? (
                <p style={{ color: '#065f46', marginBottom: 0 }}>
                  No learner is currently below the intervention threshold.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.interventions.map((signal, index) => (
                    <div key={`${signal.studentId}-${signal.outcomeId}-${index}`} style={row}>
                      <div>
                        <strong>{signal.studentName}</strong>
                        <div style={muted}>
                          {signal.outcomeCode ? `${signal.outcomeCode} · ` : ''}
                          {signal.outcomeText}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ color: '#b91c1c' }}>
                          {signal.masteryScore.toFixed(1)}%
                        </strong>
                        <div style={muted}>
                          {signal.recommendedAction.replaceAll('_', ' ')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  )
}

function masteryColor(value: number | null): string {
  if (value === null) return '#6b7280'
  if (value < 40) return '#b91c1c'
  if (value < 60) return '#b45309'
  return '#065f46'
}

const shell: React.CSSProperties = {
  minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 80px',
  fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827',
}
const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16,
  padding: 16, marginBottom: 12,
}
const eyebrow: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 1,
}
const muted: React.CSSProperties = { fontSize: 12, color: '#6b7280', marginTop: 3 }
const row: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center',
  border: '1px solid #e5e7eb', borderRadius: 12, padding: 13,
}

export default function CurriculumIntelligencePage() {
  return (
    <Suspense fallback={<main style={shell}>Loading curriculum intelligence…</main>}>
      <Dashboard />
    </Suspense>
  )
}

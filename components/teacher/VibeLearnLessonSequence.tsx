'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  attachVibeLearnLessonRecommendation,
  loadVibeLearnLessonSequence,
  type VibeLearnLessonRecommendation,
  type VibeLearnLessonSequence,
  type VibeLearnLessonStage,
} from '@/lib/vibelearn/lessonLearningSequence'

const STAGES: Array<{
  key: VibeLearnLessonStage
  label: string
  help: string
}> = [
  { key: 'introduce', label: 'Introduce', help: 'Open the idea and activate prior knowledge.' },
  { key: 'explain', label: 'Explain', help: 'Give the clearest teacher or learner explanation.' },
  { key: 'demonstrate', label: 'Demonstrate', help: 'Show a worked example, practical or visual representation.' },
  { key: 'check', label: 'Check', help: 'Check understanding before moving on.' },
  { key: 'practice', label: 'Practice', help: 'Give guided or independent practice.' },
  { key: 'support', label: 'Support', help: 'Respond to recorded difficulty or misconception evidence.' },
  { key: 'extend', label: 'Extend', help: 'Stretch learners who are ready for more.' },
  { key: 'homework', label: 'Homework', help: 'Continue the same learning after the lesson.' },
]

function badge(text: string) {
  return (
    <span style={{
      borderRadius: 999,
      border: '1px solid #dbeafe',
      background: '#eff6ff',
      color: '#1d4ed8',
      fontSize: 11,
      fontWeight: 800,
      padding: '2px 7px',
      textTransform: 'capitalize',
    }}>
      {text.replaceAll('_', ' ')}
    </span>
  )
}

export default function VibeLearnLessonSequence({
  lessonPlanId,
  onChanged,
}: {
  lessonPlanId: string
  onChanged?: () => void
}) {
  const [sequence, setSequence] = useState<VibeLearnLessonSequence | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSequence(await loadVibeLearnLessonSequence(lessonPlanId))
    } catch (caught) {
      console.error('[VibeLearnLessonSequence] load failed', caught)
      setSequence(null)
      setError('VibeLearn suggestions are unavailable for this lesson right now.')
    } finally {
      setLoading(false)
    }
  }, [lessonPlanId])

  useEffect(() => {
    void load()
  }, [load])

  const byStage = useMemo(() => {
    const grouped = new Map<VibeLearnLessonStage, VibeLearnLessonRecommendation[]>()
    for (const recommendation of sequence?.recommendations ?? []) {
      const current = grouped.get(recommendation.stage) ?? []
      current.push(recommendation)
      grouped.set(recommendation.stage, current)
    }
    return grouped
  }, [sequence])

  async function add(recommendation: VibeLearnLessonRecommendation) {
    setAdding(recommendation.resourceId + ':' + recommendation.stage)
    setError(null)
    try {
      await attachVibeLearnLessonRecommendation({ lessonPlanId, recommendation })
      setSequence(current => current ? {
        ...current,
        recommendations: current.recommendations.map(item =>
          item.resourceId === recommendation.resourceId
            ? { ...item, alreadyAttached: true }
            : item
        ),
      } : current)
      onChanged?.()
    } catch (caught) {
      console.error('[VibeLearnLessonSequence] attach failed', caught)
      setError(caught instanceof Error ? caught.message : 'The resource could not be added.')
    } finally {
      setAdding(null)
    }
  }

  if (loading) {
    return (
      <section style={{
        marginBottom: 12,
        borderRadius: 12,
        border: '1px solid #dbeafe',
        background: '#f8fbff',
        padding: 12,
        color: '#475569',
        fontSize: 12,
      }}>
        Finding curriculum-matched VibeLearn material and class learning signals…
      </section>
    )
  }

  if (error && !sequence) {
    return (
      <section style={{
        marginBottom: 12,
        borderRadius: 12,
        border: '1px solid #fed7aa',
        background: '#fff7ed',
        padding: 12,
        color: '#9a3412',
        fontSize: 11,
      }}>
        {error}
        <button type="button" onClick={() => void load()} style={{
          marginLeft: 8,
          border: 0,
          background: 'transparent',
          color: '#9a3412',
          fontWeight: 800,
          cursor: 'pointer',
        }}>
          Retry
        </button>
      </section>
    )
  }

  if (!sequence) return null

  const d = sequence.differentiation
  const graphReady = sequence.authority.verifiedConceptCount > 0

  return (
    <section style={{
      marginBottom: 14,
      borderRadius: 14,
      border: '1px solid #bfdbfe',
      background: '#f8fbff',
      padding: 13,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 750, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: .8 }}>
            VibeLearn lesson sequence
          </div>
          <div style={{ marginTop: 3, color: '#475569', fontSize: 11, lineHeight: 1.45 }}>
            Curriculum-first suggestions for this exact lesson. You choose what becomes part of the plan.
          </div>
        </div>
        <button type="button" onClick={() => void load()} style={{
          borderRadius: 8,
          border: '1px solid #bfdbfe',
          background: '#fff',
          color: '#1d4ed8',
          padding: '5px 8px',
          fontSize: 11,
          fontWeight: 800,
          cursor: 'pointer',
        }}>
          Refresh
        </button>
      </div>

      <div style={{
        marginTop: 10,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(104px,1fr))',
        gap: 7,
      }}>
        {[
          ['Needs support', d.needsSupport],
          ['More practice', d.needsPractice],
          ['Ready to extend', d.readyToExtend],
          ['No evidence yet', d.noEvidence],
        ].map(([label, value]) => (
          <div key={String(label)} style={{
            border: '1px solid #e2e8f0',
            background: '#fff',
            borderRadius: 9,
            padding: '8px 9px',
          }}>
            <div style={{ fontSize: 16, fontWeight: 750, color: '#0f172a' }}>{String(value)}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{String(label)}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 8, fontSize: 11, color: '#64748b', lineHeight: 1.45 }}>
        {d.classSize > 0
          ? `${d.classSize} learner${d.classSize === 1 ? '' : 's'} in this class · ${d.learnersWithObservedMisconceptions} with recorded misconception signals.`
          : 'No active class roster was available for differentiation.'}
        {' '}
        Missing evidence is not treated as weakness.
      </div>

      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {badge(graphReady ? 'verified learning graph' : 'curriculum fallback')}
        {badge(`${sequence.authority.outcomeCount} outcomes`)}
        {graphReady && badge(`${sequence.authority.verifiedConceptCount} concepts`)}
        {sequence.authority.verifiedGraphMisconceptionCount > 0 &&
          badge(`${sequence.authority.verifiedGraphMisconceptionCount} verified misconceptions`)}
      </div>

      {error && (
        <div style={{ marginTop: 9, borderRadius: 8, background: '#fff7ed', color: '#9a3412', padding: 8, fontSize: 11 }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {STAGES.map(stage => {
          const items = byStage.get(stage.key) ?? []
          if (items.length === 0) return null

          return (
            <div key={stage.key} style={{
              borderRadius: 11,
              border: '1px solid #e2e8f0',
              background: '#fff',
              padding: 10,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 750, color: '#0f172a' }}>{stage.label}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{stage.help}</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 8 }}>
                {items.map(item => {
                  const key = item.resourceId + ':' + item.stage
                  const isAdding = adding === key
                  return (
                    <div key={key} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 9,
                      paddingTop: 7,
                      borderTop: '1px solid #f1f5f9',
                    }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a' }}>{item.title}</div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                          {badge(item.representation)}
                          {item.certified && badge('certified')}
                          {item.graphMatch && badge('concept match')}
                          {item.misconceptionMatch && badge('misconception support')}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>{item.reason}</div>
                      </div>
                      <button
                        type="button"
                        disabled={item.alreadyAttached || Boolean(adding)}
                        onClick={() => void add(item)}
                        style={{
                          flexShrink: 0,
                          borderRadius: 8,
                          border: item.alreadyAttached ? '1px solid #bbf7d0' : '1px solid #bfdbfe',
                          background: item.alreadyAttached ? '#f0fdf4' : '#eff6ff',
                          color: item.alreadyAttached ? '#166534' : '#1d4ed8',
                          padding: '6px 8px',
                          fontSize: 11,
                          fontWeight: 750,
                          cursor: item.alreadyAttached || adding ? 'default' : 'pointer',
                          opacity: adding && !isAdding ? .55 : 1,
                        }}
                      >
                        {item.alreadyAttached ? 'Added' : isAdding ? 'Adding…' : 'Add'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {sequence.recommendations.length === 0 && (
        <div style={{ marginTop: 10, color: '#64748b', fontSize: 11, lineHeight: 1.5 }}>
          No safe VibeLearn match is available yet. The lesson remains usable; VibeLearn does not invent a resource match.
        </div>
      )}
    </section>
  )
}

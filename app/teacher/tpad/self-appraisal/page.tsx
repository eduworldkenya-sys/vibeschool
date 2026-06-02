"use client";
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { C } from '@/components/teacher/ui'

interface TpadAppraisal {
  id:              string
  status:          string
  standard_1_self: number | null
  standard_2_self: number | null
  standard_3_self: number | null
  standard_4_self: number | null
}

const STANDARDS = [
  {
    num: 1,
    title: 'Professional Knowledge & Practice',
    icon: '📚',
    desc: 'How well do you prepare and deliver lessons? Do you use schemes of work, lesson plans and notes?',
    criteria: [
      'Maintains up-to-date schemes of work',
      'Prepares lesson plans before every lesson',
      'Uses appropriate teaching methods for CBC',
      'Keeps accurate records of learner progress',
      'Integrates ICT in lesson delivery',
    ],
  },
  {
    num: 2,
    title: 'Learning Environment',
    icon: '🏫',
    desc: 'How well do you manage your classroom and support learner welfare?',
    criteria: [
      'Maintains a safe and orderly classroom',
      'Displays learner work and learning materials',
      'Handles learner discipline professionally',
      'Creates an inclusive environment for all learners',
      'Monitors and supports learner attendance',
    ],
  },
  {
    num: 3,
    title: 'Teacher Professionalism',
    icon: '🎯',
    desc: 'How professional is your conduct, punctuality and commitment to development?',
    criteria: [
      'Reports to school and lessons on time',
      'Dresses appropriately and professionally',
      'Participates in school activities and meetings',
      'Attends CPD and training sessions',
      'Maintains good relationships with colleagues and parents',
    ],
  },
  {
    num: 4,
    title: 'Learner Outcomes',
    icon: '📊',
    desc: 'How well are your learners performing and progressing?',
    criteria: [
      'Learners meet set performance targets',
      'Assessments are marked and returned promptly',
      'Weak learners receive extra support',
      'Formative assessments are used regularly',
      'Learner results show improvement over time',
    ],
  },
]

const SCORE_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: 'Unsatisfactory', color: '#991b1b', bg: '#fee2e2' },
  2: { label: 'Below Expectation', color: '#92400e', bg: '#fef3c7' },
  3: { label: 'Meets Expectation', color: '#075985', bg: '#e0f2fe' },
  4: { label: 'Above Expectation', color: '#065f46', bg: '#d1fae5' },
  5: { label: 'Exceptional', color: '#3730a3', bg: '#ede9fe' },
}

function Skeleton({ h = 80 }: { h?: number }) {
  return (
    <div style={{
      height: h, borderRadius: 12, marginBottom: 12,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
    }} />
  )
}

export default function SelfAppraisalPage() {
  const router = useRouter()
  const [userId,    setUserId]    = useState<string | null>(null)
  const [schoolId,  setSchoolId]  = useState<string | null>(null)
  const [termId,    setTermId]    = useState<string | null>(null)
  const [appraisal, setAppraisal] = useState<TpadAppraisal | null>(null)
  const [scores,    setScores]    = useState<Record<number, number | null>>({ 1: null, 2: null, 3: null, 4: null })
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [activeStd, setActiveStd] = useState(1)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (authError || !authData.user) {
          setError('Session expired. Please refresh.')
          setLoading(false)
          return
        }

        const uid = authData.user.id
        setUserId(uid)

        const { data: memberData } = await supabase
          .from('school_members')
          .select('school_id')
          .eq('profile_id', uid)
          .maybeSingle()

        const sid = memberData?.school_id ?? null
        setSchoolId(sid)

        if (!sid) { setLoading(false); return }

        const { data: termData } = await supabase
          .from('academic_terms')
          .select('id')
          .eq('school_id', sid)
          .eq('status', 'active')
          .single()

        if (!termData) { setLoading(false); return }
        setTermId(termData.id)

        const { data: appraisalData } = await supabase
          .from('tpad_appraisals')
          .select('id,status,standard_1_self,standard_2_self,standard_3_self,standard_4_self')
          .eq('teacher_id', uid)
          .eq('term_id', termData.id)
          .maybeSingle()

        if (appraisalData) {
          setAppraisal(appraisalData)
          setScores({
            1: appraisalData.standard_1_self,
            2: appraisalData.standard_2_self,
            3: appraisalData.standard_3_self,
            4: appraisalData.standard_4_self,
          })
        }
      } catch {
        setError('Unexpected error. Please refresh.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleSave() {
    if (!userId || !schoolId || !termId) return
    setSaving(true)
    setError(null)

    const payload = {
      teacher_id:      userId,
      school_id:       schoolId,
      term_id:         termId,
      status:          appraisal?.status ?? 'draft',
      standard_1_self: scores[1],
      standard_2_self: scores[2],
      standard_3_self: scores[3],
      standard_4_self: scores[4],
    }

    const { data: upserted, error: upsertError } = await supabase
      .from('tpad_appraisals')
      .upsert(payload, { onConflict: 'teacher_id,term_id' })
      .select('id,status,standard_1_self,standard_2_self,standard_3_self,standard_4_self')
      .single()

    if (upsertError) {
      setSaving(false)
      setError('Failed to save. ' + upsertError.message)
      return
    }

    setAppraisal(upserted)
    setSaving(false)
    setSaved(true)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 2500)
  }

  async function handleSubmit() {
    if (!userId || !schoolId || !termId) return
    const allFilled = Object.values(scores).every(s => s !== null)
    if (!allFilled) {
      setError('Please rate all 4 standards before submitting.')
      return
    }

    setSubmitting(true)
    setError(null)

    const payload = {
      teacher_id:      userId,
      school_id:       schoolId,
      term_id:         termId,
      status:          'submitted',
      standard_1_self: scores[1],
      standard_2_self: scores[2],
      standard_3_self: scores[3],
      standard_4_self: scores[4],
      submitted_at:    new Date().toISOString(),
    }

    const { error: upsertError } = await supabase
      .from('tpad_appraisals')
      .upsert(payload, { onConflict: 'teacher_id,term_id' })

    if (upsertError) {
      setSubmitting(false)
      setError('Failed to submit. ' + upsertError.message)
      return
    }

    setSubmitting(false)
    router.push('/teacher/tpad')
  }

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current) }, [])

  const isCountersigned = appraisal?.status === 'countersigned'
  const allFilled       = Object.values(scores).every(s => s !== null)

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <Skeleton h={60} />
        <Skeleton h={200} />
        <Skeleton h={200} />
      </div>
    )
  }

  if (error && !appraisal) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ padding: '12px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: C.error, fontSize: 13 }}>
          {error}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '0 0 40px' }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: C.textPrimary, margin: 0 }}>Self-Appraisal</h1>
        <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
          Rate yourself honestly on each of the 4 TPAD standards
        </p>
      </div>

      {isCountersigned && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: C.accentLight, border: `1px solid ${C.accent}`, color: C.accent, fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
          ✓ This appraisal has been countersigned. No further edits allowed.
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: C.error, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Standard tabs */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 20 }}>
        {STANDARDS.map(s => {
          const filled = scores[s.num] !== null
          return (
            <button
              key={s.num}
              onClick={() => setActiveStd(s.num)}
              style={{
                flexShrink: 0, padding: '6px 14px', borderRadius: 99,
                fontSize: 12, fontWeight: activeStd === s.num ? 700 : 500,
                color: activeStd === s.num ? C.accent : filled ? C.textPrimary : C.textMuted,
                background: activeStd === s.num ? C.accentLight : filled ? C.surface : 'transparent',
                border: `1px solid ${activeStd === s.num ? C.accent : filled ? C.accent : C.border}`,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {filled ? '✓ ' : ''}S{s.num}
            </button>
          )
        })}
      </div>

      {/* Active standard */}
      {STANDARDS.filter(s => s.num === activeStd).map(s => (
        <div key={s.num}>
          <div style={{ padding: 20, borderRadius: 16, background: C.bg, border: `1px solid ${C.border}`, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: C.accentLight, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 20,
              }}>
                {s.icon}
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, margin: 0 }}>
                  Standard {s.num}
                </p>
                <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{s.title}</p>
              </div>
            </div>
            <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.5, margin: '0 0 16px' }}>{s.desc}</p>

            {/* Criteria */}
            <p style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              What is assessed
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
              {s.criteria.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: C.textPrimary }}>
                  <span style={{ color: C.accent, flexShrink: 0, marginTop: 1 }}>•</span>
                  {c}
                </div>
              ))}
            </div>

            {/* Score selector */}
            <p style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              Your rating
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3, 4, 5].map(n => {
                const selected = scores[s.num] === n
                const info     = SCORE_LABELS[n]
                return (
                  <button
                    key={n}
                    onClick={() => !isCountersigned && setScores(prev => ({ ...prev, [s.num]: n }))}
                    style={{
                      flex: 1, padding: '12px 4px', borderRadius: 10,
                      background: selected ? info.bg : C.surface,
                      border: `2px solid ${selected ? info.color : C.border}`,
                      color: selected ? info.color : C.textMuted,
                      fontWeight: selected ? 800 : 500, fontSize: 18,
                      cursor: isCountersigned ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {n}
                  </button>
                )
              })}
            </div>

            {scores[s.num] !== null && (
              <div style={{
                marginTop: 10, padding: '8px 12px', borderRadius: 8,
                background: SCORE_LABELS[scores[s.num]!].bg,
                color: SCORE_LABELS[scores[s.num]!].color,
                fontSize: 12, fontWeight: 600,
              }}>
                {scores[s.num]} — {SCORE_LABELS[scores[s.num]!].label}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', gap: 10 }}>
            {activeStd > 1 && (
              <button
                onClick={() => setActiveStd(activeStd - 1)}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12,
                  background: C.surface, border: `1px solid ${C.border}`,
                  color: C.textPrimary, fontWeight: 600, fontSize: 14, cursor: 'pointer',
                }}
              >
                ← Previous
              </button>
            )}
            {activeStd < 4 && (
              <button
                onClick={() => setActiveStd(activeStd + 1)}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12,
                  background: C.accent, border: 'none',
                  color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                }}
              >
                Next →
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Save + Submit */}
      {!isCountersigned && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '12px', borderRadius: 12, width: '100%',
              background: saved ? C.accentLight : C.surface,
              color: saved ? C.accent : C.textPrimary,
              fontWeight: 700, fontSize: 14,
              border: `1px solid ${saved ? C.accent : C.border}`,
              cursor: saving ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
            }}
          >
            {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Draft'}
          </button>

          <button
            onClick={handleSubmit}
            disabled={submitting || !allFilled}
            style={{
              padding: '12px', borderRadius: 12, width: '100%',
              background: allFilled ? C.accent : C.surface,
              color: allFilled ? '#fff' : C.textMuted,
              fontWeight: 700, fontSize: 14, border: 'none',
              cursor: submitting || !allFilled ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Submitting...' : allFilled ? 'Submit to Head Teacher' : 'Rate all 4 standards to submit'}
          </button>
        </div>
      )}
    </div>
  )
}

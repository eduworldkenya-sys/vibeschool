"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { C } from '@/components/teacher/ui'

interface TpadAppraisal {
  id:               string
  status:           string
  standard_1_self:  number | null
  standard_2_self:  number | null
  standard_3_self:  number | null
  standard_4_self:  number | null
  standard_1_head:  number | null
  standard_2_head:  number | null
  standard_3_head:  number | null
  standard_4_head:  number | null
  final_score:      number | null
  submitted_at:     string | null
  countersigned_at: string | null
}

interface AcademicTerm {
  id:           string
  name:         string
  term:         number
  academic_year: number
  start_date:   string
  end_date:     string
  status:       string
}

interface TpadDeadline {
  self_appraisal_due: string
  countersign_due:    string
}

const STANDARDS = [
  { num: 1, title: 'Professional Knowledge & Practice', icon: '📚', desc: 'Lesson preparation, delivery, schemes of work' },
  { num: 2, title: 'Learning Environment',              icon: '🏫', desc: 'Classroom management, student welfare' },
  { num: 3, title: 'Teacher Professionalism',           icon: '🎯', desc: 'Punctuality, conduct, CPD attendance' },
  { num: 4, title: 'Learner Outcomes',                  icon: '📊', desc: 'Student results, assessment records' },
]

function daysUntil(dateStr: string): number {
  const due  = new Date(dateStr)
  const now  = new Date()
  due.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function completionPercent(appraisal: TpadAppraisal | null): number {
  if (!appraisal) return 0
  const fields = [
    appraisal.standard_1_self,
    appraisal.standard_2_self,
    appraisal.standard_3_self,
    appraisal.standard_4_self,
  ]
  const filled = fields.filter(f => f !== null).length
  return Math.round((filled / 4) * 100)
}

function selfScore(appraisal: TpadAppraisal | null): number | null {
  if (!appraisal) return null
  const scores = [
    appraisal.standard_1_self,
    appraisal.standard_2_self,
    appraisal.standard_3_self,
    appraisal.standard_4_self,
  ].filter((s): s is number => s !== null)
  if (scores.length === 0) return null
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 20)
}

function Skeleton({ h = 80 }: { h?: number }) {
  return (
    <div style={{
      height: h, borderRadius: 12,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
      marginBottom: 12,
    }} />
  )
}

export default function TPADDashboard() {
  const router = useRouter()
  const [userId,    setUserId]    = useState<string | null>(null)
  const [schoolId,  setSchoolId]  = useState<string | null>(null)
  const [term,      setTerm]      = useState<AcademicTerm | null>(null)
  const [appraisal, setAppraisal] = useState<TpadAppraisal | null>(null)
  const [deadline,  setDeadline]  = useState<TpadDeadline | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

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

        // Get school_id
        const { data: memberData, error: memberError } = await supabase
          .from('school_members')
          .select('school_id')
          .eq('profile_id', uid)
          .maybeSingle()

        if (memberError) {
          setError('Failed to load school info.')
          setLoading(false)
          return
        }

        const sid = memberData?.school_id ?? null
        setSchoolId(sid)

        if (!sid) {
          setLoading(false)
          return
        }

        // Get active term for this school
        const { data: termData, error: termError } = await supabase
          .from('academic_terms')
          .select('id,name,term,academic_year,start_date,end_date,status')
          .eq('school_id', sid)
          .eq('status', 'active')
          .single()

        if (termError || !termData) {
          setLoading(false)
          return
        }

        setTerm(termData)

        // Load appraisal and deadline in parallel
        const [appraisalRes, deadlineRes] = await Promise.all([
          supabase
            .from('tpad_appraisals')
            .select('id,status,standard_1_self,standard_2_self,standard_3_self,standard_4_self,standard_1_head,standard_2_head,standard_3_head,standard_4_head,final_score,submitted_at,countersigned_at')
            .eq('teacher_id', uid)
            .eq('term_id', termData.id)
            .maybeSingle(),
          supabase
            .from('tpad_deadlines')
            .select('self_appraisal_due,countersign_due')
            .eq('school_id', sid)
            .eq('term_id', termData.id)
            .maybeSingle(),
        ])

        if (appraisalRes.data) setAppraisal(appraisalRes.data)
        if (deadlineRes.data)  setDeadline(deadlineRes.data)

      } catch {
        setError('Unexpected error. Please refresh.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const pct        = completionPercent(appraisal)
  const score      = selfScore(appraisal)
  const scoreColor = score === null ? C.textMuted : score >= 80 ? C.accent : score >= 60 ? C.warning : C.error

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: C.bg,
    border: `1px solid ${C.border}`, borderRadius: 10,
    padding: '10px 14px', color: C.textPrimary, fontSize: 14, outline: 'none',
  }

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <Skeleton h={120} />
        <Skeleton h={80} />
        <Skeleton h={80} />
        <Skeleton h={80} />
      </div>
    )
  }

  if (error) {
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
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.textPrimary, margin: 0 }}>TPAD</h1>
        <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
          Teacher Performance Appraisal & Development
        </p>
      </div>

      {/* No school warning */}
      {!schoolId && (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', color: C.warning, fontSize: 13, marginBottom: 16 }}>
          No school linked to your account. Contact your admin.
        </div>
      )}

      {/* Current term card */}
      {term && (
        <div style={{
          padding: 20, borderRadius: 16, marginBottom: 16,
          background: `linear-gradient(135deg, ${C.dark} 0%, #0f4c35 100%)`,
          color: '#fff',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                Current Term
              </p>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: '4px 0 0' }}>
                {term.name} {term.academic_year}
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                {new Date(term.start_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })} — {new Date(term.end_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                Status
              </p>
              <span style={{
                display: 'inline-block', marginTop: 4,
                padding: '4px 12px', borderRadius: 99,
                background: appraisal?.status === 'countersigned' ? C.accent :
                            appraisal?.status === 'submitted'     ? C.warning :
                            'rgba(255,255,255,0.15)',
                color: '#fff', fontSize: 11, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: 0.8,
              }}>
                {appraisal?.status === 'countersigned' ? 'Complete' :
                 appraisal?.status === 'submitted'     ? 'Submitted' :
                 appraisal                             ? 'In Progress' : 'Not Started'}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', margin: 0 }}>Self-appraisal completion</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#fff', margin: 0 }}>{pct}%</p>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.15)' }}>
              <div style={{
                height: '100%', borderRadius: 99,
                width: `${pct}%`,
                background: C.accent,
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Score + Deadline row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div style={{ padding: 16, borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, textAlign: 'center' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>Self Score</p>
          <p style={{ fontSize: 32, fontWeight: 800, color: scoreColor, margin: '6px 0 0' }}>
            {score !== null ? score + '%' : '—'}
          </p>
        </div>
        <div style={{ padding: 16, borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, textAlign: 'center' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>Deadline</p>
          {deadline ? (
            <>
              <p style={{
                fontSize: 28, fontWeight: 800, margin: '6px 0 0',
                color: daysUntil(deadline.self_appraisal_due) <= 7 ? C.error :
                       daysUntil(deadline.self_appraisal_due) <= 14 ? C.warning : C.accent,
              }}>
                {daysUntil(deadline.self_appraisal_due) < 0 ? 'Past' : daysUntil(deadline.self_appraisal_due) + 'd'}
              </p>
              <p style={{ fontSize: 10, color: C.textMuted, margin: '2px 0 0' }}>
                {new Date(deadline.self_appraisal_due).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
              </p>
            </>
          ) : (
            <p style={{ fontSize: 28, fontWeight: 800, color: C.textMuted, margin: '6px 0 0' }}>—</p>
          )}
        </div>
      </div>

      {/* Standards overview */}
      <p style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
        4 Teaching Standards
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {STANDARDS.map(s => {
          const selfKey = `standard_${s.num}_self` as keyof TpadAppraisal
          const headKey = `standard_${s.num}_head` as keyof TpadAppraisal
          const selfVal = appraisal?.[selfKey] as number | null ?? null
          const headVal = appraisal?.[headKey] as number | null ?? null
          const filled  = selfVal !== null

          return (
            <div key={s.num} style={{
              padding: '14px 16px', borderRadius: 12,
              background: C.bg, border: `1px solid ${filled ? C.accent : C.border}`,
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: filled ? C.accentLight : C.surface,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18,
              }}>
                {filled ? '✓' : s.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, margin: 0 }}>
                  Standard {s.num}
                </p>
                <p style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{s.title}</p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {selfVal !== null ? (
                  <>
                    <p style={{ fontSize: 16, fontWeight: 800, color: C.accent, margin: 0 }}>{selfVal}/5</p>
                    {headVal !== null && (
                      <p style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>Head: {headVal}/5</p>
                    )}
                  </>
                ) : (
                  <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>Not rated</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          onClick={() => router.push('/teacher/tpad/self-appraisal')}
          disabled={appraisal?.status === 'countersigned'}
          style={{
            padding: '14px 20px', borderRadius: 12, width: '100%',
            background: appraisal?.status === 'countersigned' ? C.surface : C.accent,
            color: appraisal?.status === 'countersigned' ? C.textMuted : '#fff',
            fontWeight: 700, fontSize: 14, border: 'none',
            cursor: appraisal?.status === 'countersigned' ? 'not-allowed' : 'pointer',
          }}
        >
          {appraisal?.status === 'countersigned' ? '✓ Appraisal Complete' :
           appraisal?.status === 'submitted'     ? 'Edit Self-Appraisal' :
           appraisal                             ? 'Continue Self-Appraisal' : 'Start Self-Appraisal'}
        </button>

        <button
          onClick={() => router.push('/teacher/tpad/evidence')}
          style={{
            padding: '14px 20px', borderRadius: 12, width: '100%',
            background: C.surface, color: C.textPrimary,
            fontWeight: 600, fontSize: 14,
            border: `1px solid ${C.border}`, cursor: 'pointer',
          }}
        >
          📎 View Evidence
        </button>

        <button
          onClick={() => router.push('/teacher/tpad/history')}
          style={{
            padding: '14px 20px', borderRadius: 12, width: '100%',
            background: C.surface, color: C.textPrimary,
            fontWeight: 600, fontSize: 14,
            border: `1px solid ${C.border}`, cursor: 'pointer',
          }}
        >
          📈 Score History
        </button>
      </div>

      {/* No active term */}
      {!term && schoolId && (
        <div style={{ padding: '16px', borderRadius: 12, background: C.surface, border: `1.5px dashed ${C.border}`, textAlign: 'center', marginTop: 20 }}>
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>
            No active term found. Ask your admin to set up the current term.
          </p>
        </div>
      )}
    </div>
  )
}

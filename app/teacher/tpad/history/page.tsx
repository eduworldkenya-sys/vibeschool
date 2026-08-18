"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { C } from '@/components/teacher/ui'

interface HistoryEntry {
  id:              string
  status:          string
  standard_1_self: number | null
  standard_2_self: number | null
  standard_3_self: number | null
  standard_4_self: number | null
  standard_5_self: number | null
  standard_6_self: number | null
  standard_7_self: number | null
  standard_8_self: number | null
  standard_1_head: number | null
  standard_2_head: number | null
  standard_3_head: number | null
  standard_4_head: number | null
  final_score:     number | null
  submitted_at:    string | null
  term:            { name: string; term: number; academic_year: number } | null
}

function selfAvg(entry: HistoryEntry): number | null {
  const scores = [entry.standard_1_self, entry.standard_2_self, entry.standard_3_self, entry.standard_4_self, entry.standard_5_self, entry.standard_6_self, entry.standard_7_self, entry.standard_8_self].filter((s): s is number => s !== null)
  if (scores.length === 0) return null
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 20)
}

function headAvg(entry: HistoryEntry): number | null {
  const scores = [entry.standard_1_head, entry.standard_2_head, entry.standard_3_head, entry.standard_4_head].filter((s): s is number => s !== null)
  if (scores.length === 0) return null
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 20)
}

function scoreColor(score: number | null): string {
  if (score === null) return C.textMuted
  if (score >= 80) return C.accent
  if (score >= 60) return C.warning
  return C.error
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

export default function HistoryPage() {
  const [history,  setHistory]  = useState<HistoryEntry[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

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

        const { data, error: fetchError } = await supabase
          .from('tpad_appraisals')
          .select(`
            id, status,
            standard_1_self, standard_2_self, standard_3_self, standard_4_self,
            standard_5_self, standard_6_self, standard_7_self, standard_8_self,
            standard_1_head, standard_2_head, standard_3_head, standard_4_head,
            final_score, submitted_at,
            term:academic_terms(name, term, academic_year)
          `)
          .eq('teacher_id', uid)
          .order('created_at', { ascending: false })

        if (fetchError) {
          setError('Failed to load history.')
          setLoading(false)
          return
        }

        const normalized = (data ?? []).map(row => ({
          ...row,
          term: Array.isArray(row.term) ? row.term[0] ?? null : row.term,
        })) as unknown as HistoryEntry[]

        setHistory(normalized)
      } catch {
        setError('Unexpected error. Please refresh.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <Skeleton h={60} />
        <Skeleton h={120} />
        <Skeleton h={120} />
      </div>
    )
  }

  return (
    <div style={{ padding: '0 0 40px' }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: C.textPrimary, margin: 0 }}>Score History</h1>
        <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>Your TPAD scores across all terms</p>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: C.error, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {history.length === 0 && !loading && (
        <div style={{ padding: 20, borderRadius: 12, background: C.surface, border: `1.5px dashed ${C.border}`, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>No appraisal history yet. Complete your first self-appraisal to see history here.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {history.map(entry => {
          const self = selfAvg(entry)
          const head = headAvg(entry)
          const final = entry.final_score
          return (
            <div key={entry.id} style={{ padding: 16, borderRadius: 14, background: C.bg, border: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, margin: 0 }}>
                    {entry.term?.name ?? 'Unknown Term'} {entry.term?.academic_year ?? ''}
                  </p>
                  <span style={{
                    display: 'inline-block', marginTop: 4,
                    padding: '2px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                    background: entry.status === 'countersigned' ? C.accentLight :
                                entry.status === 'submitted'     ? '#fef3c7' : C.surface,
                    color:      entry.status === 'countersigned' ? C.accent :
                                entry.status === 'submitted'     ? C.warning : C.textMuted,
                  }}>
                    {entry.status === 'countersigned' ? 'Complete' :
                     entry.status === 'submitted'     ? 'Submitted' : 'Draft'}
                  </span>
                </div>
                {final !== null && (
                  <p style={{ fontSize: 28, fontWeight: 800, color: scoreColor(final), margin: 0 }}>
                    {final}%
                  </p>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ padding: '10px 14px', borderRadius: 10, background: C.surface, textAlign: 'center' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>Self Score</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: scoreColor(self), margin: '4px 0 0' }}>
                    {self !== null ? self + '%' : '—'}
                  </p>
                </div>
                <div style={{ padding: '10px 14px', borderRadius: 10, background: C.surface, textAlign: 'center' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>Head Score</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: scoreColor(head), margin: '4px 0 0' }}>
                    {head !== null ? head + '%' : '—'}
                  </p>
                </div>
              </div>

              {entry.submitted_at && (
                <p style={{ fontSize: 11, color: C.textMuted, marginTop: 10 }}>
                  Submitted {new Date(entry.submitted_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

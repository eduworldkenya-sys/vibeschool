"use client"

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type EnsureSchemeResult = {
  ok?: boolean
  status?: 'healthy' | 'repaired' | 'relinked' | string
  reason?: string | null
  required_lessons?: number
  capacity?: number
  term_weeks?: number
  lessons_per_week?: number
  rows?: number
}

function explainFailure(payload: EnsureSchemeResult | null): string {
  switch (payload?.reason) {
    case 'weekly_allocation_missing':
      return 'This subject has no official weekly lesson allocation configured. The scheme was not guessed or auto-filled.'
    case 'curriculum_not_found':
      return 'No canonical curriculum is available for this class, subject and term. The scheme was not guessed.'
    case 'curriculum_exceeds_term_capacity':
      return `The curriculum requires ${payload?.required_lessons ?? 'more'} lessons but this term can hold only ${payload?.capacity ?? 'the configured number'}. Fix the curriculum or weekly allocation before scheduling.`
    case 'historical_scheme_structure_mismatch':
      return 'Previously taught scheme rows conflict with the canonical curriculum schedule. VibeSchool preserved the teaching record instead of silently rewriting history.'
    case 'not_authorized':
      return 'You are not authorised to generate this class scheme.'
    default:
      return payload?.reason
        ? `Scheme generation is blocked: ${payload.reason.replaceAll('_', ' ')}.`
        : 'The canonical scheme could not be verified.'
  }
}

export function SchemeCanonicalGuard({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams()
  const classId = searchParams.get('classId')
  const subjectId = searchParams.get('subjectId')
  const termId = searchParams.get('termId')
  const lastAttemptRef = useRef<string | null>(null)
  const [issue, setIssue] = useState<string | null>(null)

  useEffect(() => {
    if (!classId || !subjectId || !termId) return

    const key = `${classId}:${subjectId}:${termId}`
    if (lastAttemptRef.current === key) return
    lastAttemptRef.current = key

    let cancelled = false

    async function ensureCanonicalScheme() {
      setIssue(null)
      const { data, error } = await supabase.rpc('ensure_scheme_from_curriculum', {
        p_class_id: classId,
        p_subject_id: subjectId,
        p_academic_term_id: termId,
      })

      if (cancelled) return

      if (error) {
        setIssue(`Canonical scheme verification failed: ${error.message}`)
        return
      }

      const payload = data as EnsureSchemeResult | null
      if (!payload?.ok) {
        setIssue(explainFailure(payload))
        return
      }

      const reloadKey = `vs-scheme-canonical-reload:${key}`
      if (payload.status === 'healthy') {
        window.sessionStorage.removeItem(reloadKey)
        return
      }

      if (payload.status === 'repaired' || payload.status === 'relinked') {
        if (!window.sessionStorage.getItem(reloadKey)) {
          window.sessionStorage.setItem(reloadKey, '1')
          window.location.reload()
        }
      }
    }

    void ensureCanonicalScheme()
    return () => { cancelled = true }
  }, [classId, subjectId, termId])

  return (
    <>
      {issue && (
        <div
          role="alert"
          style={{
            margin: '0 0 12px',
            padding: '11px 14px',
            borderRadius: 12,
            border: '1px solid #fca5a5',
            background: '#fff1f2',
            color: '#be123c',
            fontSize: 12,
            fontWeight: 700,
            lineHeight: 1.5,
          }}
        >
          {issue}
        </div>
      )}
      {children}
    </>
  )
}

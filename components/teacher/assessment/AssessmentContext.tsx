'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  loadAssessmentContext,
  reconcileSelection,
  visibleAssignments,
  emptySelection,
  contextQuery,
  type AssessmentContext,
  type AssessmentSelection,
} from '@/lib/assessment/workspace'
import styles from './AssessmentWorkspace.module.css'
export function useAssessmentContext() {
  const params = useSearchParams(),
    queryString = params.toString(),
    initial = useRef(queryString),
    lastQuery = useRef(queryString),
    ticket = useRef(0)
  const [context, setContext] = useState<AssessmentContext | null>(null),
    [selection, setSelection] = useState<AssessmentSelection>(emptySelection)
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  const load = useCallback(async (expectedSchool?: string) => {
    const current = ++ticket.current
    setLoading(true)
    setError('')
    setNotice('')
    setContext(null)
    try {
      const ctx = await loadAssessmentContext()
      if (current !== ticket.current) return
      if (expectedSchool && ctx.schoolId !== expectedSchool)
        throw new Error('The selected school could not be confirmed. Reload before continuing.')
      let saved: Partial<AssessmentSelection> = {}
      try {
        const stored = localStorage.getItem(`teacher-assessment:${ctx.teacherId}:${ctx.schoolId}`)
        if (stored) saved = JSON.parse(stored)
      } catch {
        setNotice('Your last selections could not be restored. Choose your context below.')
      }
      const query = new URLSearchParams(initial.current),
        incoming = expectedSchool
          ? {}
          : Object.fromEntries(
              ['classId', 'subjectId', 'termId', 'assignmentId']
                .filter((key) => query.get(key))
                .map((key) => [key, query.get(key)]),
            )
      const requested = ctx.assignments.find((a) => a.id === incoming.assignmentId)
      if (requested) {
        if (!query.has('classId')) incoming.classId = requested.classId
        if (!query.has('subjectId')) incoming.subjectId = requested.subjectId
        if (!query.has('termId')) incoming.termId = ''
      }
      const merged = { ...saved, ...incoming },
        valid = reconcileSelection(ctx, merged)
      if (
        Object.entries(incoming).some(
          ([key, value]) => valid[key as keyof AssessmentSelection] !== value,
        )
      )
        setNotice(
          'That selection is not available in your current school. Choose a valid context below.',
        )
      setContext(ctx)
      setSelection(valid)
    } catch (cause) {
      if (current === ticket.current)
        setError(
          cause instanceof Error
            ? cause.message
            : 'Your assessment context could not be loaded. Please retry.',
        )
    } finally {
      if (current === ticket.current) setLoading(false)
    }
  }, [])
  useEffect(() => {
    void load()
    return () => {
      ticket.current += 1
    }
  }, [load])
  useEffect(() => {
    if (!context || lastQuery.current === queryString) return
    lastQuery.current = queryString
    initial.current = queryString
    const query = new URLSearchParams(queryString),
      incoming = Object.fromEntries(
        ['classId', 'subjectId', 'termId', 'assignmentId'].map((key) => [
          key,
          query.get(key) ?? '',
        ]),
      )
    setSelection(reconcileSelection(context, incoming))
  }, [context, queryString])
  function choose(next: Partial<AssessmentSelection>) {
    if (!context) return
    const valid = reconcileSelection(context, { ...selection, ...next })
    setSelection(valid)
    setNotice('')
    try {
      localStorage.setItem(
        `teacher-assessment:${context.teacherId}:${context.schoolId}`,
        JSON.stringify(valid),
      )
    } catch {
      setNotice('Selections work for this visit but could not be saved in this browser.')
    }
  }
  async function school(id: string) {
    if (!context || id === context.schoolId) return
    const current = ++ticket.current
    setContext(null)
    setLoading(true)
    setError('')
    try {
      const result = await supabase.rpc('set_my_active_teacher_school', {
        p_school_id: id,
      })
      if (result.error) throw result.error
      if (current !== ticket.current) return
      initial.current = ''
      await load(id)
    } catch {
      if (current === ticket.current) {
        setError('The selected school could not be confirmed. Retry before opening records.')
        setLoading(false)
      }
    }
  }
  return {
    context,
    selection,
    choose,
    school,
    loading,
    error,
    notice,
    retry: () => void load(),
    assignments: context ? visibleAssignments(context, selection) : [],
  }
}
export type WorkspaceScope = ReturnType<typeof useAssessmentContext>
export function AssessmentContextControls({
  scope,
  disabled = false,
  canChange = () => true,
}: {
  scope: WorkspaceScope
  disabled?: boolean
  canChange?: () => boolean
}) {
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    if (typeof window.matchMedia === 'function')
      setExpanded(window.matchMedia('(min-width: 651px)').matches)
  }, [])
  const { context, selection, choose } = scope
  if (!context) return null
  const subjects = Array.from(
    new Map(
      context.subjects
        .filter((s) => !selection.classId || s.classId === selection.classId)
        .map((s) => [s.id, s]),
    ).values(),
  )
  const current = context.assignments.find((a) => a.id === selection.assignmentId)
  return (
    <details
      className={styles.context}
      open={expanded}
      onToggle={(e) => setExpanded(e.currentTarget.open)}
    >
      <summary>
        Context · {context.schools.find((s) => s.id === context.schoolId)?.name}
        {selection.classId
          ? ' · ' + context.classes.find((c) => c.id === selection.classId)?.name
          : ''}
        {current ? ' · ' + current.title : ''}
      </summary>
      <div className={styles.contextFields}>
        {
          <label>
            School
            <select
              aria-label="School"
              disabled={disabled || context.schools.length === 1}
              value={context.schoolId}
              onChange={(e) => {
                if (canChange()) void scope.school(e.target.value)
              }}
            >
              {context.schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        }
        <label>
          Class
          <select
            aria-label="Class"
            disabled={disabled}
            value={selection.classId}
            onChange={(e) => {
              if (canChange()) choose({ classId: e.target.value, assignmentId: '' })
            }}
          >
            <option value="">All my classes</option>
            {context.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Subject
          <select
            aria-label="Subject"
            disabled={disabled}
            value={selection.subjectId}
            onChange={(e) => {
              if (canChange()) choose({ subjectId: e.target.value, assignmentId: '' })
            }}
          >
            <option value="">All my subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Assigned during
          <select
            aria-label="Assigned during"
            disabled={disabled}
            value={selection.termId}
            onChange={(e) => {
              if (canChange()) choose({ termId: e.target.value, assignmentId: '' })
            }}
          >
            <option value="">Any term</option>
            {context.terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Assessment
          <select
            aria-label="Assessment"
            disabled={disabled}
            value={selection.assignmentId}
            onChange={(e) => {
              if (canChange()) choose({ assignmentId: e.target.value })
            }}
          >
            <option value="">All assessments</option>
            {scope.assignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </label>
      </div>
    </details>
  )
}
export function AssessmentHeading({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <header className={styles.header}>
      <div>
        <Link href="/teacher/assessment">Assessments</Link>
        <h1>{title}</h1>
        <p className={styles.muted}>{description}</p>
      </div>
      {children && <div className={styles.actions}>{children}</div>}
    </header>
  )
}
export function ContextState({ scope }: { scope: WorkspaceScope }) {
  return (
    <>
      {scope.loading && <p role="status">Loading your assessment context…</p>}
      {scope.error && (
        <div role="alert" className={styles.error}>
          {scope.error}
          <div className={styles.actions}>
            <button onClick={scope.retry}>Retry</button>
            <Link href="/teacher/onboarding/school">School access</Link>
          </div>
        </div>
      )}
      {scope.notice && (
        <p role="status" className={styles.notice}>
          {scope.notice}
        </p>
      )}
    </>
  )
}
export function workspaceHref(
  page: 'marking' | 'analytics' | 'curriculum' | 'interventions',
  selection: AssessmentSelection,
) {
  const query = contextQuery(selection)
  return `/teacher/assessment/${page}${query ? '?' + query : ''}`
}

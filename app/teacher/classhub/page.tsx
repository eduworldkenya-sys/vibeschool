'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { C } from '@/components/teacher/ui'

export const dynamic = 'force-dynamic'

type TeacherClassRow = { class_id: string; subject_id: string; is_class_teacher: boolean | null }
type ClassRow = { id: string; name: string; stream: string | null; subject: string | null }

export default function ClassHubPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) {
        router.replace('/academy/signin?role=teacher')
        return
      }

      const { data: assignments, error: assignmentError } = await supabase
        .from('teacher_classes')
        .select('class_id,subject_id,is_class_teacher')
        .eq('teacher_id', user.id)

      if (assignmentError) {
        if (!cancelled) {
          setError('We could not load your classes. Please try again.')
          setLoading(false)
        }
        return
      }

      const classIds = Array.from(new Set(((assignments ?? []) as TeacherClassRow[]).map(row => row.class_id).filter(Boolean)))
      if (classIds.length === 0) {
        if (!cancelled) {
          setClasses([])
          setCounts({})
          setLoading(false)
        }
        return
      }

      const subjectIds = Array.from(new Set(((assignments ?? []) as TeacherClassRow[]).map(row => row.subject_id).filter(Boolean)))
      const [classResult, enrollmentResult, subjectResult] = await Promise.all([
        supabase.from('classes').select('id,name,stream,subject').in('id', classIds).order('name'),
        supabase.from('student_classes').select('class_id').in('class_id', classIds),
        subjectIds.length ? supabase.from('subjects').select('id,name').in('id', subjectIds) : Promise.resolve({ data: [], error: null }),
      ])

      if (classResult.error || subjectResult.error) {
        if (!cancelled) {
          setError('We found your class assignments but could not load their details.')
          setLoading(false)
        }
        return
      }

      const nextCounts: Record<string, number> = {}
      for (const row of enrollmentResult.data ?? []) {
        if (row.class_id) nextCounts[row.class_id] = (nextCounts[row.class_id] ?? 0) + 1
      }

      const subjectById = new Map<string, string>((subjectResult.data ?? []).map(row => [String(row.id), String(row.name)] as const))
      const subjectsByClass = new Map<string, Set<string>>()
      for (const assignment of (assignments ?? []) as TeacherClassRow[]) {
        const name = subjectById.get(assignment.subject_id)
        if (!name) continue
        const names = subjectsByClass.get(assignment.class_id) ?? new Set<string>()
        names.add(name)
        subjectsByClass.set(assignment.class_id, names)
      }
      const classRows = ((classResult.data ?? []) as ClassRow[]).map(row => ({
        ...row,
        subject: Array.from(subjectsByClass.get(row.id) ?? []).join(', ') || row.subject,
      }))

      if (!cancelled) {
        setClasses(classRows)
        setCounts(nextCounts)
        setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [router])

  return (
    <div style={{ padding: '20px 16px 32px', color: C.textPrimary }}>
      <div style={{ marginBottom: 20 }}>
        <p style={{ margin: 0, color: C.textMuted, fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase' }}>Classes</p>
        <h1 style={{ margin: '6px 0 4px', fontSize: 28, fontWeight: 900 }}>My Classes</h1>
        <p style={{ margin: 0, color: C.textMuted, fontSize: 14 }}>Open a class to manage its students, attendance, homework and teaching work.</p>
        <button type="button" onClick={() => router.push('/teacher/classhub/add')} style={{ marginTop: 14, padding: '11px 15px', border: 0, borderRadius: 11, background: C.accent, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>+ Add or join class</button>
      </div>

      {searchParams.get('added') === '1' && <div role="status" style={{ marginBottom: 14, padding: 11, borderRadius: 11, background: '#ecfdf5', color: '#065f46', fontWeight: 700, fontSize: 13 }}>Class assignment added.</div>}

      {loading && (
        <div aria-live="polite" style={{ display: 'grid', gap: 12 }}>
          {[1, 2, 3].map(i => <div key={i} style={{ height: 92, borderRadius: 18, background: '#f3f4f6' }} />)}
        </div>
      )}

      {!loading && error && (
        <div role="alert" style={{ padding: 16, border: `1px solid ${C.border}`, borderRadius: 16, background: C.bg }}>
          <strong>Classes unavailable</strong>
          <p style={{ margin: '6px 0 0', color: C.textMuted }}>{error}</p>
        </div>
      )}

      {!loading && !error && classes.length === 0 && (
        <div style={{ padding: '32px 20px', border: `1px solid ${C.border}`, borderRadius: 18, background: C.bg, textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>No classes assigned yet</h2>
          <p style={{ margin: '8px 0 14px', color: C.textMuted, lineHeight: 1.5 }}>Add the class and subject you teach. If the school class already exists, VibeSchool will reuse it.</p>
          <button type="button" onClick={() => router.push('/teacher/classhub/add')} style={{ padding: '10px 14px', border: 0, borderRadius: 10, background: C.accent, color: '#fff', fontWeight: 800 }}>Add your first class</button>
        </div>
      )}

      {!loading && !error && classes.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          {classes.map(cls => (
            <button
              key={cls.id}
              type="button"
              onClick={() => router.push(`/teacher/classhub/${cls.id}`)}
              style={{ width: '100%', padding: 16, border: `1px solid ${C.border}`, borderRadius: 18, background: C.bg, color: C.textPrimary, textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 900 }}>{cls.name}{cls.stream ? ` ${cls.stream}` : ''}</div>
                  <div style={{ marginTop: 5, color: C.textMuted, fontSize: 13 }}>{cls.subject || 'Class workspace'} · {counts[cls.id] ?? 0} students</div>
                </div>
                <span aria-hidden="true" style={{ fontSize: 24 }}>›</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

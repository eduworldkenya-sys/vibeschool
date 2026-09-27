'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { C } from '@/components/teacher/ui'

export const dynamic = 'force-dynamic'

type OperatingAssignment = { class_id: string; class_name: string; stream: string | null; subject_name: string }
type ClassRow = { id: string; name: string; stream: string | null; subjects: string[] }

export default function ClassHubPage() {
  const router = useRouter()
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

      const { data: operatingData, error: operatingError } = await supabase.rpc('teacher_get_operating_context')
      const operating = operatingData as { school_id?: string | null; classes?: OperatingAssignment[] } | null
      const activeSchoolId = operating?.school_id ?? null
      if (operatingError || !activeSchoolId) {
        if (!cancelled) { setError('Connect or select your active school before opening classes.'); setLoading(false) }
        return
      }

      const assignments = operating?.classes ?? []
      const byClass = new Map<string, ClassRow>()
      for (const row of assignments) {
        const existing = byClass.get(row.class_id)
        if (existing) {
          if (row.subject_name && !existing.subjects.includes(row.subject_name)) existing.subjects.push(row.subject_name)
        } else {
          byClass.set(row.class_id, {
            id: row.class_id,
            name: row.class_name,
            stream: row.stream,
            subjects: row.subject_name ? [row.subject_name] : [],
          })
        }
      }
      const nextClasses = Array.from(byClass.values()).sort((a, b) =>
        `${a.name} ${a.stream ?? ''}`.localeCompare(`${b.name} ${b.stream ?? ''}`)
      )
      const classIds = nextClasses.map(row => row.id)
      if (classIds.length === 0) {
        if (!cancelled) {
          setClasses([])
          setCounts({})
          setLoading(false)
        }
        return
      }

      const enrollmentResult = await supabase
        .from('student_classes')
        .select('class_id')
        .in('class_id', classIds)
        .eq('is_current', true)

      const nextCounts: Record<string, number> = {}
      for (const row of enrollmentResult.data ?? []) {
        if (row.class_id) nextCounts[row.class_id] = (nextCounts[row.class_id] ?? 0) + 1
      }

      if (!cancelled) {
        setClasses(nextClasses)
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 6 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>My Classes</h1>
          <button type="button" onClick={() => router.push('/teacher/classhub/add')} style={{ minHeight: 42, border: 0, borderRadius: 12, padding: '0 14px', background: C.accent, color: '#fff', fontWeight: 900, cursor: 'pointer' }}>+ Add class</button>
        </div>
        <p style={{ margin: '6px 0 0', color: C.textMuted, fontSize: 14 }}>Open a class to manage teaching work, or go directly to evidence-backed Student progress.</p>
      </div>

      {loading && (
        <div aria-live="polite" style={{ display: 'grid', gap: 12 }}>
          {[1, 2, 3].map(i => <div key={i} style={{ height: 108, borderRadius: 18, background: '#f3f4f6' }} />)}
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
          <p style={{ margin: '8px 0 14px', color: C.textMuted, lineHeight: 1.5 }}>Add the class and subject you teach. If the class already exists at your verified school, VibeSchool reuses it.</p>
          <button type="button" onClick={() => router.push('/teacher/classhub/add')} style={{ minHeight: 44, border: 0, borderRadius: 12, padding: '0 16px', background: C.dark, color: '#fff', fontWeight: 900, cursor: 'pointer' }}>Add or join class</button>
        </div>
      )}

      {!loading && !error && classes.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          {classes.map(cls => (
            <section key={cls.id} style={{ width: '100%', padding: 16, border: `1px solid ${C.border}`, borderRadius: 18, background: C.bg, color: C.textPrimary }}>
              <div style={{ fontSize: 17, fontWeight: 900 }}>{cls.name}{cls.stream ? ` ${cls.stream}` : ''}</div>
              <div style={{ marginTop: 5, color: C.textMuted, fontSize: 13 }}>{cls.subjects.length ? cls.subjects.join(', ') : 'Class workspace'} · {counts[cls.id] ?? 0} current students</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                <button type="button" onClick={() => router.push(`/teacher/classhub/${cls.id}`)} style={{ minHeight: 44, border: `1px solid ${C.border}`, borderRadius: 12, background: '#fff', color: C.textPrimary, fontWeight: 900, cursor: 'pointer', font: 'inherit' }}>Open class</button>
                <button type="button" onClick={() => router.push(`/teacher/classhub/${cls.id}/progress`)} style={{ minHeight: 44, border: 0, borderRadius: 12, background: '#111827', color: '#fff', fontWeight: 900, cursor: 'pointer', font: 'inherit' }}>Student progress</button>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

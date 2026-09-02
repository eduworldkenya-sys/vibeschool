'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { C } from '@/components/teacher/ui'

export const dynamic = 'force-dynamic'

type TeacherClassRow = { class_id: string; is_class_teacher: boolean | null }
type ClassRow = { id: string; name: string; stream: string | null; subject: string | null }

export default function ClassHubPage() {
  const router = useRouter()
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError('')
      const { data: auth } = await supabase.auth.getUser(); const user = auth.user
      if (!user) { router.replace('/academy/signin?role=teacher'); return }
      const { data: assignments, error: assignmentError } = await supabase.from('teacher_classes').select('class_id,is_class_teacher').eq('teacher_id', user.id)
      if (assignmentError) { if (!cancelled) { setError('We could not load your classes. Please try again.'); setLoading(false) }; return }
      const classIds = Array.from(new Set(((assignments ?? []) as TeacherClassRow[]).map(row => row.class_id).filter(Boolean)))
      if (!classIds.length) { if (!cancelled) { setClasses([]); setCounts({}); setLoading(false) }; return }
      const [classResult, enrollmentResult] = await Promise.all([supabase.from('classes').select('id,name,stream,subject').in('id', classIds).order('name'), supabase.from('student_classes').select('class_id').in('class_id', classIds).eq('is_current', true)])
      if (classResult.error) { if (!cancelled) { setError('We found your class assignments but could not load the class details.'); setLoading(false) }; return }
      const nextCounts: Record<string, number> = {}; for (const row of enrollmentResult.data ?? []) if (row.class_id) nextCounts[row.class_id] = (nextCounts[row.class_id] ?? 0) + 1
      if (!cancelled) { setClasses((classResult.data ?? []) as ClassRow[]); setCounts(nextCounts); setLoading(false) }
    }
    void load(); return () => { cancelled = true }
  }, [router])

  return <div style={{ padding: '20px 16px 32px', color: C.textPrimary }}>
    <div style={{ marginBottom: 20 }}><p style={{ margin: 0, color: C.textMuted, fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase' }}>Classes</p><h1 style={{ margin: '6px 0 4px', fontSize: 28, fontWeight: 900 }}>My Classes</h1><p style={{ margin: 0, color: C.textMuted, fontSize: 14 }}>Open a class for teaching work, or Progress to see evidence-backed learner progress.</p></div>
    {loading && <div aria-live="polite" style={{ display: 'grid', gap: 12 }}>{[1,2,3].map(i => <div key={i} style={{ height: 104, borderRadius: 18, background: '#f3f4f6' }} />)}</div>}
    {!loading && error && <div role="alert" style={{ padding: 16, border: `1px solid ${C.border}`, borderRadius: 16, background: C.bg }}><strong>Classes unavailable</strong><p style={{ margin: '6px 0 0', color: C.textMuted }}>{error}</p></div>}
    {!loading && !error && !classes.length && <div style={{ padding: '32px 20px', border: `1px solid ${C.border}`, borderRadius: 18, background: C.bg, textAlign: 'center' }}><h2 style={{ margin: 0, fontSize: 18 }}>No classes assigned yet</h2><p style={{ margin: '8px 0 0', color: C.textMuted, lineHeight: 1.5 }}>Your Classes page shows classes assigned to you by the school. Once a class is assigned, it will appear here automatically.</p></div>}
    {!loading && !error && classes.length > 0 && <div style={{ display: 'grid', gap: 12 }}>{classes.map(cls => <section key={cls.id} style={{ padding: 16, border: `1px solid ${C.border}`, borderRadius: 18, background: C.bg }}><div style={{fontSize:17,fontWeight:900}}>{cls.name}{cls.stream ? ` ${cls.stream}` : ''}</div><div style={{marginTop:5,color:C.textMuted,fontSize:13}}>{cls.subject || 'Class workspace'} · {counts[cls.id] ?? 0} students</div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:12}}><button type="button" onClick={() => router.push(`/teacher/classhub/${cls.id}`)} style={{minHeight:42,border:`1px solid ${C.border}`,borderRadius:11,background:'#fff',fontWeight:900,cursor:'pointer'}}>Open class</button><button type="button" onClick={() => router.push(`/teacher/classhub/${cls.id}/progress`)} style={{minHeight:42,border:0,borderRadius:11,background:'#111827',color:'#fff',fontWeight:900,cursor:'pointer'}}>Student progress</button></div></section>)}</div>}
  </div>
}

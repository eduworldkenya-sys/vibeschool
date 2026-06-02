"use client";

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Student {
  id: string
  name: string
  admission_number: string | null
  class_id: string
  profile_id: string | null
}

interface ClassGroup {
  id: string
  name: string
  stream: string | null
  students: Student[]
}

function IcoSearch({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}

function IcoChevRight({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  )
}

function Bone({ w = '100%', h = 14, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r, flexShrink: 0,
      background: 'linear-gradient(90deg,#f5f0eb 25%,#ece7e1 50%,#f5f0eb 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease-in-out infinite',
    }} />
  )
}

export default function StudentsPage() {
  const router = useRouter()
  const [groups,  setGroups]  = useState<ClassGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [query,   setQuery]   = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/academy/signin?role=teacher'); return }

    const uid = user.id

    const { data: tcData } = await supabase
      .from('teacher_classes')
      .select('class_id')
      .eq('teacher_id', uid)
      .eq('is_class_teacher', true)

    const classIds = (tcData ?? []).map((r: any) => r.class_id).filter(Boolean)
    if (classIds.length === 0) { setLoading(false); return }

    const [classRes, studentRes] = await Promise.all([
      supabase.from('classes').select('id, name, stream').in('id', classIds),
      supabase.from('students')
        .select('id, name, admission_number, class_id, profile_id')
        .in('class_id', classIds)
        .order('name', { ascending: true }),
    ])

    const students: Student[] = studentRes.data ?? []
    const classes: { id: string; name: string; stream: string | null }[] = classRes.data ?? []

    const grouped: ClassGroup[] = classes.map(cls => ({
      id:       cls.id,
      name:     cls.name,
      stream:   cls.stream,
      students: students.filter(s => s.class_id === cls.id),
    }))

    setGroups(grouped)
    setLoading(false)
  }

  const q = query.toLowerCase().trim()

  const filtered: ClassGroup[] = groups
    .map(g => ({
      ...g,
      students: q
        ? g.students.filter(s =>
            s.name.toLowerCase().includes(q) ||
            (s.admission_number ?? '').toLowerCase().includes(q)
          )
        : g.students,
    }))
    .filter(g => g.students.length > 0)

  const totalStudents = groups.reduce((a, g) => a + g.students.length, 0)

  return (
    <div style={{ paddingBottom: 32, animation: 'pageIn 0.28s ease' }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes pageIn  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        .student-row:active { background: #f5f0eb !important; }
      `}</style>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', lineHeight: 1.2 }}>Students</div>
        {!loading && (
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>
            {totalStudents} student{totalStudents !== 1 ? 's' : ''} across {groups.length} class{groups.length !== 1 ? 'es' : ''}
          </div>
        )}
      </div>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', display: 'flex' }}>
          <IcoSearch size={16} />
        </div>
        <input
          type="text"
          placeholder="Search by name or admission number"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{
            width: '100%', padding: '12px 14px 12px 40px', borderRadius: 14,
            border: '1px solid #f0ece6', background: '#fff', fontSize: 14,
            color: '#111827', fontFamily: 'inherit', outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2].map(i => (
            <div key={i} style={{ background: '#fff', borderRadius: 20, border: '1px solid #f0ece6', padding: 18 }}>
              <Bone w={120} h={11} r={6} />
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1, 2, 3].map(j => <Bone key={j} h={44} r={12} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && groups.length === 0 && (
        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #f0ece6', padding: '32px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>No classes assigned yet</div>
        </div>
      )}

      {!loading && groups.length > 0 && filtered.length === 0 && (
        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #f0ece6', padding: '32px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>No students match "{query}"</div>
        </div>
      )}

      {!loading && filtered.map((group, gi) => (
        <div key={group.id} style={{ marginBottom: 14, animation: `fadeUp 0.3s ease ${gi * 60}ms both` }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 8, paddingLeft: 2 }}>
            {group.name}{group.stream ? ` · ${group.stream}` : ''} · {group.students.length} student{group.students.length !== 1 ? 's' : ''}
          </div>
          <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #f0ece6', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            {group.students.map((student, si) => (
              <div
                key={student.id}
                className="student-row"
                onClick={() => router.push(`/teacher/classhub/${group.id}/student/${student.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '13px 16px',
                  borderBottom: si < group.students.length - 1 ? '1px solid #f5f0eb' : 'none',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: student.profile_id ? '#d1fae5' : '#f3f4f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800,
                  color: student.profile_id ? '#065f46' : '#6b7280',
                }}>
                  {student.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {student.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                    {student.admission_number ? `Adm · ${student.admission_number}` : 'No admission number'}
                  </div>
                </div>
                {!student.profile_id && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                    background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd',
                    flexShrink: 0,
                  }}>
                    Unclaimed
                  </span>
                )}
                <IcoChevRight size={14} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

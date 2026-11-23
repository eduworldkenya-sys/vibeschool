"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const liveFrom = (table: string) => supabase.from(table)

type Staff = { id: string; full_name: string; role: string }
type Thread = { id: string; context_tag: string | null; last_message_at: string | null; last_message_preview: string | null }

const C = {
  navy: '#0f172a',
  indigo: '#1e1b4b',
  emerald: '#059669',
  border: '#e2e8f0',
  muted: '#64748b',
  surface: '#fff',
  bg: '#f8fafc',
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '?'
}

function timeLabel(value: string | null) {
  if (!value) return ''
  return new Date(value).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

export default function ChildMessagesPage() {
  const params = useParams()
  const router = useRouter()
  const studentId = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : ''

  const [userId, setUserId] = useState('')
  const [studentName, setStudentName] = useState('Learner')
  const [schoolName, setSchoolName] = useState('School')
  const [staff, setStaff] = useState<Staff[]>([])
  const [threads, setThreads] = useState<Thread[]>([])
  const [threadStaff, setThreadStaff] = useState<Record<string, Staff>>({})
  const [contextTag, setContextTag] = useState('question')
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState('')

  const loadThreads = useCallback(async (uid: string) => {
    if (!studentId) return
    const { data: rows, error: threadError } = await liveFrom('vc_threads')
      .select('id, context_tag, last_message_at, last_message_preview')
      .eq('student_id', studentId)
      .eq('type', 'direct')
      .order('last_message_at', { ascending: false, nullsFirst: false })
    if (threadError) throw threadError

    const normalized = (rows ?? []) as Thread[]
    setThreads(normalized)
    if (normalized.length === 0) { setThreadStaff({}); return }

    const ids = normalized.map(row => row.id)
    const { data: participants } = await supabase
      .from('vc_participants')
      .select('thread_id, profile_id')
      .in('thread_id', ids)
      .neq('profile_id', uid)

    const staffIds = Array.from(new Set((participants ?? []).map(row => row.profile_id).filter((value): value is string => Boolean(value))))
    const { data: profiles } = staffIds.length > 0
      ? await supabase.from('profiles').select('id, full_name, role').in('id', staffIds)
      : { data: [] }
    const profileMap = new Map((profiles ?? []).map(profile => [profile.id, { id: profile.id, full_name: profile.full_name, role: profile.role ?? 'staff' }]))
    const next: Record<string, Staff> = {}
    ;(participants ?? []).forEach(participant => {
      if (!participant.thread_id || !participant.profile_id) return
      const profile = profileMap.get(participant.profile_id)
      if (profile) next[participant.thread_id] = profile
    })
    setThreadStaff(next)
  }, [studentId])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        if (!studentId) throw new Error('Learner not found.')
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.replace('/'); return }
        setUserId(user.id)

        const { data: link, error: linkError } = await supabase
          .from('parent_student_links')
          .select('student_id')
          .eq('parent_id', user.id)
          .eq('student_id', studentId)
          .maybeSingle()
        if (linkError) throw linkError
        if (!link) throw new Error('This learner is not linked to your parent account.')

        const { data: student, error: studentError } = await supabase
          .from('students')
          .select('name, class_id')
          .eq('id', studentId)
          .single()
        if (studentError) throw studentError
        setStudentName(student.name)
        if (!student.class_id) throw new Error('Teacher messaging becomes available after the learner joins a class.')

        const { data: cls } = await supabase
          .from('classes')
          .select('school_id, schools(name)')
          .eq('id', student.class_id)
          .single()
        const school = Array.isArray(cls?.schools) ? cls?.schools[0] : cls?.schools
        if (school && typeof school === 'object' && 'name' in school && typeof school.name === 'string') setSchoolName(school.name)

        const { data: assignments, error: assignmentError } = await supabase
          .from('teacher_classes')
          .select('teacher_id')
          .eq('class_id', student.class_id)
        if (assignmentError) throw assignmentError
        const teacherIds = Array.from(new Set((assignments ?? []).map(row => row.teacher_id).filter(Boolean)))
        const { data: teachers } = teacherIds.length > 0
          ? await supabase.from('profiles').select('id, full_name, role').in('id', teacherIds)
          : { data: [] }
        if (!cancelled) setStaff((teachers ?? []).map(teacher => ({ id: teacher.id, full_name: teacher.full_name, role: teacher.role ?? 'teacher' })))
        await loadThreads(user.id)
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load family messaging.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [loadThreads, router, studentId])

  const existingByStaff = useMemo(() => {
    const map = new Map<string, string>()
    Object.entries(threadStaff).forEach(([threadId, member]) => map.set(member.id, threadId))
    return map
  }, [threadStaff])

  async function openStaff(member: Staff) {
    setError('')
    setOpening(true)
    try {
      let threadId = existingByStaff.get(member.id) ?? null
      if (!threadId) {
        const { data, error: rpcError } = await supabase.rpc('parent_start_child_thread', {
          p_student_id: studentId,
          p_staff_id: member.id,
          p_context_tag: contextTag,
        })
        if (rpcError || !data) throw new Error(rpcError?.message || 'Could not open this teacher conversation.')
        threadId = data
        await loadThreads(userId)
      }
      // The child-scoped RPC chooses an authorized teacher and learner.
      // All actual messaging now takes place in the single VibeChat channel.
      router.push('/vibechat?thread=vc:' + encodeURIComponent(threadId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open this conversation.')
    } finally {
      setOpening(false)
    }
  }

  function openExisting(thread: Thread) {
    if (!threadStaff[thread.id]) return
    router.push('/vibechat?thread=vc:' + encodeURIComponent(thread.id))
  }

  return (
    <div>
      <section style={{ background: `linear-gradient(145deg,${C.navy},${C.indigo})`, color: '#fff', borderRadius: 20, padding: 18, marginBottom: 12 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#a7f3d0', letterSpacing: 1, fontWeight: 900 }}>Child-scoped messaging</div>
        <h1 style={{ margin: '5px 0 4px', fontSize: 20 }}>Talk to {studentName}&apos;s teachers</h1>
        <p style={{ margin: 0, color: '#cbd5e1', fontSize: 12 }}>{schoolName} · every conversation stays attached to the correct learner.</p>
      </section>

      {error && <div style={errorBox}>{error}</div>}

      {threads.length > 0 && <section style={card}>
        <div style={eyebrow}>Recent conversations</div>
        <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
          {threads.map(thread => {
            const member = threadStaff[thread.id]
            if (!member) return null
            return <button key={thread.id} onClick={() => void openExisting(thread)} style={contactButton}><span style={avatar}>{initials(member.full_name)}</span><span style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'block', fontSize: 12, fontWeight: 900, color: C.navy }}>{member.full_name}</span><span style={{ display: 'block', fontSize: 10, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{thread.last_message_preview || 'Conversation started'}</span></span><span style={{ fontSize: 9, color: '#94a3b8' }}>{timeLabel(thread.last_message_at)}</span></button>
          })}
        </div>
      </section>}

      <section style={card}>
        <div style={eyebrow}>Start a conversation</div>
        <h2 style={{ margin: '4px 0 6px', fontSize: 17 }}>Teachers assigned to this class</h2>
        <p style={{ margin: '0 0 12px', color: C.muted, fontSize: 11 }}>Parents cannot search arbitrary staff. Only teachers assigned to {studentName}&apos;s class are available here.</p>

        <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto' }}>
          {[['question', 'Question'], ['general', 'General'], ['urgent', 'Urgent']].map(([value, label]) => <button key={value} onClick={() => setContextTag(value)} style={{ border: `1px solid ${contextTag === value ? C.emerald : C.border}`, background: contextTag === value ? '#ecfdf5' : '#fff', color: contextTag === value ? '#065f46' : C.muted, borderRadius: 999, padding: '6px 10px', fontSize: 10, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>)}
        </div>

        {staff.length === 0 ? <div style={{ padding: 14, background: C.bg, borderRadius: 12, color: C.muted, fontSize: 12 }}>No teacher assignment is available for this class yet.</div> : <div style={{ display: 'grid', gap: 8 }}>
          {staff.map(member => <button key={member.id} disabled={opening} onClick={() => void openStaff(member)} style={contactButton}><span style={avatar}>{initials(member.full_name)}</span><span style={{ flex: 1, textAlign: 'left' }}><span style={{ display: 'block', fontSize: 12, fontWeight: 900, color: C.navy }}>{member.full_name}</span><span style={{ display: 'block', fontSize: 10, color: C.muted, textTransform: 'capitalize' }}>{member.role}{existingByStaff.has(member.id) ? ' · existing conversation' : ''}</span></span><span style={{ color: C.emerald, fontWeight: 900 }}>›</span></button>)}
        </div>}
      </section>

      <button onClick={() => router.push(`/parent/child/${studentId}`)} style={secondaryButton}>Back to {studentName}</button>
    </div>
  )
}

const card: React.CSSProperties = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 15, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 9, fontWeight: 900, color: C.emerald, textTransform: 'uppercase', letterSpacing: 1 }
const avatar: React.CSSProperties = { width: 36, height: 36, borderRadius: 12, background: '#ede9fe', color: C.indigo, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 12, flexShrink: 0 }
const contactButton: React.CSSProperties = { width: '100%', border: `1px solid ${C.border}`, background: '#fff', borderRadius: 12, padding: 10, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }
const secondaryButton: React.CSSProperties = { width: '100%', border: `1px solid ${C.border}`, borderRadius: 12, background: '#fff', padding: 12, color: C.navy, fontFamily: 'inherit', fontWeight: 800, cursor: 'pointer' }
const errorBox: React.CSSProperties = { border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', borderRadius: 12, padding: 11, marginBottom: 10, fontSize: 12 }

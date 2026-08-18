"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

type Staff = { id: string; full_name: string; role: string }
type Thread = { id: string; context_tag: string | null; last_message_at: string | null; last_message_preview: string | null }
type Message = { id: string; sender_id: string; body: string; created_at: string }

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
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [activeStaff, setActiveStaff] = useState<Staff | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messageBody, setMessageBody] = useState('')
  const [contextTag, setContextTag] = useState('question')
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(async (threadId: string) => {
    const { data, error: messageError } = await supabase
      .from('vc_messages')
      .select('id, sender_id, body, created_at')
      .eq('thread_id', threadId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    if (messageError) throw messageError
    setMessages((data ?? []).filter(row => row.sender_id && row.created_at).map(row => ({
      id: row.id,
      sender_id: row.sender_id as string,
      body: row.body,
      created_at: row.created_at as string,
    })))
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [])

  const loadThreads = useCallback(async (uid: string) => {
    if (!studentId) return
    const { data: rows, error: threadError } = await supabase
      .from('vc_threads')
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
        const { data, error: rpcError } = await rpc<string>('parent_start_child_thread', {
          p_student_id: studentId,
          p_staff_id: member.id,
          p_context_tag: contextTag,
        })
        if (rpcError || !data) throw new Error(rpcError?.message || 'Could not open this teacher conversation.')
        threadId = data
        await loadThreads(userId)
      }
      setActiveStaff(member)
      setActiveThreadId(threadId)
      await loadMessages(threadId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open this conversation.')
    } finally {
      setOpening(false)
    }
  }

  async function openExisting(thread: Thread) {
    const member = threadStaff[thread.id]
    if (!member) return
    setActiveStaff(member)
    setActiveThreadId(thread.id)
    await loadMessages(thread.id)
    await supabase.from('vc_participants').update({ last_read_at: new Date().toISOString() }).eq('thread_id', thread.id).eq('profile_id', userId)
  }

  async function sendMessage() {
    if (!activeThreadId || !messageBody.trim()) return
    setSending(true)
    setError('')
    const body = messageBody.trim()
    try {
      const { error: insertError } = await supabase.from('vc_messages').insert({
        thread_id: activeThreadId,
        sender_id: userId,
        body,
      })
      if (insertError) throw insertError
      await supabase.from('vc_threads').update({
        last_message_at: new Date().toISOString(),
        last_message_preview: body.slice(0, 80),
      }).eq('id', activeThreadId)
      setMessageBody('')
      await loadMessages(activeThreadId)
      await loadThreads(userId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Message could not be sent.')
    } finally {
      setSending(false)
    }
  }

  if (loading) return <section style={card}>Loading child messaging…</section>

  if (error && !userId) return <section style={{ ...card, color: '#b91c1c' }}>{error}</section>

  if (activeThreadId && activeStaff) return (
    <div style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <button onClick={() => { setActiveThreadId(null); setActiveStaff(null); setMessages([]) }} style={backButton}>‹</button>
        <div style={avatar}>{initials(activeStaff.full_name)}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, color: C.navy }}>{activeStaff.full_name}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{studentName} · {activeStaff.role}</div>
        </div>
      </div>

      {error && <div style={errorBox}>{error}</div>}
      <div style={{ ...card, flex: 1, minHeight: 360, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
        {messages.length === 0 ? <div style={{ margin: 'auto', textAlign: 'center', color: C.muted, fontSize: 13 }}>No messages yet. This conversation is securely linked to {studentName}.</div> : messages.map(message => {
          const mine = message.sender_id === userId
          return <div key={message.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}><div style={{ maxWidth: '78%', borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px', padding: '9px 12px', background: mine ? C.emerald : '#f1f5f9', color: mine ? '#fff' : C.navy, fontSize: 13, lineHeight: 1.45 }}><div>{message.body}</div><div style={{ fontSize: 9, opacity: 0.65, marginTop: 4, textAlign: 'right' }}>{timeLabel(message.created_at)}</div></div></div>
        })}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <textarea value={messageBody} onChange={event => setMessageBody(event.target.value)} placeholder={`Message ${activeStaff.full_name} about ${studentName}`} rows={2} style={composer} />
        <button disabled={sending || !messageBody.trim()} onClick={sendMessage} style={{ ...sendButton, opacity: sending || !messageBody.trim() ? 0.5 : 1 }}>{sending ? '…' : 'Send'}</button>
      </div>
    </div>
  )

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
const backButton: React.CSSProperties = { width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.border}`, background: '#fff', fontSize: 22, cursor: 'pointer' }
const composer: React.CSSProperties = { flex: 1, border: `1px solid ${C.border}`, borderRadius: 13, padding: '10px 12px', resize: 'none', fontFamily: 'inherit', fontSize: 13, outline: 'none' }
const sendButton: React.CSSProperties = { border: 'none', borderRadius: 13, background: C.emerald, color: '#fff', padding: '0 16px', fontFamily: 'inherit', fontWeight: 900, cursor: 'pointer' }
const secondaryButton: React.CSSProperties = { width: '100%', border: `1px solid ${C.border}`, borderRadius: 12, background: '#fff', padding: 12, color: C.navy, fontFamily: 'inherit', fontWeight: 800, cursor: 'pointer' }
const errorBox: React.CSSProperties = { border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', borderRadius: 12, padding: 11, marginBottom: 10, fontSize: 12 }

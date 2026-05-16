'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, Btn, C } from '@/components/teacher/ui'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MessageThread {
  id: string
  studentId: string
  studentName: string
  subject: string
  body: string
  channel: string
  sentAt: string
}

interface StudentOption {
  id: string
  name: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days  = Math.floor(hours / 24)
  if (mins  <  1) return 'Just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const PALETTES = [
  { bg: '#dbeafe', color: '#1d4ed8' },
  { bg: '#ede9fe', color: '#6d28d9' },
  { bg: '#fef3c7', color: '#92400e' },
  { bg: '#fce7f3', color: '#9d174d' },
  { bg: C.accentLight, color: '#065f46' },
]

function Avatar({ name, idx }: { name: string; idx: number }) {
  const p = PALETTES[idx % PALETTES.length]
  return (
    <div style={{
      width: 42, height: 42, borderRadius: '50%',
      background: p.bg, color: p.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 700, flexShrink: 0,
    }}>
      {initials(name)}
    </div>
  )
}

function Skeleton({ h = 56 }: { h?: number }) {
  return (
    <div style={{
      height: h, borderRadius: 12,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

// ─── Compose modal ────────────────────────────────────────────────────────────

function ComposeModal({
  students,
  teacherId,
  schoolId,
  onClose,
  onSent,
}: {
  students: StudentOption[]
  teacherId: string
  schoolId: string
  onClose: () => void
  onSent: () => void
}) {
  const [studentId, setStudentId] = useState(students[0]?.id ?? '')
  const [subject, setSubject]     = useState('')
  const [body, setBody]           = useState('')
  const [sending, setSending]     = useState(false)
  const [err, setErr]             = useState<string | null>(null)

  async function send() {
    if (!subject.trim() || !body.trim() || !studentId) {
      setErr('Please fill in all fields.')
      return
    }
    setSending(true)
    setErr(null)

    const { error } = await supabase
      .from('parent_messages')
      .insert({
        school_id:    schoolId,
        teacher_id:   teacherId,
        student_id:   studentId,
        channel:      'app',
        subject:      subject.trim(),
        body:         body.trim(),
        generated_by: 'teacher',
        sent_at:      new Date().toISOString(),
      })

    if (error) { setErr(error.message); setSending(false); return }
    onSent()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div style={{
        background: C.bg, borderRadius: '20px 20px 0 0',
        padding: '24px 20px 36px', width: '100%', maxWidth: 480,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary }}>New Message</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.textMuted }}>✕</button>
        </div>

        {err && (
          <div style={{ fontSize: 12, color: C.error, background: '#fef2f2', padding: '8px 12px', borderRadius: 8 }}>
            {err}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Student</label>
          <select
            value={studentId}
            onChange={e => setStudentId(e.target.value)}
            style={{ padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', background: C.bg, color: C.textPrimary }}
          >
            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Subject</label>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Message subject..."
            style={{ padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Message</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Type your message..."
            rows={4}
            style={{ padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'none' }}
          />
        </div>

        <Btn onClick={send} disabled={sending}>
          {sending ? 'Sending…' : 'Send Message'}
        </Btn>
      </div>
    </div>
  )
}

// ─── Detail view ──────────────────────────────────────────────────────────────

function MessageDetail({
  msg,
  onBack,
}: {
  msg: MessageThread
  onBack: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: `1px solid ${C.border}` }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.textMuted, lineHeight: 1 }}
        >
          ←
        </button>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{msg.studentName}</div>
          <div style={{ fontSize: 11, color: C.textMuted }}>{timeAgo(msg.sentAt)}</div>
        </div>
      </div>

      <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary }}>{msg.subject}</div>

        <div style={{
          background: C.surface, borderRadius: 14,
          padding: '14px 16px', fontSize: 13, color: C.textPrimary, lineHeight: 1.7,
        }}>
          {msg.body}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{
            fontSize: 11, fontWeight: 600, padding: '4px 12px',
            borderRadius: 20, background: C.accentLight, color: C.accent,
          }}>
            via {msg.channel}
          </div>
          <div style={{
            fontSize: 11, fontWeight: 600, padding: '4px 12px',
            borderRadius: 20, background: C.surface, color: C.textMuted, border: `1px solid ${C.border}`,
          }}>
            Sent {new Date(msg.sentAt).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VibeConnectPage() {
  const [messages, setMessages]       = useState<MessageThread[]>([])
  const [students, setStudents]       = useState<StudentOption[]>([])
  const [teacherId, setTeacherId]     = useState<string | null>(null)
  const [schoolId, setSchoolId]       = useState<string | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [activeMsg, setActiveMsg]     = useState<MessageThread | null>(null)
  const [composing, setComposing]     = useState(false)
  const [filter, setFilter]           = useState<'all' | 'app' | 'sms' | 'email'>('all')

  async function load(uid: string, sid: string) {
    setLoading(true)
    setError(null)

    const [msgsRes, tcRes] = await Promise.all([
      supabase
        .from('parent_messages')
        .select('id, student_id, subject, body, channel, sent_at')
        .eq('teacher_id', uid)
        .eq('school_id', sid)
        .order('sent_at', { ascending: false }),
      supabase
        .from('teacher_classes')
        .select('class_id')
        .eq('teacher_id', uid),
    ])

    if (msgsRes.error) { setError(msgsRes.error.message); setLoading(false); return }
    if (tcRes.error)   { setError(tcRes.error.message);   setLoading(false); return }

    const classIds   = Array.from(new Set((tcRes.data ?? []).map((r: { class_id: string }) => r.class_id)))
    const studentIds = Array.from(new Set((msgsRes.data ?? []).map((r: { student_id: string }) => r.student_id)))

    // Fetch student names — union of message recipients and class students
    const allStudentIds = Array.from(new Set([...studentIds]))

    const [msgStudentsRes, classStudentsRes] = await Promise.all([
      allStudentIds.length > 0
        ? supabase.from('students').select('id, name').in('id', allStudentIds)
        : Promise.resolve({ data: [], error: null }),
      classIds.length > 0
        ? supabase.from('student_classes').select('student_id').in('class_id', classIds).eq('is_current', true)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (msgStudentsRes.error)   { setError(msgStudentsRes.error.message);   setLoading(false); return }
    if (classStudentsRes.error) { setError(classStudentsRes.error.message); setLoading(false); return }

    // Get names for all students in teacher's classes (for compose dropdown)
    const classStudentIds = Array.from(new Set(
      (classStudentsRes.data ?? []).map((r: { student_id: string }) => r.student_id)
    ))

    const { data: allStudentData } = classStudentIds.length > 0
      ? await supabase.from('students').select('id, name').in('id', classStudentIds)
      : { data: [] }

    const nameMap = new Map<string, string>(
      [...(msgStudentsRes.data ?? []), ...(allStudentData ?? [])]
        .map((s: { id: string; name: string }) => [s.id, s.name])
    )

    const threads: MessageThread[] = (msgsRes.data ?? []).map((m: {
      id: string; student_id: string; subject: string;
      body: string; channel: string; sent_at: string
    }) => ({
      id:          m.id,
      studentId:   m.student_id,
      studentName: nameMap.get(m.student_id) ?? 'Unknown',
      subject:     m.subject,
      body:        m.body,
      channel:     m.channel,
      sentAt:      m.sent_at,
    }))

    const composeStudents: StudentOption[] = (allStudentData ?? []).map(
      (s: { id: string; name: string }) => ({ id: s.id, name: s.name })
    )

    setMessages(threads)
    setStudents(composeStudents)
    setLoading(false)
  }

  useEffect(() => {
    async function boot() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not signed in.'); setLoading(false); return }

      setTeacherId(user.id)

      const { data: memberData, error: memberErr } = await supabase
        .from('school_members')
        .select('school_id')
        .eq('profile_id', user.id)
        .maybeSingle()

      if (memberErr) { setError(memberErr.message); setLoading(false); return }

      const sid = memberData?.school_id ?? null
      setSchoolId(sid)

      if (sid) await load(user.id, sid)
      else setLoading(false)
    }

    boot()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const FILTERS: Array<'all' | 'app' | 'sms' | 'email'> = ['all', 'app', 'sms', 'email']

  const filtered = filter === 'all'
    ? messages
    : messages.filter(m => m.channel === filter)

  // ─── Detail view ────────────────────────────────────────────────────────────
  if (activeMsg) {
    return (
      <>
        <div style={{ padding: '16px 16px 32px' }}>
          <MessageDetail msg={activeMsg} onBack={() => setActiveMsg(null)} />
        </div>
      </>
    )
  }

  // ─── List view ──────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position:  200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>

      {composing && teacherId && schoolId && (
        <ComposeModal
          students={students}
          teacherId={teacherId}
          schoolId={schoolId}
          onClose={() => setComposing(false)}
          onSent={() => {
            setComposing(false)
            if (teacherId && schoolId) load(teacherId, schoolId)
          }}
        />
      )}

      <div style={{ padding: '16px 16px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0f766e 0%, #10b981 100%)',
          borderRadius: 20, padding: '20px', color: '#fff',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
            VibeConnect
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>Messages & Threads</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
            Teachers · Parents · Admin. Scoped to your school.
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: '12px 14px', borderRadius: 10, background: '#fef2f2', color: C.error, fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Filter tabs + compose */}
        {!loading && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 8, flex: 1, flexWrap: 'wrap' }}>
              {FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '6px 14px', borderRadius: 20, border: 'none',
                    cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                    background: filter === f ? C.accent : C.surface,
                    color:      filter === f ? '#fff'    : C.textMuted,
                  }}
                >
                  {f === 'all' ? 'All' : f.toUpperCase()}
                </button>
              ))}
            </div>
            <Btn small onClick={() => setComposing(true)}>+ New</Btn>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4].map(i => <Skeleton key={i} h={72} />)}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <Card>
            <div style={{ textAlign: 'center', padding: '32px 0', color: C.textMuted, fontSize: 13 }}>
              {filter === 'all'
                ? "No messages sent yet. Tap + New to send your first message."
                : `No ${filter.toUpperCase()} messages found.`}
            </div>
          </Card>
        )}

        {/* Message list */}
        {!loading && !error && filtered.length > 0 && (
          <Card>
            {filtered.map((m, idx) => (
              <div
                key={m.id}
                onClick={() => setActiveMsg(m)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 0', cursor: 'pointer',
                  borderBottom: idx < filtered.length - 1 ? `1px solid ${C.border}` : 'none',
                }}
              >
                <Avatar name={m.studentName} idx={idx} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>
                      {m.studentName}
                    </span>
                    <span style={{ fontSize: 11, color: C.textMuted, flexShrink: 0 }}>
                      {timeAgo(m.sentAt)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: C.textPrimary,
                    marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {m.subject}
                  </div>
                  <div style={{
                    fontSize: 12, color: C.textMuted, marginTop: 2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {m.body}
                  </div>
                  <div style={{
                    display: 'inline-block', marginTop: 4,
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    padding: '2px 8px', borderRadius: 10,
                    background: C.accentLight, color: C.accent,
                  }}>
                    {m.channel}
                  </div>
                </div>
              </div>
            ))}
          </Card>
        )}

      </div>
    </>
  )
}
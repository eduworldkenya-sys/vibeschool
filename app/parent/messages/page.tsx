"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Child = { id: string; name: string; className: string; schoolName: string }
type Notice = {
  recipientId: string
  circularId: string
  title: string
  body: string
  audienceType: string
  requiresAck: boolean
  ackDeadline: string | null
  sentAt: string
  acked: boolean
}

const C = { navy: '#0f172a', indigo: '#1e1b4b', emerald: '#059669', border: '#e2e8f0', muted: '#64748b', bg: '#f8fafc' }

function timeLabel(value: string) {
  return new Date(value).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

export default function ParentMessagesPage() {
  const router = useRouter()
  const [children, setChildren] = useState<Child[]>([])
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [acking, setAcking] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.replace('/'); return }

        const [{ data: links, error: linkError }, { data: recipientRows, error: recipientError }] = await Promise.all([
          supabase.from('parent_student_links').select('student_id').eq('parent_id', user.id),
          supabase.from('vc_circular_recipients').select('id, circular_id, ack_at').eq('profile_id', user.id),
        ])
        if (linkError) throw linkError
        if (recipientError) throw recipientError

        const studentIds = Array.from(new Set((links ?? []).map(row => row.student_id).filter(Boolean)))
        if (studentIds.length > 0) {
          const { data: students, error: studentError } = await supabase
            .from('students')
            .select('id, name, class_id')
            .in('id', studentIds)
          if (studentError) throw studentError

          const classIds = Array.from(new Set((students ?? []).map(row => row.class_id).filter((value): value is string => Boolean(value))))
          const { data: classes } = classIds.length > 0
            ? await supabase.from('classes').select('id, name, stream, school_id').in('id', classIds)
            : { data: [] }
          const schoolIds = Array.from(new Set((classes ?? []).map(row => row.school_id).filter((value): value is string => Boolean(value))))
          const { data: schools } = schoolIds.length > 0
            ? await supabase.from('schools').select('id, name').in('id', schoolIds)
            : { data: [] }

          if (!cancelled) setChildren((students ?? []).map(student => {
            const cls = (classes ?? []).find(row => row.id === student.class_id)
            const school = (schools ?? []).find(row => row.id === cls?.school_id)
            return {
              id: student.id,
              name: student.name,
              className: cls ? `${cls.name}${cls.stream ? ` ${cls.stream}` : ''}` : 'Class pending',
              schoolName: school?.name ?? 'School pending',
            }
          }))
        }

        const circularIds = Array.from(new Set((recipientRows ?? []).map(row => row.circular_id).filter((value): value is string => Boolean(value))))
        if (circularIds.length > 0) {
          const { data: circulars, error: circularError } = await supabase
            .from('vc_circulars')
            .select('id, title, body, audience_type, requires_ack, ack_deadline, sent_at')
            .in('id', circularIds)
            .not('sent_at', 'is', null)
            .order('sent_at', { ascending: false })
          if (circularError) throw circularError

          const recipientByCircular = new Map((recipientRows ?? []).map(row => [row.circular_id, row]))
          const normalized: Notice[] = (circulars ?? []).filter(row => row.sent_at).map(row => {
            const recipient = recipientByCircular.get(row.id)
            return {
              recipientId: recipient?.id ?? '',
              circularId: row.id,
              title: row.title,
              body: row.body,
              audienceType: row.audience_type,
              requiresAck: Boolean(row.requires_ack),
              ackDeadline: row.ack_deadline,
              sentAt: row.sent_at as string,
              acked: Boolean(recipient?.ack_at),
            }
          })
          if (!cancelled) setNotices(normalized)
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Family communications could not be loaded.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [router])

  const outstandingAck = useMemo(() => notices.filter(notice => notice.requiresAck && !notice.acked).length, [notices])

  async function acknowledge(notice: Notice) {
    if (!notice.recipientId || notice.acked) return
    setAcking(notice.recipientId)
    setError('')
    const now = new Date().toISOString()
    const { error: ackError } = await supabase
      .from('vc_circular_recipients')
      .update({ ack_at: now })
      .eq('id', notice.recipientId)
    setAcking(null)
    if (ackError) { setError(ackError.message); return }
    setNotices(current => current.map(row => row.recipientId === notice.recipientId ? { ...row, acked: true } : row))
  }

  if (loading) return <section style={card}>Loading family communications…</section>

  return (
    <div>
      <section style={{ background: `linear-gradient(145deg,${C.navy},${C.indigo})`, color: '#fff', borderRadius: 20, padding: 18, marginBottom: 12 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#a7f3d0', letterSpacing: 1, fontWeight: 900 }}>Family communications</div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'end' }}>
          <div>
            <h1 style={{ margin: '5px 0 3px', fontSize: 21 }}>Teachers & school notices</h1>
            <p style={{ margin: 0, color: '#cbd5e1', fontSize: 12 }}>Teacher conversations are always tied to the correct child. School notices remain auditable and can require acknowledgement.</p>
          </div>
          <div style={{ minWidth: 52, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.08)', borderRadius: 12, padding: 8, textAlign: 'center' }}>
            <div style={{ fontWeight: 900, fontSize: 17 }}>{outstandingAck}</div>
            <div style={{ color: '#cbd5e1', fontSize: 8 }}>to acknowledge</div>
          </div>
        </div>
      </section>

      {error && <div style={errorBox}>{error}</div>}

      <section style={card}>
        <div style={eyebrow}>Teacher conversations</div>
        <h2 style={title}>Choose the child first</h2>
        <p style={{ ...muted, marginBottom: 11 }}>This prevents a conversation about one learner from being mistaken for another. Only teachers assigned to that learner&apos;s class can be contacted.</p>
        {children.length === 0 ? <div style={empty}>No linked learner with a school record is available yet.</div> : <div style={{ display: 'grid', gap: 8 }}>
          {children.map(child => <button key={child.id} onClick={() => router.push(`/parent/child/${child.id}/messages`)} style={childButton}>
            <span style={avatar}>{child.name.slice(0, 1).toUpperCase()}</span>
            <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <span style={{ display: 'block', fontSize: 12, color: C.navy, fontWeight: 900 }}>{child.name}</span>
              <span style={{ display: 'block', fontSize: 10, color: C.muted, marginTop: 2 }}>{child.className} · {child.schoolName}</span>
            </span>
            <span style={{ color: C.emerald, fontSize: 18, fontWeight: 900 }}>›</span>
          </button>)}
        </div>}
      </section>

      <section style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div><div style={eyebrow}>School notices</div><h2 style={title}>Circulars & announcements</h2></div>
          <button onClick={() => router.push('/parent/inbox')} style={smallButton}>Event inbox</button>
        </div>
        {notices.length === 0 ? <div style={empty}>No school notice has been delivered to this parent account yet.</div> : <div style={{ display: 'grid', gap: 9 }}>
          {notices.map(notice => <article key={notice.circularId} style={{ border: `1px solid ${notice.requiresAck && !notice.acked ? '#fde68a' : C.border}`, background: notice.requiresAck && !notice.acked ? '#fffbeb' : '#fff', borderRadius: 13, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 12, color: C.navy }}>{notice.title}</strong>
                  {notice.requiresAck && <span style={{ borderRadius: 999, padding: '2px 6px', background: notice.acked ? '#dcfce7' : '#fef3c7', color: notice.acked ? '#166534' : '#92400e', fontSize: 8, fontWeight: 900 }}>{notice.acked ? 'ACKNOWLEDGED' : 'ACK REQUIRED'}</span>}
                </div>
                <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 3 }}>{timeLabel(notice.sentAt)} · {notice.audienceType}</div>
              </div>
            </div>
            <p style={{ margin: '9px 0 0', color: '#475569', fontSize: 11, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{notice.body}</p>
            {notice.ackDeadline && notice.requiresAck && !notice.acked && <div style={{ marginTop: 8, color: '#92400e', fontSize: 9, fontWeight: 800 }}>Acknowledge by {timeLabel(notice.ackDeadline)}</div>}
            {notice.requiresAck && !notice.acked && <button disabled={acking === notice.recipientId} onClick={() => void acknowledge(notice)} style={{ ...primaryButton, marginTop: 10 }}>{acking === notice.recipientId ? 'Saving…' : 'Acknowledge notice'}</button>}
          </article>)}
        </div>}
      </section>

      <section style={card}>
        <div style={eyebrow}>How communication works</div>
        <h2 style={title}>Two channels, two purposes</h2>
        <div style={{ display: 'grid', gap: 7 }}>
          <Info title="Family Inbox" detail="Automatic system events: attendance exceptions, homework, report publication, teacher updates and finance events." />
          <Info title="Teacher conversations" detail="Human two-way messages tied to a specific learner and an authorised teacher." />
          <Info title="School notices" detail="Official announcements and circulars, with acknowledgement evidence where required." />
        </div>
      </section>
    </div>
  )
}

function Info({ title: infoTitle, detail }: { title: string; detail: string }) {
  return <div style={{ border: `1px solid ${C.border}`, background: C.bg, borderRadius: 11, padding: 10 }}><div style={{ fontSize: 11, fontWeight: 900, color: C.navy }}>{infoTitle}</div><div style={{ fontSize: 10, color: C.muted, lineHeight: 1.45, marginTop: 3 }}>{detail}</div></div>
}

const card: React.CSSProperties = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 16, padding: 15, marginBottom: 12 }
const title: React.CSSProperties = { margin: '4px 0 8px', fontSize: 16, color: C.navy }
const eyebrow: React.CSSProperties = { fontSize: 9, fontWeight: 900, color: C.emerald, textTransform: 'uppercase', letterSpacing: 1 }
const muted: React.CSSProperties = { margin: 0, color: C.muted, fontSize: 10, lineHeight: 1.45 }
const empty: React.CSSProperties = { border: `1px dashed ${C.border}`, background: C.bg, borderRadius: 11, padding: 13, color: C.muted, fontSize: 11 }
const avatar: React.CSSProperties = { width: 38, height: 38, borderRadius: 12, background: '#ede9fe', color: C.indigo, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, flexShrink: 0 }
const childButton: React.CSSProperties = { width: '100%', display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${C.border}`, background: '#fff', borderRadius: 12, padding: 10, cursor: 'pointer', fontFamily: 'inherit' }
const primaryButton: React.CSSProperties = { width: '100%', border: 'none', borderRadius: 10, background: C.emerald, color: '#fff', padding: 9, fontSize: 10, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' }
const smallButton: React.CSSProperties = { border: `1px solid ${C.border}`, borderRadius: 9, background: '#fff', color: C.emerald, padding: '6px 8px', fontSize: 9, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' }
const errorBox: React.CSSProperties = { border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', borderRadius: 12, padding: 11, marginBottom: 10, fontSize: 11 }

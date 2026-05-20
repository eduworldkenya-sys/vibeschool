'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { VCThread, VCMessage, VCCircular, VCCircularRecipient } from '@/lib/types'

const C = {
  hero:      '#0a1628',
  heroMid:   '#0d2347',
  emerald:   '#10b981',
  emeraldLt: '#d1fae5',
  bg:        '#f0f4f8',
  border:    '#e2e8f0',
  surface:   '#ffffff',
  text:      '#0f172a',
  muted:     '#64748b',
  warning:   '#f59e0b',
  warningLt: '#fef3c7',
  error:     '#ef4444',
  errorLt:   '#fee2e2',
  navy3:     '#0f5fa8',
}

function Skeleton({ h = 56, r = 12 }: { h?: number; r?: number }) {
  return (
    <div style={{
      height: h, borderRadius: r,
      background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

function VCIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="10" fill="#0a1628"/>
      <path d="M6 8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H10l-4 4V8z" fill="#10b981" opacity="0.15"/>
      <path d="M6 8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H10l-4 4V8z" stroke="#10b981" strokeWidth="1.5" fill="none"/>
      <text x="16" y="17" textAnchor="middle" fontSize="10" fill="#10b981" fontWeight="bold">✦</text>
    </svg>
  )
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

async function ensureVCId(userId: string, fullName: string) {
  const { data } = await supabase.from('profiles').select('vc_id').eq('id', userId).single()
  if (data?.vc_id) return data.vc_id
  const slug = fullName.toLowerCase().split(' ')[0].replace(/[^a-z]/g, '').slice(0, 8)
  const suffix = Math.floor(1000 + Math.random() * 9000)
  const vcId = `@${slug}.${suffix}`
  await supabase.from('profiles').update({ vc_id: vcId }).eq('id', userId)
  return vcId
}

async function findOrCreateThread(schoolId: string, currentUserId: string, otherUserId: string): Promise<string> {
  const { data: myThreads } = await supabase.from('vc_participants').select('thread_id').eq('profile_id', currentUserId)
  const myThreadIds = (myThreads ?? []).map((t: { thread_id: string }) => t.thread_id)
  if (myThreadIds.length > 0) {
    const { data: shared } = await supabase.from('vc_participants').select('thread_id').eq('profile_id', otherUserId).in('thread_id', myThreadIds)
    if (shared && shared.length > 0) return shared[0].thread_id
  }
  const { data: thread } = await supabase.from('vc_threads').insert({ school_id: schoolId, type: 'direct', created_by: currentUserId }).select().single()
  await supabase.from('vc_participants').insert([
    { thread_id: thread.id, profile_id: currentUserId, school_id: schoolId },
    { thread_id: thread.id, profile_id: otherUserId,   school_id: schoolId },
  ])
  return thread.id
}

interface ThreadUI {
  threadId:      string
  otherName:     string
  otherInitials: string
  lastMessage:   string
  lastTime:      string
  unreadCount:   number
  otherRole:     string
  otherId:       string
}

interface CircularUI extends VCCircular {
  ackCount:   number
  totalCount: number
  recipients: VCCircularRecipient[]
}

interface ProfileRow {
  id:        string
  full_name: string
  role:      string
}

export default function AdminCommunicationPage() {
  const router = useRouter()

  const [userId,   setUserId]   = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [myName,   setMyName]   = useState('')
  const [loading,  setLoading]  = useState(true)

  const [tab, setTab] = useState<'threads' | 'circulars'>('threads')

  // Threads
  const [threads,      setThreads]      = useState<ThreadUI[]>([])
  const [activeThread, setActiveThread] = useState<ThreadUI | null>(null)
  const [messages,     setMessages]     = useState<VCMessage[]>([])
  const [msgBody,      setMsgBody]      = useState('')
  const [sending,      setSending]      = useState(false)
  const [msgLoading,   setMsgLoading]   = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Compose
  const [composeOpen,  setComposeOpen]  = useState(false)
  const [searchQuery,  setSearchQuery]  = useState('')
  const [searchResults,setSearchResults]= useState<ProfileRow[]>([])
  const [searching,    setSearching]    = useState(false)

  // Circulars
  const [circulars,       setCirculars]       = useState<CircularUI[]>([])
  const [circularLoading, setCircularLoading] = useState(false)
  const [activeCircular,  setActiveCircular]  = useState<CircularUI | null>(null)
  const [newCircSheet,    setNewCircSheet]    = useState(false)
  const [circTitle,       setCircTitle]       = useState('')
  const [circBody,        setCircBody]        = useState('')
  const [circAudience,    setCircAudience]    = useState<'all_staff' | 'all_parents' | 'everyone'>('everyone')
  const [circAck,         setCircAck]         = useState(true)
  const [circDeadline,    setCircDeadline]    = useState('')
  const [circSending,     setCircSending]     = useState(false)

  useEffect(() => {
    loadUser()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  async function loadUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/admin/login'); return }
      const { data: p } = await supabase.from('profiles').select('full_name, school_id, role').eq('id', user.id).single()
      if (!p || p.role !== 'admin') { router.push('/admin/login'); return }
      setUserId(user.id)
      setSchoolId(p.school_id)
      setMyName(p.full_name ?? 'Admin')
      await ensureVCId(user.id, p.full_name ?? 'Admin')
      await loadAll(user.id, p.school_id)
    } catch {
      router.push('/admin/login')
    } finally {
      setLoading(false)
    }
  }

  async function loadAll(uid: string, sid: string) {
    const [{ data: parts }, { data: circs }] = await Promise.all([
      supabase.from('vc_participants').select('thread_id, last_read_at').eq('profile_id', uid),
      supabase.from('vc_circulars').select('*').eq('school_id', sid).order('sent_at', { ascending: false }),
    ])

    const threadIds = (parts ?? []).map((p: { thread_id: string }) => p.thread_id)

    if (threadIds.length > 0) {
      const [{ data: threadRows }, { data: allParts }] = await Promise.all([
        supabase.from('vc_threads').select('*').in('id', threadIds).order('last_message_at', { ascending: false }),
        supabase.from('vc_participants').select('thread_id, profile_id').in('thread_id', threadIds),
      ])

      const otherIds = (allParts ?? [])
        .filter((p: { profile_id: string }) => p.profile_id !== uid)
        .map((p: { profile_id: string }) => p.profile_id)

      const { data: profiles } = otherIds.length > 0
        ? await supabase.from('profiles').select('id, full_name, role').in('id', otherIds)
        : { data: [] }

      const profileMap: Record<string, ProfileRow> = {}
      ;(profiles ?? []).forEach((pr: ProfileRow) => { profileMap[pr.id] = pr })

      const readMap: Record<string, string | null> = {}
      ;(parts ?? []).forEach((p: { thread_id: string; last_read_at: string | null }) => { readMap[p.thread_id] = p.last_read_at })

      const ui: ThreadUI[] = (threadRows ?? []).map((t: VCThread) => {
        const otherPart = (allParts ?? []).find(
          (p: { thread_id: string; profile_id: string }) => p.thread_id === t.id && p.profile_id !== uid
        )
        const other = otherPart ? profileMap[otherPart.profile_id] : null
        const lastRead = readMap[t.id]
        const unread = (!lastRead && t.last_message_at) ? 1 : 0
        return {
          threadId:      t.id,
          otherName:     other?.full_name ?? 'Unknown',
          otherInitials: initials(other?.full_name ?? '?'),
          lastMessage:   t.last_message_preview ?? '',
          lastTime:      t.last_message_at ? timeAgo(t.last_message_at) : '',
          unreadCount:   unread,
          otherRole:     other?.role ?? '',
          otherId:       otherPart?.profile_id ?? '',
        }
      })
      setThreads(ui)
    }

    // Circulars with ack counts
    if ((circs ?? []).length > 0) {
      const circIds = (circs ?? []).map((c: VCCircular) => c.id)
      const { data: recips } = await supabase
        .from('vc_circular_recipients')
        .select('*')
        .in('circular_id', circIds)

      const circUI: CircularUI[] = (circs ?? []).map((c: VCCircular) => {
        const r = (recips ?? []).filter((rr: VCCircularRecipient) => rr.circular_id === c.id)
        return { ...c, ackCount: r.filter((rr: VCCircularRecipient) => rr.ack_at).length, totalCount: r.length, recipients: r }
      })
      setCirculars(circUI)
    }
  }

  async function openThread(t: ThreadUI) {
    setActiveThread(t)
    setMsgLoading(true)
    await loadMessages(t.threadId)
    setMsgLoading(false)
    // Mark read
    await supabase.from('vc_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('thread_id', t.threadId)
      .eq('profile_id', userId)
    // Poll
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(() => loadMessages(t.threadId), 10000)
  }

  async function loadMessages(threadId: string) {
    const { data } = await supabase
      .from('vc_messages')
      .select('*')
      .eq('thread_id', threadId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  async function sendMessage() {
    if (!msgBody.trim() || !activeThread) return
    setSending(true)
    const body = msgBody.trim()
    setMsgBody('')
    await supabase.from('vc_messages').insert({
      thread_id: activeThread.threadId,
      school_id: schoolId,
      sender_id: userId,
      body,
    })
    await supabase.from('vc_threads').update({
      last_message_at:      new Date().toISOString(),
      last_message_preview: body.slice(0, 80),
    }).eq('id', activeThread.threadId)
    await loadMessages(activeThread.threadId)
    setSending(false)
  }

  async function searchPeople(q: string) {
    setSearchQuery(q)
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('school_id', schoolId)
      .neq('id', userId)
      .ilike('full_name', `%${q}%`)
      .limit(10)
    setSearchResults(data ?? [])
    setSearching(false)
  }

  async function startThread(other: ProfileRow) {
    setComposeOpen(false)
    setSearchQuery('')
    setSearchResults([])
    const threadId = await findOrCreateThread(schoolId, userId, other.id)
    const t: ThreadUI = {
      threadId,
      otherName:     other.full_name,
      otherInitials: initials(other.full_name),
      lastMessage:   '',
      lastTime:      '',
      unreadCount:   0,
      otherRole:     other.role,
      otherId:       other.id,
    }
    await openThread(t)
  }

  async function sendCircular() {
    if (!circTitle.trim() || !circBody.trim()) return
    setCircSending(true)
    const { data: circ } = await supabase.from('vc_circulars').insert({
      school_id:     schoolId,
      title:         circTitle.trim(),
      body:          circBody.trim(),
      audience_type: circAudience,
      requires_ack:  circAck,
      ack_deadline:  circDeadline || null,
      sent_by:       userId,
    }).select().single()

    if (circ) {
      // Fetch recipients
      let roleFilter: string[] = []
      if (circAudience === 'all_staff')    roleFilter = ['teacher', 'admin']
      if (circAudience === 'all_parents')  roleFilter = ['parent']
      if (circAudience === 'everyone')     roleFilter = ['teacher', 'admin', 'parent']

      const { data: recipients } = await supabase
        .from('profiles')
        .select('id')
        .eq('school_id', schoolId)
        .in('role', roleFilter)

      if (recipients && recipients.length > 0) {
        await supabase.from('vc_circular_recipients').insert(
          recipients.map((r: { id: string }) => ({ circular_id: circ.id, profile_id: r.id }))
        )
      }
    }

    setNewCircSheet(false)
    setCircTitle('')
    setCircBody('')
    setCircAudience('everyone')
    setCircAck(true)
    setCircDeadline('')
    setCircSending(false)
    await loadAll(userId, schoolId)
  }

  // ── Conversation view ────────────────────────────────────────────────────────
  if (activeThread) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 120px)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <button
            onClick={() => { setActiveThread(null); if (pollRef.current) clearInterval(pollRef.current); loadAll(userId, schoolId) }}
            style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '8px 12px', cursor: 'pointer', fontSize: '16px' }}
          >←</button>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: `linear-gradient(135deg,${C.emerald},${C.navy3})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '700', fontSize: '14px', flexShrink: 0 }}>
            {activeThread.otherInitials}
          </div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '15px', color: C.text }}>{activeThread.otherName}</div>
            <div style={{ fontSize: '12px', color: C.muted, textTransform: 'capitalize' }}>{activeThread.otherRole}</div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '8px' }}>
          {msgLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[1,2,3].map(i => <Skeleton key={i} h={48} />)}
            </div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: C.muted }}>
              <VCIcon size={40} />
              <p style={{ marginTop: '12px', fontSize: '14px' }}>No messages yet. Say hello!</p>
            </div>
          ) : messages.map(m => {
            const mine = m.sender_id === userId
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '75%', padding: '10px 14px', borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: mine ? C.emerald : C.surface,
                  color: mine ? '#fff' : C.text,
                  fontSize: '14px', lineHeight: '1.4',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                }}>
                  {m.body}
                  <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '4px', textAlign: 'right' }}>{timeAgo(m.created_at)}</div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ paddingTop: '8px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea
            value={msgBody}
            onChange={e => setMsgBody(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder="Type a message..."
            rows={2}
            style={{ flex: 1, padding: '10px 14px', borderRadius: '14px', border: `1px solid ${C.border}`, fontSize: '14px', resize: 'none', fontFamily: 'inherit', outline: 'none', background: C.surface }}
          />
          <button
            onClick={sendMessage}
            disabled={sending || !msgBody.trim()}
            style={{ background: C.emerald, border: 'none', borderRadius: '14px', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '18px', flexShrink: 0, opacity: sending || !msgBody.trim() ? 0.5 : 1 }}
          >➤</button>
        </div>
        <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      </div>
    )
  }

  // ── Circular detail view ─────────────────────────────────────────────────────
  if (activeCircular) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <button onClick={() => setActiveCircular(null)} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '8px 12px', cursor: 'pointer', fontSize: '16px' }}>←</button>
          <div style={{ fontWeight: '700', fontSize: '16px', color: C.text, flex: 1 }}>{activeCircular.title}</div>
        </div>
        <div style={{ background: C.surface, borderRadius: '16px', padding: '16px', marginBottom: '12px', border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <span style={{ background: C.emeraldLt, color: C.emerald, borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: '600' }}>{activeCircular.audience_type.replace('_', ' ')}</span>
            {activeCircular.requires_ack && <span style={{ background: C.warningLt, color: C.warning, borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: '600' }}>Ack required</span>}
          </div>
          <p style={{ fontSize: '14px', color: C.text, lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{activeCircular.body}</p>
          <p style={{ fontSize: '12px', color: C.muted, marginTop: '12px' }}>Sent {timeAgo(activeCircular.sent_at)}</p>
        </div>
        <div style={{ background: C.surface, borderRadius: '16px', padding: '16px', border: `1px solid ${C.border}` }}>
          <div style={{ fontWeight: '700', fontSize: '14px', color: C.text, marginBottom: '12px' }}>
            Acknowledgements: {activeCircular.ackCount} of {activeCircular.totalCount}
          </div>
          <div style={{ height: '6px', borderRadius: '6px', background: C.border, marginBottom: '16px', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: '6px', background: C.emerald, width: activeCircular.totalCount > 0 ? `${(activeCircular.ackCount / activeCircular.totalCount) * 100}%` : '0%', transition: 'width 0.4s ease' }} />
          </div>
          {activeCircular.recipients.map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: '13px', color: C.text }}>{r.profile_id.slice(0, 8)}…</span>
              <span style={{ fontSize: '12px', color: r.ack_at ? C.emerald : C.muted, fontWeight: '600' }}>{r.ack_at ? '✓ Acknowledged' : 'Pending'}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Main view ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
        <VCIcon size={32} />
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: C.text, margin: 0 }}>VibeConnect</h1>
          <p style={{ fontSize: '12px', color: C.muted, margin: 0 }}>Messages · Circulars · School-wide comms</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', margin: '20px 0 16px', background: C.surface, borderRadius: '12px', padding: '4px', border: `1px solid ${C.border}` }}>
        {(['threads', 'circulars'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '14px', background: tab === t ? C.hero : 'transparent', color: tab === t ? '#fff' : C.muted, transition: 'all 0.2s' }}>
            {t === 'threads' ? '💬 Messages' : '📢 Circulars'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[1,2,3,4].map(i => <Skeleton key={i} h={72} />)}
        </div>
      ) : tab === 'threads' ? (
        <>
          {threads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', background: C.surface, borderRadius: '16px', border: `1px solid ${C.border}` }}>
              <VCIcon size={48} />
              <p style={{ marginTop: '16px', fontWeight: '700', color: C.text }}>No conversations yet</p>
              <p style={{ fontSize: '13px', color: C.muted, marginTop: '4px' }}>Tap + to start a conversation</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {threads.map(t => (
                <button key={t.threadId} onClick={() => openThread(t)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', cursor: 'pointer', textAlign: 'left', marginBottom: '4px', width: '100%' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: `linear-gradient(135deg,${C.emerald},${C.navy3})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '700', fontSize: '15px', flexShrink: 0 }}>
                    {t.otherInitials}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '700', fontSize: '14px', color: C.text }}>{t.otherName}</span>
                      <span style={{ fontSize: '11px', color: C.muted }}>{t.lastTime}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>{t.lastMessage || 'No messages yet'}</div>
                  </div>
                  {t.unreadCount > 0 && (
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: C.emerald, color: '#fff', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{t.unreadCount}</div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* FAB */}
          <button
            onClick={() => setComposeOpen(true)}
            style={{ position: 'fixed', bottom: '80px', right: '20px', width: '56px', height: '56px', borderRadius: '50%', background: C.emerald, border: 'none', color: '#fff', fontSize: '24px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}
          >+</button>
        </>
      ) : (
        <>
          <button onClick={() => setNewCircSheet(true)} style={{ width: '100%', padding: '14px', borderRadius: '14px', background: C.emerald, border: 'none', color: '#fff', fontWeight: '700', fontSize: '15px', cursor: 'pointer', marginBottom: '16px' }}>
            + New Circular
          </button>
          {circulars.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', background: C.surface, borderRadius: '16px', border: `1px solid ${C.border}` }}>
              <p style={{ fontSize: '32px' }}>📢</p>
              <p style={{ marginTop: '12px', fontWeight: '700', color: C.text }}>No circulars sent yet</p>
              <p style={{ fontSize: '13px', color: C.muted, marginTop: '4px' }}>Send your first circular above</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {circulars.map(c => (
                <button key={c.id} onClick={() => setActiveCircular(c)} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '16px', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <span style={{ fontWeight: '700', fontSize: '14px', color: C.text, flex: 1 }}>{c.title}</span>
                    <span style={{ fontSize: '11px', color: C.muted, marginLeft: '8px', flexShrink: 0 }}>{timeAgo(c.sent_at)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ background: C.emeraldLt, color: C.emerald, borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontWeight: '600' }}>{c.audience_type.replace('_', ' ')}</span>
                    {c.requires_ack && (
                      <span style={{ fontSize: '12px', color: c.ackCount === c.totalCount && c.totalCount > 0 ? C.emerald : C.warning, fontWeight: '600' }}>
                        {c.ackCount}/{c.totalCount} ack
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Compose sheet */}
      {composeOpen && (
        <>
          <div onClick={() => setComposeOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, borderRadius: '20px 20px 0 0', background: C.surface, zIndex: 50, display: 'flex', flexDirection: 'column', maxHeight: '70dvh' }}>
            <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontWeight: '700', fontSize: '16px', color: C.text }}>New Message</div>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '16px' }}>
              <input
                value={searchQuery}
                onChange={e => searchPeople(e.target.value)}
                placeholder="Search by name..."
                style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: `1px solid ${C.border}`, fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
              {searching && <div style={{ textAlign: 'center', padding: '16px', color: C.muted, fontSize: '13px' }}>Searching...</div>}
              {searchResults.map(p => (
                <button key={p.id} onClick={() => startThread(p)} style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '12px', borderRadius: '12px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', marginTop: '4px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg,${C.emerald},${C.navy3})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '700', fontSize: '13px', flexShrink: 0 }}>
                    {initials(p.full_name)}
                  </div>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: C.text }}>{p.full_name}</div>
                    <div style={{ fontSize: '12px', color: C.muted, textTransform: 'capitalize' }}>{p.role}</div>
                  </div>
                </button>
              ))}
            </div>
            <div style={{ padding: '12px 16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))', borderTop: `1px solid ${C.border}` }}>
              <button onClick={() => setComposeOpen(false)} style={{ width: '100%', padding: '13px', borderRadius: '12px', border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* New Circular sheet */}
      {newCircSheet && (
        <>
          <div onClick={() => setNewCircSheet(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, borderRadius: '20px 20px 0 0', background: C.surface, zIndex: 50, display: 'flex', flexDirection: 'column', maxHeight: '85dvh' }}>
            <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontWeight: '700', fontSize: '16px', color: C.text }}>New Circular</div>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: C.muted, display: 'block', marginBottom: '6px' }}>Title</label>
                <input value={circTitle} onChange={e => setCircTitle(e.target.value)} placeholder="Circular title..." style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: `1px solid ${C.border}`, fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: C.muted, display: 'block', marginBottom: '6px' }}>Message</label>
                <textarea value={circBody} onChange={e => setCircBody(e.target.value)} placeholder="Write your circular..." rows={5} style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: `1px solid ${C.border}`, fontSize: '14px', resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: C.muted, display: 'block', marginBottom: '6px' }}>Audience</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['all_staff', 'all_parents', 'everyone'] as const).map(a => (
                    <button key={a} onClick={() => setCircAudience(a)} style={{ flex: 1, padding: '10px 4px', borderRadius: '10px', border: `2px solid ${circAudience === a ? C.emerald : C.border}`, background: circAudience === a ? C.emeraldLt : 'transparent', color: circAudience === a ? C.emerald : C.muted, fontWeight: '700', fontSize: '11px', cursor: 'pointer' }}>
                      {a === 'all_staff' ? 'Staff' : a === 'all_parents' ? 'Parents' : 'Everyone'}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: C.text }}>Requires acknowledgement</span>
                <button onClick={() => setCircAck(v => !v)} style={{ width: '48px', height: '26px', borderRadius: '13px', border: 'none', background: circAck ? C.emerald : C.border, cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
                  <div style={{ position: 'absolute', top: '3px', left: circAck ? '25px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                </button>
              </div>
              {circAck && (
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: C.muted, display: 'block', marginBottom: '6px' }}>Acknowledgement deadline</label>
                  <input type="date" value={circDeadline} onChange={e => setCircDeadline(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: `1px solid ${C.border}`, fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                </div>
              )}
            </div>
            <div style={{ padding: '12px 16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))', borderTop: `1px solid ${C.border}`, display: 'flex', gap: '8px' }}>
              <button onClick={() => setNewCircSheet(false)} style={{ flex: 1, padding: '13px', borderRadius: '12px', border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={sendCircular} disabled={circSending || !circTitle.trim() || !circBody.trim()} style={{ flex: 2, padding: '13px', borderRadius: '12px', border: 'none', background: C.emerald, color: '#fff', fontWeight: '700', fontSize: '14px', cursor: 'pointer', opacity: circSending || !circTitle.trim() || !circBody.trim() ? 0.5 : 1 }}>
                {circSending ? 'Sending...' : 'Send Circular'}
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>
    </div>
  )
}

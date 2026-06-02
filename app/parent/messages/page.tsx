"use client";

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { VCThread, VCMessage, VCCircular } from '@/lib/types'

const C = {
  hero:      '#0a1628',
  emerald:   '#10b981',
  emeraldLt: '#d1fae5',
  border:    '#e2e8f0',
  surface:   '#ffffff',
  text:      '#0f172a',
  muted:     '#64748b',
  warning:   '#f59e0b',
  navy3:     '#0f5fa8',
}

function Skeleton({ h = 56, r = 12 }: { h?: number; r?: number }) {
  return <div style={{ height: h, borderRadius: r, background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
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

function ContextTag({ tag }: { tag: string }) {
  const map: Record<string, { icon: string; label: string; bg: string; color: string }> = {
    memo:     { icon: '📋', label: 'Memo',    bg: '#e0e7ff', color: '#3730a3' },
    enquiry:  { icon: '❓', label: 'Enquiry', bg: '#fef3c7', color: '#92400e' },
    urgent:   { icon: '🚨', label: 'Urgent',  bg: '#fee2e2', color: '#b91c1c' },
    general:  { icon: '💬', label: 'General', bg: '#f0fdf4', color: '#166534' },
    question: { icon: '❓', label: 'Question',bg: '#fef3c7', color: '#92400e' },
    concern:  { icon: '🚨', label: 'Concern', bg: '#fee2e2', color: '#b91c1c' },
    colleague:{ icon: '👥', label: 'Colleague',bg:'#f0f9ff', color: '#0369a1' },
  }
  const t = map[tag] ?? map.general
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: '99px', background: t.bg, color: t.color, whiteSpace: 'nowrap', flexShrink: 0 }}>{t.icon} {t.label}</span>
}

function initials(name: string) { return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() }
function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

async function ensureVCId(userId: string, fullName: string) {
  const { data } = await supabase.from('profiles').select('vc_id').eq('id', userId).single()
  if (data?.vc_id) return data.vc_id
  const vcId = `@${fullName.toLowerCase().split(' ')[0].replace(/[^a-z]/g, '').slice(0, 8)}.${Math.floor(1000 + Math.random() * 9000)}`
  await supabase.from('profiles').update({ vc_id: vcId }).eq('id', userId)
  return vcId
}

async function findOrCreateThread(schoolId: string | null, currentUserId: string, otherUserId: string, contextTag = 'general'): Promise<string> {
  const { data: myThreads } = await supabase.from('vc_participants').select('thread_id').eq('profile_id', currentUserId)
  const myThreadIds = (myThreads ?? []).map((t: { thread_id: string }) => t.thread_id)
  if (myThreadIds.length > 0) {
    const { data: shared } = await supabase.from('vc_participants').select('thread_id').eq('profile_id', otherUserId).in('thread_id', myThreadIds)
    if (shared && shared.length > 0) return shared[0].thread_id
  }
  const { data: thread } = await supabase.from('vc_threads').insert({ school_id: schoolId, type: 'direct', created_by: currentUserId, context_tag: contextTag }).select().single()
  await supabase.from('vc_participants').insert([
    { thread_id: thread.id, profile_id: currentUserId, school_id: schoolId },
    { thread_id: thread.id, profile_id: otherUserId,   school_id: schoolId },
  ])
  return thread.id
}

interface ThreadUI { threadId: string; otherName: string; otherInitials: string; lastMessage: string; lastTime: string; unreadCount: number; otherRole: string; otherId: string; contextTag: string }
interface CircularUI extends VCCircular { acked: boolean; recipientId: string }
interface ProfileRow { id: string; full_name: string; role: string }

const COMPOSE_TYPES = [
  { type: 'question', icon: '❓', label: 'Question about my child', desc: 'Ask a teacher or admin about your child' },
  { type: 'general',  icon: '💬', label: 'General enquiry',         desc: 'A general question or message' },
  { type: 'urgent',   icon: '🚨', label: 'Urgent matter',           desc: 'Something that needs a prompt response' },
]

export default function ParentMessagesPage() {
  const router = useRouter()

  const [userId,   setUserId]   = useState('')
  const [schoolId, setSchoolId] = useState<string | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [tab, setTab] = useState<'threads' | 'notices'>('threads')

  const [threads,      setThreads]      = useState<ThreadUI[]>([])
  const [activeThread, setActiveThread] = useState<ThreadUI | null>(null)
  const [messages,     setMessages]     = useState<VCMessage[]>([])
  const [msgBody,      setMsgBody]      = useState('')
  const [sending,      setSending]      = useState(false)
  const [msgLoading,   setMsgLoading]   = useState(false)
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const [composeTypeOpen, setComposeTypeOpen] = useState(false)
  const [pendingTag,      setPendingTag]      = useState('general')
  const [composeOpen,     setComposeOpen]     = useState(false)
  const [searchQuery,     setSearchQuery]     = useState('')
  const [searchResults,   setSearchResults]   = useState<ProfileRow[]>([])
  const [searching,       setSearching]       = useState(false)
  const [suggestedContacts, setSuggestedContacts] = useState<ProfileRow[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)

  const [notices, setNotices] = useState<CircularUI[]>([])
  const [acking,  setAcking]  = useState<string | null>(null)

  useEffect(() => { loadUser(); return () => { if (pollRef.current) clearInterval(pollRef.current) } }, [])

  useEffect(() => {
    if (composeOpen) loadSuggestedContacts()
  }, [composeOpen])

  async function loadUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/parent'); return }
      const [pRes, memberRes] = await Promise.all([
        supabase.from('profiles').select('full_name, school_id, role').eq('id', user.id).single(),
        supabase.from('school_members').select('school_id').eq('profile_id', user.id).maybeSingle(),
      ])
      const p = pRes.data
      if (p) p.school_id = memberRes.data?.school_id ?? p.school_id
      if (!p || p.role !== 'parent') { router.push('/parent'); return }
      setUserId(user.id); setSchoolId(p?.school_id ?? null)
      try { await ensureVCId(user.id, p.full_name ?? 'Parent') } catch {}
      await loadAll(user.id, p?.school_id ?? '')
    } catch { router.push('/parent') } finally { setLoading(false) }
  }

  async function loadAll(uid: string, sid: string | null) {
    const [{ data: parts }, { data: noticeRecips }] = await Promise.all([
      supabase.from('vc_participants').select('thread_id, last_read_at').eq('profile_id', uid),
      supabase.from('vc_circular_recipients').select('id, circular_id, ack_at').eq('profile_id', uid),
    ])

    const threadIds = (parts ?? []).map((p: { thread_id: string }) => p.thread_id)

    if (threadIds.length > 0) {
      const [{ data: threadRows }, { data: allParts }] = await Promise.all([
        supabase.from('vc_threads').select('*').in('id', threadIds).order('last_message_at', { ascending: false }),
        supabase.from('vc_participants').select('thread_id, profile_id').in('thread_id', threadIds),
      ])
      const otherIds = (allParts ?? []).filter((p: { profile_id: string }) => p.profile_id !== uid).map((p: { profile_id: string }) => p.profile_id)
      const { data: profiles } = otherIds.length > 0 ? await supabase.from('profiles').select('id, full_name, role').in('id', otherIds) : { data: [] }
      const profileMap: Record<string, ProfileRow> = {}
      ;(profiles ?? []).forEach((pr: ProfileRow) => { profileMap[pr.id] = pr })
      const readMap: Record<string, string | null> = {}
      ;(parts ?? []).forEach((p: { thread_id: string; last_read_at: string | null }) => { readMap[p.thread_id] = p.last_read_at })

      const unreadCounts: Record<string, number> = {}
      await Promise.all(threadIds.map(async (threadId: string) => {
        const since = readMap[threadId] ?? '1970-01-01T00:00:00Z'
        const { count } = await supabase.from('vc_messages').select('id', { count: 'exact', head: true }).eq('thread_id', threadId).neq('sender_id', uid).gt('created_at', since)
        unreadCounts[threadId] = count ?? 0
      }))

      setThreads((threadRows ?? []).map((t: VCThread & { context_tag?: string }) => {
        const otherPart = (allParts ?? []).find((p: { thread_id: string; profile_id: string }) => p.thread_id === t.id && p.profile_id !== uid)
        const other = otherPart ? profileMap[otherPart.profile_id] : null
        return { threadId: t.id, otherName: other?.full_name ?? 'Unknown', otherInitials: initials(other?.full_name ?? '?'), lastMessage: t.last_message_preview ?? '', lastTime: t.last_message_at ? timeAgo(t.last_message_at) : '', unreadCount: unreadCounts[t.id] ?? 0, otherRole: other?.role ?? '', otherId: otherPart?.profile_id ?? '', contextTag: t.context_tag ?? 'general' }
      }))
    }

    const circIds = (noticeRecips ?? []).map((r: { circular_id: string }) => r.circular_id)
    if (circIds.length > 0) {
      const { data: circs } = await supabase.from('vc_circulars').select('*').in('id', circIds).order('sent_at', { ascending: false })
      setNotices((circs ?? []).map((c: VCCircular) => {
        const recip = (noticeRecips ?? []).find((r: { circular_id: string; id: string; ack_at: string | null }) => r.circular_id === c.id)
        return { ...c, acked: !!recip?.ack_at, recipientId: recip?.id ?? '' }
      }))
    }
  }

  async function openThread(t: ThreadUI) {
    setActiveThread(t); setMsgLoading(true)
    await loadMessages(t.threadId); setMsgLoading(false)
    await supabase.from('vc_participants').update({ last_read_at: new Date().toISOString() }).eq('thread_id', t.threadId).eq('profile_id', userId)
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(() => loadMessages(t.threadId), 10000)
  }

  async function loadMessages(threadId: string) {
    const { data } = await supabase.from('vc_messages').select('*').eq('thread_id', threadId).is('deleted_at', null).order('created_at', { ascending: true })
    setMessages(data ?? [])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  async function sendMessage() {
    if (!msgBody.trim() || !activeThread) return
    setSending(true); const body = msgBody.trim(); setMsgBody('')
    const { error: msgErr } = await supabase.from('vc_messages').insert({ thread_id: activeThread.threadId, school_id: schoolId ?? null, sender_id: userId, body })
    if (msgErr) { setSending(false); setMsgBody(body); return }
    await supabase.from('vc_threads').update({ last_message_at: new Date().toISOString(), last_message_preview: body.slice(0, 80) }).eq('id', activeThread.threadId)
    await loadMessages(activeThread.threadId); setSending(false)
  }

  async function searchPeople(q: string) {
    setSearchQuery(q)
    if (q.length < 2) { setSearchResults([]); return }
    if (!schoolId) { setSearchResults([]); return }
    setSearching(true)
    const { data } = await supabase.from('profiles').select('id, full_name, role').eq('school_id', schoolId).neq('id', userId).in('role', ['teacher', 'admin']).ilike('full_name', `%${q}%`).limit(10)
    setSearchResults(data ?? []); setSearching(false)
  }

  async function startThread(other: ProfileRow) {
    setComposeOpen(false); setSearchQuery(''); setSearchResults([])
    const threadId = await findOrCreateThread(schoolId, userId, other.id, pendingTag)
    await openThread({ threadId, otherName: other.full_name, otherInitials: initials(other.full_name), lastMessage: '', lastTime: '', unreadCount: 0, otherRole: other.role, otherId: other.id, contextTag: pendingTag })
  }

  async function acknowledgeNotice(recipientId: string, circularId: string) {
    setAcking(circularId)
    const { error: ackErr } = await supabase.from('vc_circular_recipients').update({ ack_at: new Date().toISOString() }).eq('id', recipientId)
    if (!ackErr) setNotices(prev => prev.map(c => c.id === circularId ? { ...c, acked: true } : c))
    setAcking(null)
  }

  async function loadSuggestedContacts() {
    if (!userId) return
    setSuggestionsLoading(true)
    try {
      // Get parent's children
      const { data: students } = await supabase
        .from('students')
        .select('class_id')
        .eq('profile_id', userId)

      const classIds = (students ?? [])
        .map((s: { class_id: string }) => s.class_id)
        .filter(Boolean)

      if (classIds.length === 0) { setSuggestionsLoading(false); return }

      // Get homeroom teachers and subject teachers
      const [classRes, tcRes] = await Promise.all([
        supabase.from('classes').select('teacher_id').in('id', classIds),
        supabase.from('teacher_classes').select('teacher_id').in('class_id', classIds),
      ])

      const teacherIds = Array.from(new Set([
        ...(classRes.data ?? []).map((c: { teacher_id: string }) => c.teacher_id),
        ...(tcRes.data ?? []).map((t: { teacher_id: string }) => t.teacher_id),
      ].filter(Boolean)))

      if (teacherIds.length === 0) { setSuggestionsLoading(false); return }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('id', teacherIds)
        .neq('id', userId)

      setSuggestedContacts(profiles ?? [])
    } catch {
      setSuggestedContacts([])
    } finally {
      setSuggestionsLoading(false)
    }
  }

  // ── Conversation view ──────────────────────────
  if (activeThread) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 120px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <button onClick={() => { setActiveThread(null); if (pollRef.current) clearInterval(pollRef.current); loadAll(userId, schoolId) }} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '8px 12px', cursor: 'pointer', fontSize: '16px' }}>←</button>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: `linear-gradient(135deg,${C.emerald},${C.navy3})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '700', fontSize: '14px', flexShrink: 0 }}>{activeThread.otherInitials}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '700', fontSize: '15px', color: C.text }}>{activeThread.otherName}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <span style={{ fontSize: '12px', color: C.muted, textTransform: 'capitalize' }}>{activeThread.otherRole}</span>
              <ContextTag tag={activeThread.contextTag} />
            </div>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '8px' }}>
          {msgLoading ? <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{[1,2,3].map(i => <Skeleton key={i} h={48} />)}</div>
          : messages.length === 0 ? <div style={{ textAlign: 'center', padding: '40px 20px', color: C.muted }}><VCIcon size={40} /><p style={{ marginTop: '12px', fontSize: '14px' }}>No messages yet. Say hello!</p></div>
          : messages.map(m => {
            const mine = m.sender_id === userId
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '75%', padding: '10px 14px', borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: mine ? C.emerald : C.surface, color: mine ? '#fff' : C.text, fontSize: '14px', lineHeight: '1.4', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                  {m.body}
                  <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '4px', textAlign: 'right' }}>{timeAgo(m.created_at)}</div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
        <div style={{ paddingTop: '8px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea value={msgBody} onChange={e => setMsgBody(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }} placeholder="Type a message..." rows={2} style={{ flex: 1, padding: '10px 14px', borderRadius: '14px', border: `1px solid ${C.border}`, fontSize: '14px', resize: 'none', fontFamily: 'inherit', outline: 'none', background: C.surface }} />
          <button onClick={sendMessage} disabled={sending || !msgBody.trim()} style={{ background: C.emerald, border: 'none', borderRadius: '14px', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '18px', flexShrink: 0, opacity: sending || !msgBody.trim() ? 0.5 : 1 }}>➤</button>
        </div>
        <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      </div>
    )
  }

  // ── Main view ──────────────────────────────────
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
        <VCIcon size={32} />
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: C.text, margin: 0 }}>Messages</h1>
          <p style={{ fontSize: '12px', color: C.muted, margin: 0 }}>Talk to teachers · School notices</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', margin: '20px 0 16px', background: C.surface, borderRadius: '12px', padding: '4px', border: `1px solid ${C.border}` }}>
        {(['threads', 'notices'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '14px', background: tab === t ? C.hero : 'transparent', color: tab === t ? '#fff' : C.muted, transition: 'all 0.2s' }}>
            {t === 'threads' ? '💬 Messages' : '📢 Notices'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{[1,2,3,4].map(i => <Skeleton key={i} h={72} />)}</div>
      ) : tab === 'threads' ? (
        <>
          {threads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', background: C.surface, borderRadius: '16px', border: `1px solid ${C.border}` }}>
              <VCIcon size={48} />
              <p style={{ marginTop: '16px', fontWeight: '700', color: C.text }}>No conversations yet</p>
              <p style={{ fontSize: '13px', color: C.muted, marginTop: '4px' }}>Tap + to message a teacher</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {threads.map(t => (
                <button key={t.threadId} onClick={() => openThread(t)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: `linear-gradient(135deg,${C.emerald},${C.navy3})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '700', fontSize: '15px', flexShrink: 0 }}>{t.otherInitials}</div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: '700', fontSize: '14px', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.otherName}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <ContextTag tag={t.contextTag} />
                        <span style={{ fontSize: '11px', color: C.muted }}>{t.lastTime}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: '13px', color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>{t.lastMessage || 'No messages yet'}</div>
                    <div style={{ fontSize: '11px', color: C.muted, textTransform: 'capitalize', marginTop: '2px' }}>{t.otherRole}</div>
                  </div>
                  {t.unreadCount > 0 && (
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: C.emerald, color: '#fff', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{t.unreadCount}</div>
                  )}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setComposeTypeOpen(true)} style={{ position: 'fixed', bottom: '80px', right: '20px', width: '56px', height: '56px', borderRadius: '50%', background: C.emerald, border: 'none', color: '#fff', fontSize: '24px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>+</button>
        </>
      ) : (
        <>
          {notices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', background: C.surface, borderRadius: '16px', border: `1px solid ${C.border}` }}>
              <p style={{ fontSize: '32px' }}>📢</p>
              <p style={{ marginTop: '12px', fontWeight: '700', color: C.text }}>No notices yet</p>
              <p style={{ fontSize: '13px', color: C.muted, marginTop: '4px' }}>School notices will appear here</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {notices.map(c => (
                <div key={c.id} style={{ background: C.surface, border: `1px solid ${c.requires_ack && !c.acked ? C.warning : C.border}`, borderRadius: '14px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <span style={{ fontWeight: '700', fontSize: '14px', color: C.text, flex: 1 }}>{c.title}</span>
                    <span style={{ fontSize: '11px', color: C.muted, marginLeft: '8px', flexShrink: 0 }}>{timeAgo(c.sent_at)}</span>
                  </div>
                  <p style={{ fontSize: '13px', color: C.muted, lineHeight: '1.5', marginBottom: '12px' }}>{c.body}</p>
                  {c.requires_ack && (c.acked
                    ? <span style={{ fontSize: '12px', color: C.emerald, fontWeight: '700' }}>✓ Acknowledged</span>
                    : <button onClick={() => acknowledgeNotice(c.recipientId, c.id)} disabled={acking === c.id} style={{ padding: '8px 16px', borderRadius: '10px', border: 'none', background: C.warning, color: '#fff', fontWeight: '700', fontSize: '13px', cursor: 'pointer', opacity: acking === c.id ? 0.6 : 1 }}>{acking === c.id ? 'Saving...' : 'Acknowledge'}</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Compose type picker ── */}
      {composeTypeOpen && (
        <>
          <div onClick={() => setComposeTypeOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, borderRadius: '20px 20px 0 0', background: C.surface, zIndex: 50, padding: '12px 16px 32px' }}>
            <div style={{ width: 40, height: 4, background: C.border, borderRadius: 99, margin: '0 auto 16px' }} />
            <div style={{ fontWeight: '700', fontSize: '17px', color: C.text, textAlign: 'center', marginBottom: '20px' }}>What&apos;s this message about?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {COMPOSE_TYPES.map(opt => (
                <button key={opt.type} onClick={() => { setPendingTag(opt.type); setComposeTypeOpen(false); setComposeOpen(true) }} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', border: `1.5px solid ${C.border}`, borderRadius: '14px', background: '#fff', textAlign: 'left', cursor: 'pointer' }}>
                  <span style={{ fontSize: '26px', flexShrink: 0 }}>{opt.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: C.text }}>{opt.label}</div>
                    <div style={{ fontSize: '13px', color: C.muted, marginTop: '2px' }}>{opt.desc}</div>
                  </div>
                  <span style={{ fontSize: '20px', color: C.muted }}>›</span>
                </button>
              ))}
            </div>
            <button onClick={() => setComposeTypeOpen(false)} style={{ width: '100%', marginTop: '14px', padding: '13px', background: '#f3f4f6', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '600', color: '#374151', cursor: 'pointer' }}>Cancel</button>
          </div>
        </>
      )}

      {/* ── Compose sheet ── */}
      {composeOpen && (
        <>
          <div onClick={() => setComposeOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, borderRadius: '20px 20px 0 0', background: C.surface, zIndex: 50, display: 'flex', flexDirection: 'column', maxHeight: '70dvh' }}>
            <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontWeight: '700', fontSize: '16px', color: C.text }}>New Message</div>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '16px' }}>
              <input value={searchQuery} onChange={e => searchPeople(e.target.value)} placeholder="Search teachers and admin..." style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: `1px solid ${C.border}`, fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              {searching && <div style={{ textAlign: 'center', padding: '16px', color: C.muted, fontSize: '13px' }}>Searching...</div>}
              {searchResults.map(p => (
                <button key={p.id} onClick={() => startThread(p)} style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '12px', borderRadius: '12px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', marginTop: '4px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg,${C.emerald},${C.navy3})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '700', fontSize: '13px', flexShrink: 0 }}>{initials(p.full_name)}</div>
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

      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  )
}

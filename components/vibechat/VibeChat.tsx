'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Bell, MessageCircle, RefreshCw, Send, Users, UserPlus } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase'
import Enquiries from './Enquiries'
import VibeChatAvatar from './VibeChatAvatar'
import VibeChatContacts from './VibeChatContacts'
import VibeChatSchool from './VibeChatSchool'
import { useVibeChatTyping } from './useVibeChatTyping'
import styles from './VibeChat.module.css'

type Tab = 'chats' | 'contacts' | 'enquiries' | 'notices' | 'school'
type Chat = {
  key: string
  id: string
  kind: 'school' | 'tuition'
  title: string
  avatarUrl: string | null
  detail: string
  preview: string
  updated: string | null
  schoolId: string | null
}
type Message = { id: string; body: string; mine: boolean; created_at: string }
type Notice = { id: string; recipientId: string; title: string; body: string; sentAt: string; requiresAck: boolean; acked: boolean }
type TutorInvite = { id: string; status: string; student?: string | null; tutor?: string | null }
type SchoolThread = { id: string; school_id: string | null; type: string; subject: string | null; context_tag: string | null; last_message_at: string | null; last_message_preview: string | null; created_at: string | null }

const stamp = (value: string | null) => value ? new Date(value).toLocaleString('en-KE', {
  day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Nairobi',
}) : ''

const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[1-8a-f\d][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i
const validKey = (key: string | null) => key && /^(vc|tuition):/.test(key) && uuid.test(key.split(':')[1]) ? key : null

export default function VibeChat() {
  const params = useSearchParams()
  const requestedTab = params.get('tab')
  const requestedChat = validKey(params.get('thread'))
  const [tab, setTab] = useState<Tab>(requestedTab === 'enquiries' || requestedTab === 'notices' || requestedTab === 'contacts' || requestedTab === 'school' ? requestedTab : 'chats')
  const [uid, setUid] = useState('')
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [role, setRole] = useState('')
  const [schoolMessagingAvailable, setSchoolMessagingAvailable] = useState(false)
  const [chats, setChats] = useState<Chat[]>([])
  const [notices, setNotices] = useState<Notice[]>([])
  const [active, setActive] = useState<string | null>(requestedChat)
  const [messages, setMessages] = useState<Message[]>([])
  const [body, setBody] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [acking, setAcking] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [messageError, setMessageError] = useState('')
  const selectedRef = useRef<string | null>(null)
  selectedRef.current = active

  const load = useCallback(async () => {
    const db = getSupabaseClient()
    setLoading(true)
    setError('')
    try {
      const { data: auth, error: authError } = await db.auth.getUser()
      if (authError) throw authError
      const user = auth.user
      if (!user) { setSignedIn(false); setChats([]); setNotices([]); return }
      setUid(user.id)
      setSignedIn(true)

      const [profile, schoolMember, teacherProfile, participantResult, tutorResult, studentResult, noticeRecipients, schoolPeerResult, tuitionPeerResult] = await Promise.all([
        db.from('profiles').select('role,school_id').eq('id', user.id).maybeSingle(),
        db.from('school_members').select('school_id').eq('profile_id', user.id).limit(1),
        db.from('teacher_profiles').select('school_id').eq('profile_id', user.id).maybeSingle(),
        db.from('vc_participants').select('thread_id,last_read_at').eq('profile_id', user.id).is('left_at', null),
        db.rpc('vibetutor_my_student_invites'),
        db.rpc('vibetutor_student_inbox'),
        db.from('vc_circular_recipients').select('id,circular_id,ack_at').eq('profile_id', user.id),
        db.rpc('vibechat_my_chat_peers'),
        db.rpc('vibechat_my_tuition_peers'),
      ])
      setRole(profile.data?.role ?? '')
      setSchoolMessagingAvailable(Boolean(profile.data?.school_id || schoolMember.data?.[0]?.school_id || teacherProfile.data?.school_id))
      if (participantResult.error) throw participantResult.error

      const threadIds = [...new Set((participantResult.data ?? []).map(p => p.thread_id).filter((id): id is string => Boolean(id)))]
      let schoolChats: Chat[] = []
      if (threadIds.length) {
        const { data: threads, error: threadsError } = await db.from('vc_threads')
          .select('id,school_id,type,subject,context_tag,last_message_at,last_message_preview,created_at')
          .in('id', threadIds)
        if (threadsError) throw threadsError
        // This RPC only projects profiles for verified direct-chat peers. Public
        // profiles RLS deliberately does not expose a searchable account directory.
        const peerMap = new Map(
          (Array.isArray(schoolPeerResult.data) ? schoolPeerResult.data : [])
            .map(peer => [peer.thread_id, peer] as const)
        )
        schoolChats = ((threads ?? []) as SchoolThread[]).filter(t => t.type === 'direct').map(t => ({
          key: 'vc:' + t.id, id: t.id, kind: 'school' as const,
          title: peerMap.get(t.id)?.name ?? t.subject ?? 'School conversation',
          avatarUrl: peerMap.get(t.id)?.avatar_url ?? null,
          detail: t.context_tag === 'general' ? 'School message' : 'School · ' + (t.context_tag ?? 'message'),
          preview: t.last_message_preview ?? '', updated: t.last_message_at ?? t.created_at,
          schoolId: t.school_id,
        }))
      }

      // These existing RPCs enforce accepted tuition connections. Failed unrelated
      // role-specific lookups do not grant access or erase school conversations.
      const invitations = new Map<string, TutorInvite>()
      if (!tutorResult.error && Array.isArray(tutorResult.data)) {
        for (const item of tutorResult.data as TutorInvite[]) if (item.status === 'accepted') invitations.set(item.id, item)
      }
      if (!studentResult.error && Array.isArray(studentResult.data)) {
        for (const item of studentResult.data as TutorInvite[]) if (item.status === 'accepted') invitations.set(item.id, item)
      }
      const tuitionPeerMap = new Map(
        (Array.isArray(tuitionPeerResult.data) ? tuitionPeerResult.data : [])
          .map(peer => [peer.invitation_id, peer] as const)
      )
      const tuitionChats = [...invitations.values()].map(item => ({
        key: 'tuition:' + item.id, id: item.id, kind: 'tuition' as const,
        title: tuitionPeerMap.get(item.id)?.name ?? item.tutor ?? item.student ?? 'Private tutor',
        avatarUrl: tuitionPeerMap.get(item.id)?.avatar_url ?? null,
        detail: 'Approved private tuition', preview: '',
        updated: null, schoolId: null,
      }))
      setChats([...schoolChats, ...tuitionChats].sort((a,b) => (b.updated ?? '').localeCompare(a.updated ?? '')))

      if (noticeRecipients.error) throw noticeRecipients.error
      const recipientIds = [...new Set((noticeRecipients.data ?? []).map(r => r.circular_id).filter((id): id is string => Boolean(id)))]
      if (!recipientIds.length) setNotices([])
      else {
        const { data: circulars, error: circularError } = await db.from('vc_circulars')
          .select('id,title,body,requires_ack,sent_at').in('id', recipientIds)
          .not('sent_at', 'is', null).order('sent_at', { ascending: false })
        if (circularError) throw circularError
        const recipients = new Map((noticeRecipients.data ?? []).map(r => [r.circular_id,r]))
        setNotices((circulars ?? []).map(c => ({
          id:c.id, recipientId: recipients.get(c.id)?.id ?? '', title:c.title, body:c.body,
          sentAt:c.sent_at ?? '', requiresAck: Boolean(c.requires_ack), acked: Boolean(recipients.get(c.id)?.ack_at),
        })))
      }
    } catch {
      setError('VibeChat could not load every conversation. Retry to check your connection.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const selected = chats.find(chat => chat.key === active) ?? null
  const { otherTyping, sendTyping } = useVibeChatTyping(selected?.key ?? null)
  const loadMessages = useCallback(async (chat: Chat, ownerId: string) => {
    const db = getSupabaseClient()
    try {
      if (chat.kind === 'tuition') {
        const { data, error: rpcError } = await db.rpc('vibetutor_my_lesson_messages', { p_invitation: chat.id })
        if (rpcError) throw rpcError
        const rows = ((Array.isArray(data) ? data : []) as Message[]).map(m => ({
          id:m.id, body:m.body, mine: Boolean(m.mine), created_at:m.created_at,
        }))
        if (selectedRef.current === chat.key) setMessages(rows)
      } else {
        const { data, error: fetchError } = await db.from('vc_messages').select('id,body,sender_id,created_at')
          .eq('thread_id', chat.id).is('deleted_at', null).order('created_at', { ascending: true }).limit(200)
        if (fetchError) throw fetchError
        if (selectedRef.current === chat.key) {
          setMessages((data ?? []).filter(m => m.created_at).map(m => ({
            id:m.id, body:m.body, mine:m.sender_id === ownerId, created_at:m.created_at as string,
          })))
        }
      }
      if (selectedRef.current === chat.key) setMessageError('')
    } catch {
      if (selectedRef.current === chat.key) setMessageError('Could not load messages for this conversation.')
    }
  }, [])

  useEffect(() => {
    if (!selected || !uid) { setMessages([]); return }
    let running = true
    setMessages([])
    setMessageError('')
    setMessagesLoading(true)
    void loadMessages(selected, uid).finally(() => { if (running) setMessagesLoading(false) })
    const interval = window.setInterval(() => { if (running) void loadMessages(selected, uid) }, 12000)
    if (selected.kind === 'school') {
      void getSupabaseClient().from('vc_participants')
        .update({ last_read_at: new Date().toISOString() }).eq('thread_id', selected.id).eq('profile_id', uid)
    }
    return () => { running = false; window.clearInterval(interval) }
  }, [selected?.key, uid, loadMessages])

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault()
    if (!selected || !uid || sending || !body.trim() || body.trim().length > 1500) return
    setSending(true)
    sendTyping(false)
    setMessageError('')
    const text = body.trim()
    const db = getSupabaseClient()
    try {
      if (selected.kind === 'tuition') {
        const { error: rpcError } = await db.rpc('vibetutor_send_lesson_message', { p_invitation:selected.id, p_body:text })
        if (rpcError) throw rpcError
      } else {
        const { error: insertError } = await db.from('vc_messages').insert({
          thread_id:selected.id, school_id:selected.schoolId, sender_id:uid, body:text,
        })
        if (insertError) throw insertError
        // Preview is an optimization; the message insert above is authoritative.
        await db.from('vc_threads').update({
          last_message_at:new Date().toISOString(), last_message_preview:text.slice(0,80),
        }).eq('id',selected.id)
      }
      setBody('')
      await loadMessages(selected, uid)
    } catch {
      setMessageError('Message not sent. Please retry.')
    } finally { setSending(false) }
  }

  async function acknowledge(notice: Notice) {
    if (!notice.recipientId || notice.acked || acking) return
    setAcking(notice.id)
    const { error: ackError } = await getSupabaseClient().from('vc_circular_recipients')
      .update({ ack_at:new Date().toISOString() }).eq('id',notice.recipientId)
    if (ackError) setError('Could not acknowledge notice. Please retry.')
    else setNotices(current => current.map(n => n.id === notice.id ? { ...n, acked:true } : n))
    setAcking(null)
  }

  const filtered = useMemo(() => chats.filter(chat => (chat.title + ' ' + chat.detail).toLowerCase().includes(search.toLowerCase())), [chats,search])

  return <main className={styles.shell}>
    <div className={styles.main}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/vibechat" aria-label="VibeChat home">
          <span className={styles.logo}><MessageCircle aria-hidden size={22}/></span>
          <div><h1 className={styles.heading}>VibeChat</h1><small className={styles.subtitle}>One place for your conversations</small></div>
        </Link>
        <Link className={styles.back}
          href={role === 'parent' ? '/parent' : role === 'teacher' ? '/teacher/pulse' : role === 'student' ? '/student' : role === 'admin' ? '/admin' : '/vibetutor'}>
          <ArrowLeft size={16} aria-hidden/> Back
        </Link>
      </header>
      <nav className={styles.tabs} aria-label="VibeChat sections">
        {([['chats','Chats',MessageCircle],...(role==='teacher' ? [['school','School',Users] as const] : []),['contacts','Contacts',UserPlus],['enquiries','Enquiries',Users],['notices','Notices',Bell]] as const).map(([value,label,Icon]) =>
          <button key={value} type="button" className={styles.tab + (tab === value ? ' ' + styles.active : '')}
            aria-current={tab===value ? 'page' : undefined} onClick={()=>setTab(value)}>
            <Icon size={15} aria-hidden style={{verticalAlign:'middle',marginRight:6}}/>{label}{value==='notices'&&notices.some(n=>n.requiresAck&&!n.acked)?' · New':''}
          </button>)}
        <button type="button" className={styles.tab} disabled title="Calls will be added after secure Live integration">Calls · Soon</button>
      </nav>
      {signedIn===false ? <section className={styles.panel}>
        <h2>Sign in to VibeChat</h2>
        <p>Your school and tutoring conversations are private to your account.</p>
        <Link className={styles.primary} href={'/login?redirect='+encodeURIComponent('/vibechat')}>Sign in</Link>
      </section> : null}
      {signedIn===null && <p role="status">Checking your account…</p>}
      {error && <div role="alert" className={styles.error}>{error} <button type="button" onClick={()=>void load()}><RefreshCw size={14} aria-hidden/> Retry</button></div>}
      {signedIn && tab==='chats' && <section className={styles.layout} aria-label="VibeChat conversations">
        <aside className={styles.sidebar}>
          <input className={styles.search} type="search" aria-label="Search conversations"
            placeholder="Search conversations" value={search} onChange={e=>setSearch(e.target.value)} />
          <div className={styles.actionRow}>
            {role==='teacher'&&schoolMessagingAvailable&&<button type="button" className={styles.back} onClick={()=>setTab('school')}>New school message</button>}
            {role==='parent'&&<Link className={styles.back} href="/parent/messages">Choose a child's teacher</Link>}
            {role==='admin'&&<Link className={styles.back} href="/admin/communication">Manage school notices</Link>}
          </div>
          {loading?<p className={styles.empty} role="status">Loading conversations…</p>:
            filtered.length === 0 ? <div className={styles.empty}>No conversations found. Tutor enquiries appear under Enquiries.</div> :
            filtered.map(chat => <button type="button" className={styles.thread + (active===chat.key?' '+styles.selected:'')}
              key={chat.key} onClick={()=>{setActive(chat.key);setBody('')}} aria-pressed={active===chat.key}>
              <VibeChatAvatar name={chat.title} avatarUrl={chat.avatarUrl}/>
              <span className={styles.threadText}><strong>{chat.title}</strong><small>{chat.preview || chat.detail}</small>
                <span className={styles.channel}>{chat.kind==='tuition'?'Tuition':'School'}{chat.updated?' · '+stamp(chat.updated):''}</span>
              </span>
            </button>)
          }
        </aside>
        <div className={styles.conversation} data-open={selected?'true':'false'}>
          {selected ? <>
            <div className={styles.conversationHeader}>
              <div className={styles.peerHeader}><VibeChatAvatar name={selected.title} avatarUrl={selected.avatarUrl} size="large"/><div><strong>{selected.title}</strong><div className={styles.subtitle}>{otherTyping ? 'Typing…' : selected.detail}</div></div></div>
              <button type="button" className={styles.back} onClick={()=>setActive(null)} aria-label="Back to conversations"><ArrowLeft size={17} aria-hidden/> Back</button>
            </div>
            <div className={styles.messages} aria-live="polite" aria-relevant="additions text">
              {messagesLoading&&<p className={styles.empty} role="status">Loading messages…</p>}
              {!messagesLoading&&messages.length===0&&<p className={styles.empty}>No messages yet. Start the conversation.</p>}
              {messages.map(m=><div key={m.id} className={styles.bubble+(m.mine?' '+styles.mine:'')}>
                {m.body}<time className={styles.time} dateTime={m.created_at}>{stamp(m.created_at)}</time>
              </div>)}
            </div>
            {otherTyping && <p className={styles.typing} role="status" aria-live="polite"><span className={styles.typingDots} aria-hidden="true">● ● ●</span> Typing…</p>}
            {messageError && <p className={styles.error} role="alert">{messageError}</p>}
            <form className={styles.compose} onSubmit={e=>void sendMessage(e)}>
              <label htmlFor="vc-message" className="sr-only">Message</label>
              <textarea id="vc-message" value={body} maxLength={1500} rows={2}
                onChange={e=>{setBody(e.target.value);sendTyping(Boolean(e.target.value.trim()))}}
                onBlur={()=>sendTyping(false)} placeholder="Write a message" required/>
              <button className={styles.primary} disabled={sending || !body.trim()} aria-label="Send message"><Send size={18} aria-hidden/></button>
            </form>
          </> : <div className={styles.empty}>Select a conversation to read or send a message.</div>}
        </div>
      </section>}
      {signedIn&&tab==='school'&&role==='teacher'&&<VibeChatSchool onOpenThread={threadId=>{
        setTab('chats')
        setActive('vc:' + threadId)
        void load()
      }}/>}
      {signedIn&&tab==='contacts'&&<VibeChatContacts role={role} onOpenThread={threadId=>{
        setTab('chats')
        setActive('vc:' + threadId)
        void load()
      }}/>} 
      {signedIn&&tab==='enquiries'&&<section className={styles.panel} aria-label="Tutor enquiries"><Enquiries/></section>}
      {signedIn&&tab==='notices'&&<section className={styles.panel}>
        <h2>School notices</h2>
        {loading?<p role="status">Loading notices…</p>:notices.length===0?<p>No notices have been sent to you yet.</p>:
          notices.map(n=><article key={n.id} className={styles.notice}>
            <strong>{n.title}</strong><small>{stamp(n.sentAt)}</small><p>{n.body}</p>
            {n.requiresAck&&<div>{n.acked?<span>Read and acknowledged</span>:
              <button type="button" className={styles.primary} disabled={acking===n.id} onClick={()=>void acknowledge(n)}>
                {acking===n.id?'Saving…':'Acknowledge'}
              </button>}</div>}
          </article>)}
      </section>}
      <p className={styles.subtitle} style={{marginTop:12}}>Only approved contacts can exchange private tuition messages. Do not share children's personal contact details.</p>
    </div>
  </main>
}

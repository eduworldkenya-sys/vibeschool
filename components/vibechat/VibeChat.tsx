'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Bell, MessageCircle, RefreshCw, Send, Users, UserPlus, ShieldAlert, Ban, MoreVertical, SquarePen } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase'
import Enquiries from './Enquiries'
import VibeChatAvatar from './VibeChatAvatar'
import VibeChatContacts from './VibeChatContacts'
import VibeChatUsernameSearch from './VibeChatUsernameSearch'
import VibeChatSchool from './VibeChatSchool'
import VibeChatGroups from './VibeChatGroups'
import { useVibeChatTyping } from './useVibeChatTyping'
import { useVibeChatInboxUpdates } from './useVibeChatInboxUpdates'
import { useVibeChatOutbox } from './useVibeChatOutbox'
import { useVibeChatPreferences,useVibeChatOpenAppNotifications } from './useVibeChatPreferences'
import { useVibeChatWebPush } from './useVibeChatWebPush'
import styles from './VibeChat.module.css'

type Tab = 'chats' | 'contacts' | 'enquiries' | 'notices' | 'school' | 'groups'
type Chat = {
  key: string
  id: string
  kind: 'school' | 'tuition'
  title: string
  avatarUrl: string | null
  handle?: string | null
  unread?: boolean
  unreadCount?: number
  latestIncomingId?: string | null
  pinned?: boolean
  archived?: boolean
  muted?: boolean
  peerOnline?: boolean
  peerReadAt?: string | null
  peerDeliveredAt?: string | null
  detail: string
  preview: string
  updated: string | null
  schoolId: string | null
}
type Message = { id: string; body: string; mine: boolean; created_at: string; deleted_at?: string | null; edited_at?: string | null; reply_to_id?: string | null; reply_excerpt?: string | null; reactions?: {reaction:string;mine:boolean}[] }
const reactionLabels:Record<string,string>={like:'👍',love:'❤️',laugh:'😂',wow:'😮',thanks:'🙏'}
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
  const [tab, setTab] = useState<Tab>(requestedTab === 'enquiries' || requestedTab === 'notices' || requestedTab === 'contacts' || requestedTab === 'school' || requestedTab === 'groups' ? requestedTab : 'chats')
  const [uid, setUid] = useState('')
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [role, setRole] = useState('')
  const [schoolMessagingAvailable, setSchoolMessagingAvailable] = useState(false)
  const [chats, setChats] = useState<Chat[]>([])
  const [notices, setNotices] = useState<Notice[]>([])
  const [active, setActive] = useState<string | null>(requestedChat)
  const [messages, setMessages] = useState<Message[]>([])
  const [older,setOlder]=useState<Message[]>([])
  const [historyDone,setHistoryDone]=useState(false)
  const [historyBusy,setHistoryBusy]=useState(false)
  const [messageSearch,setMessageSearch]=useState('')
  const [searchResults,setSearchResults]=useState<{room:string;query:string;rows:Message[];done:boolean}|null>(null)
  const historyToken=useRef(0)
  const [roomMenu,setRoomMenu]=useState(false)
  const [body, setBody] = useState('')
  const [reply,setReply]=useState<{room:string;message:Message}|null>(null)
  const [edit,setEdit]=useState<{room:string;message:Message;body:string}|null>(null)
  const [messageMenu,setMessageMenu]=useState<string|null>(null)
  const [deleteTarget,setDeleteTarget]=useState<{room:string;message:Message}|null>(null)
  const [changing,setChanging]=useState(false)
  const [search, setSearch] = useState('')
  const [chatFilter, setChatFilter] = useState<'all' | 'school' | 'tuition' | 'archived'>('all')
  const [moreOpen, setMoreOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [acking, setAcking] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [messageError, setMessageError] = useState('')
  const [safety, setSafety] = useState<{ blocked: boolean; blocked_by_me: boolean } | null>(null)
  const [safetyBusy, setSafetyBusy] = useState(false)
  const [safetyError, setSafetyError] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('safety')
  const [refreshVersion,setRefreshVersion] = useState(0)
  const [presence,setPresence] = useState<{eligible:boolean;enabled:boolean}|null>(null)
  const [presenceBusy,setPresenceBusy] = useState(false)
  const messageReadRef=useRef(0)
  const loadingRef = useRef(false)
  const selectedRef = useRef<string | null>(null)
  selectedRef.current = tab==='chats' ? active : null

  const load = useCallback(async (background = false) => {
    if (loadingRef.current) return
    loadingRef.current = true
    const db = getSupabaseClient()
    if (!background) {setLoading(true);setError('')}
    try {
      const { data: auth, error: authError } = await db.auth.getUser()
      if (authError) throw authError
      const user = auth.user
      if (!user) { setUid('');setSignedIn(false);setChats([]);setNotices([]);setMessages([]);return }
      setUid(user.id)
      setSignedIn(true)

      const [profile, schoolMember, teacherProfile, participantResult, tutorResult, studentResult, noticeRecipients, schoolPeerResult, tuitionPeerResult, inboxResult, accessResult] = await Promise.all([
        db.from('profiles').select('role,school_id').eq('id', user.id).maybeSingle(),
        db.from('school_members').select('school_id').eq('profile_id', user.id).limit(1),
        db.from('teacher_profiles').select('school_id').eq('profile_id', user.id).maybeSingle(),
        db.from('vc_participants').select('thread_id,last_read_at').eq('profile_id', user.id).is('left_at', null),
        db.rpc('vibetutor_my_student_invites'),
        db.rpc('vibetutor_student_inbox'),
        db.from('vc_circular_recipients').select('id,circular_id,ack_at').eq('profile_id', user.id),
        db.rpc('vibechat_my_chat_peers'),
        db.rpc('vibechat_my_tuition_peers'),
        db.rpc('vibechat_my_inbox_state'),
        db.rpc('get_my_auth_access_state'),
      ])
      const access=accessResult.data
      setRole(!accessResult.error && access && typeof access==='object' && !Array.isArray(access) && typeof access.role==='string' && access.account_status==='active' && access.is_anonymized===false ? access.role : '')
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
          handle: peerMap.get(t.id)?.handle ?? null,
          unread: Boolean(t.last_message_at && t.last_message_at > (participantResult.data?.find(p=>p.thread_id===t.id)?.last_read_at ?? '')),
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
        handle: tuitionPeerMap.get(item.id)?.handle ?? null,
        detail: 'Approved private tuition', preview: '',
        updated: null, schoolId: null,
      }))
      if(inboxResult.error && !background) setError('Inbox synchronization is unavailable. The server may need an update.')
      const inboxMap = new Map((inboxResult.data ?? []).map(item=>[item.kind+':'+item.room_id,item] as const))
      const next: Chat[] = [...schoolChats,...tuitionChats].map(chat=>{
        const state=inboxMap.get(chat.key)
        return state ? {...chat,updated:state.updated??chat.updated,preview:state.preview??'',unread:state.unread>0,unreadCount:state.unread,latestIncomingId:state.latest_incoming_id,peerOnline:state.peer_online,peerReadAt:state.peer_read_at,peerDeliveredAt:state.peer_delivered_at} : chat
      })
      setChats(next.sort((a,b)=>(b.updated??'').localeCompare(a.updated??'')))

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
      loadingRef.current=false
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useVibeChatInboxUpdates(uid,()=>{void load(true);setRefreshVersion(v=>v+1)})

  useEffect(()=>{
    if(!uid) {setPresence(null);return}
    let alive=true
    void getSupabaseClient().rpc('vibechat_presence_settings',{}).then(({data,error})=>{if(alive&&!error) setPresence(data)})
    return ()=>{alive=false}
  },[uid])
  useEffect(()=>{
    if(!uid || !presence?.enabled) return
    const tick=()=>{if(document.visibilityState==='visible' && document.hasFocus()) void getSupabaseClient().rpc('vibechat_presence_tick')}
    tick()
    const timer=window.setInterval(tick,25000)
    window.addEventListener('focus',tick)
    return ()=>{window.clearInterval(timer);window.removeEventListener('focus',tick)}
  },[uid,presence?.enabled])
  async function togglePresence(){
    if(!presence?.eligible||presenceBusy) return
    setPresenceBusy(true)
    try{
      const {data,error}=await getSupabaseClient().rpc('vibechat_presence_settings',{p_enabled:!presence.enabled})
      if(error||!data) throw error
      setPresence(data)
      void load(true)
    }catch{setError('Could not update online visibility. Retry.')}
    finally{setPresenceBusy(false)}
  }
  const preferences=useVibeChatPreferences(uid,refreshVersion)
  const webPush=useVibeChatWebPush(uid,()=>setRefreshVersion(v=>v+1))
  const decoratedChats=useMemo(()=>chats.map(chat=>{
    const p=preferences.preferences.find(item=>item.room_id===chat.id&&item.kind===(chat.kind==='school'?'vc':'tuition'))
    return {...chat,pinned:p?.pinned??false,archived:p?.archived??false,muted:p?.muted??false}
  }),[chats,preferences.preferences])
  const incoming=useMemo(()=>decoratedChats.map(chat=>({key:chat.key,unread:chat.unreadCount??0,latestIncomingId:chat.latestIncomingId,muted:chat.muted})),[decoratedChats])
  useVibeChatOpenAppNotifications(uid,preferences.enabled&&!webPush.registered,incoming,preferences.ready)
  const selected = tab==='chats' ? (decoratedChats.find(chat => chat.key === active) ?? null) : null
  useEffect(()=>{
    historyToken.current++
    setOlder([]);setHistoryDone(false);setHistoryBusy(false);setMessageSearch('');setSearchResults(null);setRoomMenu(false)
  },[selected?.key,uid])
  const allMessages=useMemo(()=>[...new Map([...older,...messages].map(m=>[m.id,m])).values()].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id)),[older,messages])
  const displayedMessages=searchResults&&searchResults.room===selected?.key?searchResults.rows:allMessages
  async function loadPage(searching:boolean,more:boolean){
    if(!selected||!uid||historyBusy)return
    const chat=selected
    const query=searching?messageSearch.trim():''
    if(searching&&!query){setSearchResults(null);return}
    const token=++historyToken.current
    setHistoryBusy(true)
    const existing=searching?(searchResults?.room===chat.key&&searchResults.query===query?searchResults.rows:[]):allMessages
    const first=more?existing[0]:undefined
    try{
      const {data,error}=await getSupabaseClient().rpc('vibechat_message_page',{p_kind:chat.kind==='school'?'vc':'tuition',p_room:chat.id,p_before:first?.created_at??null,p_before_id:first?.id??null,p_query:query||null})
      if(error||!Array.isArray(data))throw error
      if(historyToken.current!==token||selectedRef.current!==chat.key)return
      const rows=data as Message[]
      if(searching)setSearchResults({room:chat.key,query,rows:[...new Map([...(more?existing:[]),...rows].map(m=>[m.id,m])).values()].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id)),done:rows.length<50})
      else {setOlder(previous=>[...new Map([...previous,...rows].map(m=>[m.id,m])).values()]);setHistoryDone(rows.length<50)}
    }catch{if(historyToken.current===token&&selectedRef.current===chat.key)setMessageError('Could not load message history. Retry.')}
    finally{if(historyToken.current===token)setHistoryBusy(false)}
  }
  async function changePreference(setting:'pinned'|'archived'|'muted'){
    if(!selected)return
    const chat=selected
    if(await preferences.update(chat.kind==='school'?'vc':'tuition',chat.id,setting,!chat[setting])){
      setRoomMenu(false)
      if(setting==='archived'){setChatFilter(chat.archived?'all':'archived');setActive(null)}
    }
  }
  const { otherTyping, sendTyping } = useVibeChatTyping(selected?.key ?? null)
  const loadMessages = useCallback(async (chat: Chat, ownerId: string) => {
    const db = getSupabaseClient()
    const read=++messageReadRef.current
    try {
      let rows: Message[]
      const rich=await db.rpc('vibechat_rich_messages',{p_kind:chat.kind==='school'?'vc':'tuition',p_room:chat.id})
      if(!rich.error && Array.isArray(rich.data)) rows=rich.data
      else if(rich.error && rich.error.code!=='PGRST202' && rich.error.code!=='42883') throw rich.error
      else if (chat.kind === 'tuition') {
        const { data, error: rpcError } = await db.rpc('vibetutor_my_lesson_messages', { p_invitation: chat.id })
        if (rpcError) throw rpcError
        rows = ((Array.isArray(data) ? data : []) as Message[]).map(m => ({
          id:m.id, body:m.body, mine: Boolean(m.mine), created_at:m.created_at,
        }))
      } else {
        const { data, error: fetchError } = await db.from('vc_messages').select('id,body,sender_id,created_at')
          .eq('thread_id', chat.id).is('deleted_at', null).order('created_at', { ascending: false }).order('id',{ascending:false}).limit(200)
        if (fetchError) throw fetchError
        rows = (data ?? []).reverse().filter(m => m.created_at).map(m => ({
          id:m.id, body:m.body, mine:m.sender_id === ownerId, created_at:m.created_at as string,
        }))
      }
      if (selectedRef.current !== chat.key || read!==messageReadRef.current) return
      setMessages(rows)
      setMessageError('')
      const incoming=[...rows].reverse().find(message=>!message.mine&&!message.deleted_at)
      if(incoming){
        const visible=document.visibilityState==='visible' && document.hasFocus()
        const receipt=await db.rpc('vibechat_ack_message',{p_kind:chat.kind==='school'?'vc':'tuition',p_room:chat.id,p_message:incoming.id,p_read:visible})
        if(!receipt.error && receipt.data && visible && selectedRef.current===chat.key) setChats(previous=>previous.map(item=>item.key===chat.key?{...item,unread:false,unreadCount:0}:item))
      }
    } catch {
      if (selectedRef.current === chat.key && read===messageReadRef.current) setMessageError('Could not load messages for this conversation.')
    }
  }, [])

  useEffect(() => {
    if (!selected || !uid) { messageReadRef.current++;setMessages([]); return }
    let running = true
    setMessages([])
    setMessageError('')
    setMessagesLoading(true)
    void loadMessages(selected, uid).finally(() => { if (running) setMessagesLoading(false) })
    return () => { running = false }
  }, [selected?.key, uid, loadMessages])

  useEffect(()=>{if(selected && uid && refreshVersion>0) void loadMessages(selected,uid)},[refreshVersion,selected?.key,uid,loadMessages])

  useEffect(() => {
    if (!selected || !uid) { setSafety(null); setSafetyError(''); return }
    const key = selected.key
    let live = true
    setSafety(null)
    setSafetyError('')
    setReportOpen(false)
    const p_kind = selected.kind === 'school' ? 'vc' : 'tuition'
    void getSupabaseClient().rpc('vibechat_thread_safety', {
      p_kind, p_room: selected.id,
    }).then(({ data, error: checkError }) => {
      if (!live || selectedRef.current !== key) return
      if (checkError || !data) {
        setSafetyError('Could not verify messaging permissions. Retry by reopening this conversation.')
      } else {
        setSafety(data)
      }
    }, () => {
      if (live && selectedRef.current === key) setSafetyError('Connection safety could not be checked.')
    })
    return () => { live = false }
  }, [selected?.key, uid])

  useEffect(()=>{
    if(!selected||!uid||refreshVersion===0) return
    let alive=true
    void getSupabaseClient().rpc('vibechat_thread_safety',{p_kind:selected.kind==='school'?'vc':'tuition',p_room:selected.id}).then(({data,error})=>{
      if(!alive||selectedRef.current!==selected.key) return
      if(error||!data){setSafety(null);setSafetyError('Could not verify messaging permissions.')}
      else setSafety(data)
    })
    return ()=>{alive=false}
  },[selected?.key,uid,refreshVersion])

  async function toggleBlock() {
    if (!selected || !safety || safetyBusy) return
    setSafetyBusy(true)
    setSafetyError('')
    try {
      const { error: blockError } = await getSupabaseClient().rpc('vibechat_block_thread', {
        p_kind: selected.kind === 'school' ? 'vc' : 'tuition',
        p_room: selected.id,
        p_block: !safety.blocked_by_me,
      })
      if (blockError) throw blockError
      setSafety({ blocked: !safety.blocked_by_me, blocked_by_me: !safety.blocked_by_me })
      sendTyping(false)
    } catch {
      setSafetyError('Could not change this block. Please retry.')
    } finally { setSafetyBusy(false) }
  }

  async function report() {
    if (!selected || !safety || safetyBusy) return
    setSafetyBusy(true)
    setSafetyError('')
    try {
      const { error: reportError } = await getSupabaseClient().rpc('vibechat_report_thread', {
        p_kind: selected.kind === 'school' ? 'vc' : 'tuition',
        p_room: selected.id,
        p_reason: reportReason,
      })
      if (reportError) throw reportError
      setReportOpen(false)
      setSafetyError('Report submitted for review.')
    } catch {
      setSafetyError('Could not submit this report. Please retry.')
    } finally { setSafetyBusy(false) }
  }

  const outbox=useVibeChatOutbox(uid,item=>{
    if(item.owner!==uid)return
    if(item.kind==='group'){setRefreshVersion(v=>v+1);return}
    const chat=chats.find(c=>c.key===item.kind+':'+item.room)
    if(chat&&selectedRef.current===chat.key)void loadMessages(chat,uid)
    void load(true)
  })
  const replyMessage=reply&&reply.room===selected?.key?reply.message:null
  const editing=edit&&edit.room===selected?.key?edit:null
  const deleting=deleteTarget&&deleteTarget.room===selected?.key?deleteTarget:null
  const pending=selected?outbox.items.filter(item=>item.room===selected.id&&item.kind===(selected.kind==='school'?'vc':'tuition')):[]

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault()
    if (!selected || !uid || !safety || safety.blocked || sending || !body.trim() || body.trim().length > 1500) return
    setSending(true)
    sendTyping(false)
    setMessageError('')
    try {
      if(!outbox.enqueue(selected.kind==='school'?'vc':'tuition',selected.id,body,replyMessage?.id??null)){
        setMessageError('Could not queue this message. Your draft is preserved.')
        return
      }
      setBody('')
      setReply(null)
    }catch{
      setMessageError('Could not queue this message. Your draft is preserved.')
    }finally{setSending(false)}
  }

  async function changeMessage(message:Message,action:'edit'|'delete'|'react',value:string|null=null){
    if(!selected||!uid||!safety||safety.blocked||changing||message.deleted_at)return
    if((action==='edit'||action==='delete')&&!message.mine)return
    const chat=selected
    setChanging(true)
    setMessageError('')
    try{
      const {data,error}=await getSupabaseClient().rpc('vibechat_change_message',{p_kind:chat.kind==='school'?'vc':'tuition',p_room:chat.id,p_message:message.id,p_action:action,p_value:value})
      if(error||!data)throw error
      if(selectedRef.current===chat.key){
        setEdit(null);setDeleteTarget(null);setMessageMenu(null)
        if(action==='delete')setReply(previous=>previous?.message.id===message.id?null:previous)
        setOlder([]);setHistoryDone(false);setSearchResults(null)
        await loadMessages(chat,uid)
      }
      void load(true)
    }catch{
      if(selectedRef.current===chat.key)setMessageError('Could not update this message. It may no longer be available.')
    }finally{setChanging(false)}
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

  const filtered=useMemo(()=>decoratedChats.filter(chat=>(chatFilter==='archived'?chat.archived:!chat.archived&&(chatFilter==='all'||chat.kind===chatFilter))&&(chat.title+' '+chat.detail+' '+(chat.handle??'')).toLowerCase().includes(search.trim().toLowerCase().replace(/^@/,''))).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||(b.updated??'').localeCompare(a.updated??'')),[decoratedChats,search,chatFilter])

  return <main className={styles.shell}>
    <div className={styles.main}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/vibechat" aria-label="VibeChat home">
          <span className={styles.logo}><MessageCircle aria-hidden size={22}/></span>
          <h1 className={styles.heading}>VibeChat</h1>
        </Link>
        <Link className={styles.back}
          href={role === 'parent' ? '/parent' : role === 'teacher' ? '/teacher/pulse' : role === 'student' ? '/student' : role === 'admin' ? '/admin' : '/vibetutor'}>
          <ArrowLeft size={16} aria-hidden/> Back
        </Link>
      </header>
      <nav className={styles.tabs} aria-label="VibeChat sections">
        <button type="button" className={styles.tab + (tab==='chats'?' '+styles.active:'')} onClick={()=>setTab('chats')}><MessageCircle size={16} aria-hidden/> Chats</button>
        <button type="button" className={styles.tab + (tab==='contacts'?' '+styles.active:'')} onClick={()=>setTab('contacts')}><UserPlus size={16} aria-hidden/> Contacts</button>
        <button type="button" className={styles.tab+(tab==='groups'?' '+styles.active:'')} onClick={()=>setTab('groups')}><Users size={16} aria-hidden/> Groups</button>
        <div className={styles.moreWrap}>
          <button type="button" className={styles.tab + (['school','enquiries','notices'].includes(tab)?' '+styles.active:'')} aria-expanded={moreOpen} aria-haspopup="true" onClick={()=>setMoreOpen(v=>!v)}><MoreVertical size={16} aria-hidden/> More {notices.some(n=>n.requiresAck&&!n.acked)?'· New':''}</button>
          {moreOpen&&<div className={styles.moreMenu}>
            {role==='teacher'&&<button type="button" onClick={()=>{setTab('school');setMoreOpen(false)}}><Users size={16} aria-hidden/> School</button>}
            <button type="button" onClick={()=>{setTab('enquiries');setMoreOpen(false)}}><Users size={16} aria-hidden/> Enquiries</button>
            <button type="button" onClick={()=>{setTab('notices');setMoreOpen(false)}}><Bell size={16} aria-hidden/> Notices</button>
            {preferences.ready&&<button type="button" aria-pressed={preferences.enabled} onClick={()=>void preferences.toggleNotifications()}>Message alerts: {preferences.enabled?'On':'Off'}</button>}
            {preferences.ready&&webPush.configured&&<button type="button" aria-pressed={webPush.registered} disabled={webPush.busy} onClick={()=>void webPush.toggle()}>Background alerts on this device: {webPush.registered?'On':'Off'}</button>}
            {presence?.eligible && <button type="button" aria-pressed={presence.enabled} disabled={presenceBusy} onClick={()=>void togglePresence()}>Online visibility: {presence.enabled?'On':'Off'}</button>}
          </div>}
        </div>
      </nav>
      {signedIn===false ? <section className={styles.panel}>
        <h2>Sign in to VibeChat</h2>
        <p>Your school and tutoring conversations are private to your account.</p>
        <div className={styles.actionRow}>
          <Link className={styles.primary} href={'/login/teacher?redirect='+encodeURIComponent('/vibechat')}>Teacher</Link>
          <Link className={styles.back} href={'/login/parent?redirect='+encodeURIComponent('/vibechat')}>Parent</Link>
          <Link className={styles.back} href={'/login/student?redirect='+encodeURIComponent('/vibechat')}>Learner</Link>
        </div>
      </section> : null}
      {signedIn===null && <p role="status">Checking your account…</p>}
      {webPush.error&&signedIn&&<p className={styles.error} role="status">{webPush.error}</p>}
      {preferences.error&&signedIn&&<p role="status" className={styles.error}>{preferences.error}</p>}
      {error && <div role="alert" className={styles.error}>{error} <button type="button" onClick={()=>void load()}><RefreshCw size={14} aria-hidden/> Retry</button></div>}
      {signedIn && tab==='chats' && <section className={styles.layout} aria-label="VibeChat conversations">
        <aside className={styles.sidebar}>
          <div className={styles.searchRow}>
            <input className={styles.search} type="search" aria-label="Search chats or username"
              placeholder="Search chats or username" value={search} onChange={e=>setSearch(e.target.value)} />
            <button type="button" className={styles.newChat} aria-label="Find a contact" title="New conversation" onClick={()=>{setActive(null);setTab('contacts')}}><SquarePen size={19} aria-hidden/></button>
          </div>
          <VibeChatUsernameSearch query={search} role={role} onOpenThread={threadId=>{setSearch('');setActive('vc:'+threadId);void load()}} />
          <div className={styles.filters} aria-label="Conversation filters">
            {(['all','school','tuition','archived'] as const).map(filter=><button type="button" key={filter}
              aria-pressed={chatFilter===filter} className={styles.filter + (chatFilter===filter?' '+styles.filterActive:'')}
              onClick={()=>setChatFilter(filter)}>{filter==='all'?'All':filter==='school'?'School':filter==='tuition'?'Tuition':'Archived'}</button>)}
          </div>
          <div className={styles.actionRow}>
            {role==='teacher'&&schoolMessagingAvailable&&<button type="button" className={styles.back} onClick={()=>setTab('school')}>New school message</button>}
            {role==='parent'&&<Link className={styles.back} href="/parent/messages">Choose a child's teacher</Link>}
            {role==='admin'&&<Link className={styles.back} href="/admin/communication">Manage school notices</Link>}
          </div>
          {loading?<p className={styles.empty} role="status">Loading conversations…</p>:
            filtered.length === 0 ? <div className={styles.empty}>{search.trim() ? 'No matching conversations' : 'No conversations yet'}</div> :
            filtered.map(chat => <button type="button" className={styles.thread + (active===chat.key?' '+styles.selected:'')}
              key={chat.key} onClick={()=>{setActive(chat.key);setBody('')}} aria-pressed={active===chat.key}>
              <VibeChatAvatar name={chat.title} avatarUrl={chat.avatarUrl}/>
              <span className={styles.threadText}><span className={styles.threadTop}><strong>{chat.pinned?'Pinned · ':''}{chat.title}{chat.muted?' · Muted':''}{chat.unread && <span className={styles.unreadDot} aria-label={(chat.unreadCount??1)+' unread messages'}>{chat.unreadCount??1}</span>}</strong><time className={styles.threadDate}>{stamp(chat.updated)}</time></span>
                <small>{chat.preview || chat.detail}</small><span className={styles.channel}>{chat.kind==='tuition'?'Tuition':'School'}</span>
              </span>
            </button>)
          }
        </aside>
        <div className={styles.conversation} data-open={selected?'true':'false'}>
          {selected ? <>
            <div className={styles.conversationHeader}>
              <div className={styles.peerHeader}><VibeChatAvatar name={selected.title} avatarUrl={selected.avatarUrl} size="large"/><div><strong>{selected.title}</strong><div className={styles.subtitle}>{otherTyping ? 'Typing…' : selected.peerOnline ? 'Online' : selected.detail}</div></div></div>
              <div className={styles.contactRow}>
                <button type="button" className={styles.back} aria-label="Conversation settings" aria-expanded={roomMenu} disabled={!preferences.ready} onClick={()=>setRoomMenu(v=>!v)}><MoreVertical size={17}/></button>
                <button type="button" className={styles.back} disabled={!safety || safetyBusy || (safety.blocked && !safety.blocked_by_me)}
                  onClick={()=>void toggleBlock()}><Ban size={15} aria-hidden/> {safety?.blocked_by_me?'Unblock':'Block'}</button>
                <button type="button" className={styles.back} disabled={!safety || safetyBusy}
                  onClick={()=>setReportOpen(value=>!value)}><ShieldAlert size={15} aria-hidden/> Report</button>
                <button type="button" className={styles.back} onClick={()=>setActive(null)} aria-label="Back to conversations"><ArrowLeft size={17} aria-hidden/> Back</button>
              </div>
            </div>
            {roomMenu&&<div className={styles.actionPanel}>
              <button type="button" onClick={()=>void changePreference('pinned')}>{selected.pinned?'Unpin':'Pin'}</button>
              <button type="button" onClick={()=>void changePreference('muted')}>{selected.muted?'Unmute':'Mute'}</button>
              <button type="button" onClick={()=>void changePreference('archived')}>{selected.archived?'Unarchive':'Archive'}</button>
            </div>}
            <form className={styles.actionPanel} role="search" onSubmit={e=>{e.preventDefault();void loadPage(true,false)}}>
              <input className={styles.search} type="search" aria-label="Search messages in this conversation" placeholder="Find in conversation" value={messageSearch} maxLength={100} onChange={e=>{historyToken.current++;setHistoryBusy(false);setMessageSearch(e.target.value);setSearchResults(null)}}/>
              <button type="submit" disabled={historyBusy||!messageSearch.trim()}>Find</button>
              {searchResults&&<button type="button" onClick={()=>{historyToken.current++;setHistoryBusy(false);setSearchResults(null);setMessageSearch('')}}>Close search</button>}
            </form>
            <div className={styles.messages} aria-live="polite" aria-relevant="additions text">
              {!searchResults&&!historyDone&&allMessages.length>0&&<button className={styles.back} type="button" disabled={historyBusy} onClick={()=>void loadPage(false,true)}>{historyBusy?'Loading…':'Load older messages'}</button>}
              {searchResults&&!searchResults.done&&<button className={styles.back} type="button" disabled={historyBusy} onClick={()=>void loadPage(true,true)}>More results</button>}
              {searchResults&&searchResults.rows.length===0&&<p className={styles.empty}>No matching messages.</p>}
              {messagesLoading&&<p className={styles.empty} role="status">Loading messages…</p>}
              {!messagesLoading&&!searchResults&&allMessages.length===0&&pending.length===0&&<p className={styles.empty}>No messages yet. Start the conversation.</p>}
              {displayedMessages.map(m=><div key={m.id} className={styles.bubble+(m.mine?' '+styles.mine:'')}>
                {m.reply_excerpt&&!m.deleted_at&&<div className={styles.replyQuote}>{m.reply_excerpt}</div>}
                <span className={m.deleted_at?styles.deletedMessage:undefined}>{m.body}</span>
                <time className={styles.time} dateTime={m.created_at}>{stamp(m.created_at)}{m.edited_at&&!m.deleted_at?' · Edited':''}{m.mine&&!m.deleted_at && <span className={styles.receipt}> · {selected.peerReadAt && Date.parse(selected.peerReadAt)>=Date.parse(m.created_at)?'Read':selected.peerDeliveredAt && Date.parse(selected.peerDeliveredAt)>=Date.parse(m.created_at)?'Delivered':'Sent'}</span>}</time>
                {!m.deleted_at&&<>
                  {!!m.reactions?.length&&<div className={styles.reactions}>{m.reactions.map((rx,i)=><button key={i} type="button" aria-label={rx.mine?'Remove '+rx.reaction:rx.reaction} disabled={!rx.mine||!safety||safety.blocked||changing} onClick={()=>void changeMessage(m,'react',null)}>{reactionLabels[rx.reaction]??rx.reaction}</button>)}</div>}
                  {safety&&!safety.blocked&&<button type="button" className={styles.messageOptions} aria-expanded={messageMenu===m.id} aria-label="Message actions" onClick={()=>setMessageMenu(previous=>previous===m.id?null:m.id)}><MoreVertical size={16}/></button>}
                  {messageMenu===m.id&&safety&&!safety.blocked&&<div className={styles.messageActions}>
                    <button type="button" onClick={()=>{setReply({room:selected.key,message:m});setMessageMenu(null);setEdit(null)}}>Reply</button>
                    {m.mine&&Date.now()-Date.parse(m.created_at)<15*60*1000&&<button type="button" onClick={()=>{setEdit({room:selected.key,message:m,body:m.body});setMessageMenu(null)}}>Edit</button>}
                    {m.mine&&<button type="button" onClick={()=>{setDeleteTarget({room:selected.key,message:m});setMessageMenu(null)}}>Delete</button>}
                    <div className={styles.reactions}>{Object.entries(reactionLabels).map(([key,label])=><button type="button" key={key} aria-label={'React '+key} disabled={changing} aria-pressed={m.reactions?.some(rx=>rx.mine&&rx.reaction===key)??false} onClick={()=>void changeMessage(m,'react',m.reactions?.some(rx=>rx.mine&&rx.reaction===key)?null:key)}>{label}</button>)}</div>
                  </div>}
                </>}
              </div>)}
              {!searchResults&&pending.map(item=><div key={item.id} className={styles.bubble+' '+styles.mine}>
                {item.replyTo&&<div className={styles.replyQuote}>Reply</div>}{item.body}
                <time className={styles.time} dateTime={new Date(item.createdAt).toISOString()}>{stamp(new Date(item.createdAt).toISOString())} · {item.failed?'Needs attention':!outbox.online?'Queued offline':item.attempts>0?'Retrying…':'Sending…'}</time>
                {item.failed&&<div className={styles.actionRow}>
                  <button type="button" className={styles.back} disabled={!safety||safety.blocked} onClick={()=>outbox.retry(item.id)}>Retry</button>
                  <button type="button" className={styles.back} onClick={()=>outbox.discard(item.id)}>Remove</button>
                </div>}
              </div>)}
            </div>
            {!outbox.online&&<p className={styles.subtitle} role="status">Offline · messages will send when you reconnect.</p>}
            {!outbox.storageAvailable&&pending.length>0&&<p className={styles.error} role="alert">Messages are queued in memory only. Keep this tab open until they send.</p>}
            {otherTyping && !safety?.blocked && <p className={styles.typing} role="status" aria-live="polite"><span className={styles.typingDots} aria-hidden="true">● ● ●</span> Typing…</p>}
            {reportOpen && <div className={styles.actionRow}>
              <label htmlFor="vc-report-reason" className={styles.subtitle}>Why are you reporting this conversation?</label>
              <select id="vc-report-reason" className={styles.search} style={{width:'auto',margin:0}}
                value={reportReason} onChange={e=>setReportReason(e.target.value)}>
                <option value="safety">Safety concern</option>
                <option value="harassment">Harassment</option>
                <option value="spam">Spam</option>
                <option value="other">Other</option>
              </select>
              <button type="button" className={styles.primary} disabled={safetyBusy} onClick={()=>void report()}>Submit report</button>
            </div>}
            {safety?.blocked && <p role="status" className={styles.empty}>This conversation is blocked. Messages are preserved.</p>}
            {!safety && <p role="status" className={styles.subtitle}>Checking messaging permissions…</p>}
            {safetyError && <p role="status" className={styles.error}>{safetyError}</p>}
            {messageError && <p className={styles.error} role="alert">{messageError}</p>}
            {deleting&&<div className={styles.actionPanel} role="alert">Delete this message for everyone? <button type="button" disabled={changing} onClick={()=>void changeMessage(deleting.message,'delete')}>Delete</button><button type="button" onClick={()=>setDeleteTarget(null)}>Cancel</button></div>}
            {editing&&<form className={styles.actionPanel} onSubmit={e=>{e.preventDefault();void changeMessage(editing.message,'edit',editing.body)}}>
              <label htmlFor="vc-edit">Edit message</label><textarea id="vc-edit" value={editing.body} maxLength={1500} onChange={e=>setEdit(previous=>previous?{...previous,body:e.target.value}:previous)}/>
              <button type="submit" disabled={changing||!editing.body.trim()||!safety||safety.blocked}>Save</button><button type="button" onClick={()=>setEdit(null)}>Cancel</button>
            </form>}
            {replyMessage&&<div className={styles.replyQuote}>Replying to: {replyMessage.body}<button type="button" onClick={()=>setReply(null)} aria-label="Cancel reply">×</button></div>}
            <form className={styles.compose} onSubmit={e=>void sendMessage(e)}>
              <label htmlFor="vc-message" className="sr-only">Message</label>
              <textarea id="vc-message" value={body} maxLength={1500} rows={2}
                onChange={e=>{setBody(e.target.value);if(safety && !safety.blocked)sendTyping(Boolean(e.target.value.trim()))}}
                onBlur={()=>sendTyping(false)} placeholder={safety?.blocked?'Conversation blocked':'Write a message'} disabled={!safety || safety.blocked} required/>
              <button className={styles.primary} disabled={sending || !safety || safety.blocked || !body.trim()} aria-label="Send message"><Send size={18} aria-hidden/></button>
            </form>
          </> : <div className={styles.empty}>Select a conversation to read or send a message.</div>}
        </div>
      </section>}
      {signedIn&&tab==='groups'&&<VibeChatGroups key={uid} owner={uid} refreshVersion={refreshVersion} refresh={()=>setRefreshVersion(v=>v+1)} outbox={outbox}/>}
      {signedIn&&tab==='school'&&role==='teacher'&&<VibeChatSchool onOpenThread={threadId=>{
        setTab('chats')
        setSearch('')
        setActive('vc:' + threadId)
        void load()
      }}/>}
      {signedIn&&tab==='contacts'&&<VibeChatContacts role={role} refreshVersion={refreshVersion} initialQuery={search} onOpenThread={threadId=>{
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
      
    </div>
  </main>
}

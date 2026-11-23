'use client'

import { useCallback, useEffect, useState } from 'react'
import { MessageCircle, RefreshCw, ShieldCheck } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase'
import VibeChatAvatar from './VibeChatAvatar'
import styles from './VibeChat.module.css'

type FamilyContact = {
  student_id: string
  student_name: string
  parent_id: string
  parent_name: string
  avatar_url: string | null
}

export default function VibeChatSchool({ onOpenThread }: {
  onOpenThread: (threadId: string) => void
}) {
  const [contacts, setContacts] = useState<FamilyContact[]>([])
  const [search, setSearch] = useState('')
  const [contextTag, setContextTag] = useState<'general'|'question'|'urgent'|'concern'>('general')
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: lookupError } = await getSupabaseClient()
        .rpc('vibechat_my_school_families')
      if (lookupError) throw lookupError
      setContacts(Array.isArray(data) ? data as FamilyContact[] : [])
    } catch {
      setError('School-family contacts are unavailable. Retry to check your connection.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  async function message(contact: FamilyContact) {
    if (opening) return
    setError('')
    setOpening(contact.parent_id + ':' + contact.student_id)
    try {
      const { data, error: startError } = await getSupabaseClient().rpc('vibechat_start_teacher_parent_thread', {
        p_student_id: contact.student_id,
        p_parent_id: contact.parent_id,
        p_context_tag: contextTag,
      })
      if (startError || !data) throw startError || new Error('Thread unavailable')
      onOpenThread(data)
    } catch {
      setError('Could not open this family conversation. Check your school assignment and retry.')
    } finally { setOpening(null) }
  }

  const filtered = contacts.filter(c=>
    (c.parent_name + ' ' + c.student_name).toLowerCase().includes(search.trim().toLowerCase())
  )

  return <section className={styles.panel} aria-label="School-family messaging">
    <header style={{display:'grid',gap:6,marginBottom:16}}>
      <h2 style={{margin:0}}>School contacts</h2>
      <p className={styles.subtitle} style={{margin:0}}>Message parents linked to learners in your assigned classes.</p>
      <p className={styles.subtitle} style={{margin:0}}><ShieldCheck size={13} aria-hidden/> Class and guardian access is checked every time a chat opens.</p>
    </header>
    <label htmlFor="vc-school-search" className={styles.subtitle}>Find a parent or learner in your classes</label>
    <input id="vc-school-search" type="search" className={styles.search} style={{margin:'8px 0 12px',width:'100%'}}
      placeholder="Search assigned families" value={search} onChange={e=>setSearch(e.target.value)} />
    <div className={styles.tabs} aria-label="Message context">
      {(['general','question','urgent','concern'] as const).map(value=>
        <button type="button" key={value} aria-pressed={contextTag===value}
          onClick={()=>setContextTag(value)} className={styles.tab+(contextTag===value?' '+styles.active:'')}>
          {value==='general'?'General':value==='question'?'Question':value==='urgent'?'Urgent':'Concern'}
        </button>)}
    </div>
    {loading?<p role="status">Loading school contacts…</p>:filtered.length===0?
      <p className={styles.empty}>{contacts.length===0?'No linked guardians were found in your assigned classes.':'No matching families found.'}</p>:
      filtered.map(contact=><article key={contact.student_id+':'+contact.parent_id} className={styles.thread}>
        <VibeChatAvatar name={contact.parent_name} avatarUrl={contact.avatar_url}/>
        <div className={styles.threadText}>
          <strong>{contact.parent_name}</strong>
          <small>Guardian of {contact.student_name}</small>
        </div>
        <button type="button" className={styles.primary} disabled={!!opening}
          onClick={()=>void message(contact)} aria-label={'Message '+contact.parent_name+' about '+contact.student_name}>
          <MessageCircle size={16} aria-hidden/> {opening===contact.parent_id+':'+contact.student_id?'Opening…':'Chat'}
        </button>
      </article>)}
    {error&&<p role="alert" className={styles.error}>{error} <button type="button" className={styles.back} onClick={()=>void load()}><RefreshCw size={14} aria-hidden/> Retry</button></p>}
  </section>
}

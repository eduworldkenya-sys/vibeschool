'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Link2, X } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase'
import styles from './VibeChat.module.css'
import VibeChatAvatar from './VibeChatAvatar'
import VibeChatUsernameSearch from './VibeChatUsernameSearch'

type Connection = {
  id: string
  name: string
  handle: string
  avatar_url: string | null
  direction: 'incoming' | 'outgoing'
  status: 'pending' | 'accepted' | 'declined'
  thread_id: string | null
  created_at: string
}

export default function VibeChatContacts({
  role,
  onOpenThread,
}: { role: string; onOpenThread: (threadId: string) => void }) {
  const params = useSearchParams()
  const suggestedHandle = params.get('find') ?? ''
  const [myHandle, setMyHandle] = useState('')
  const [lookupText, setLookupText] = useState('')
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const mayInvite = ['teacher', 'parent', 'admin'].includes(role)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const db = getSupabaseClient()
      const [handleResult, connectionsResult] = await Promise.all([
        db.rpc('vibechat_my_handle'),
        db.rpc('vibechat_my_contacts'),
      ])
      if (handleResult.error || connectionsResult.error) throw new Error('contacts unavailable')
      setMyHandle(handleResult.data ?? '')
      setConnections((connectionsResult.data ?? []) as Connection[])
    } catch {
      setError('Contacts are not available. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    if (/^@[a-z0-9][a-z0-9.]{2,30}$/i.test(suggestedHandle)) setLookupText(suggestedHandle)
  }, [suggestedHandle])

  async function respond(connection: Connection, accept: boolean) {
    if (busy || connection.direction !== 'incoming' || connection.status !== 'pending') return
    setBusy(connection.id)
    setError('')
    try {
      const { data: threadId, error: responseError } = await getSupabaseClient().rpc('vibechat_respond_contact', {
        p_request: connection.id, p_accept: accept,
      })
      if (responseError) throw responseError
      setNotice(accept ? 'Contact accepted.' : 'Contact declined.')
      await refresh()
      if (accept && threadId) onOpenThread(threadId)
    } catch {
      setError('Could not update this request. Please retry.')
    } finally {
      setBusy(null)
    }
  }

  return <section className={styles.panel} aria-label="VibeChat contacts" style={{display:'grid',gap:16}}>
    <header>
      <h2 style={{margin:'0 0 4px'}}>Contacts</h2>
      <p className={styles.subtitle}>Connect by VibeChat ID, not a phone number.</p>
    </header>
    {loading ? <p role="status">Loading your contacts…</p> : <>
      <div className={styles.contactBlock}>
        <span className={styles.subtitle}>Your VibeChat ID</span>
        <div className={styles.contactRow}>
          <strong>{myHandle || 'Unavailable'}</strong>
          <button type="button" className={styles.back} disabled={!myHandle}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(myHandle)
                setNotice('VibeChat ID copied.')
              } catch { setError('Could not copy the ID on this device.') }
            }}><Copy size={15} aria-hidden/> Copy ID</button>
          <button type="button" className={styles.back} disabled={!myHandle} onClick={async()=>{
            try {
              const share = new URL('/vibechat', window.location.origin)
              share.searchParams.set('tab','contacts')
              share.searchParams.set('find',myHandle)
              await navigator.clipboard.writeText(share.toString())
              setNotice('Connection link copied.')
            } catch { setError('Could not copy the connection link.') }
          }}><Link2 size={15} aria-hidden/> Share link</button>
        </div>
        <small className={styles.subtitle}>Sharing your ID does not give strangers permission to message you.</small>
      </div>
      {mayInvite ? <div className={styles.contactBlock}>
        <label htmlFor="vc-handle"><strong>Find by username</strong></label>
        <input id="vc-handle" type="search" className={styles.search} placeholder="Search username"
          autoComplete="off" value={lookupText} maxLength={32} onChange={e=>setLookupText(e.target.value)} />
        <VibeChatUsernameSearch query={lookupText} role={role} onRequested={()=>void refresh()} />
      </div> : <p className={styles.subtitle}>To connect with a new tutor, use your parent or guardian account. Existing approved learning conversations remain available.</p>}
      <section aria-label="Connection requests">
        <h3>Connections</h3>
        {connections.filter(c=>c.status!=='declined').length===0 ? <p className={styles.subtitle}>No connections or requests yet.</p> :
          connections.filter(c=>c.status!=='declined').map(c=><article className={styles.contactRow} key={c.id}>
            <VibeChatAvatar name={c.name} avatarUrl={c.avatar_url}/>
            <span style={{flex:1,minWidth:0}}>
              <strong>{c.name}</strong><span className={styles.subtitle} style={{display:'block'}}>{c.handle} · {c.status==='pending'?(c.direction==='incoming'?'Wants to connect':'Request sent'):'Connected'}</span>
            </span>
            {c.status==='pending'&&c.direction==='incoming'? <>
              <button type="button" disabled={!!busy} className={styles.primary} onClick={()=>void respond(c,true)}>
                <Check size={16} aria-hidden/> Accept</button>
              <button type="button" disabled={!!busy} className={styles.back} onClick={()=>void respond(c,false)}>
                <X size={16} aria-hidden/> Decline</button>
            </> : c.status==='accepted'&&c.thread_id?
              <button type="button" className={styles.back} onClick={()=>onOpenThread(c.thread_id!)}>Chat</button> : null}
          </article>)}
      </section>
    </>}
    {notice&&<p role="status">{notice}</p>}
    {error&&<p className={styles.error} role="alert">{error} <button type="button" onClick={()=>void refresh()}>Retry</button></p>}
  </section>
}

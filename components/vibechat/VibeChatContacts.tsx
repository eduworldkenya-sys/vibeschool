'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Search, UserPlus, X } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase'
import styles from './VibeChat.module.css'

type Lookup = { handle: string; display_name: string; account_role: string }
type Connection = {
  id: string
  name: string
  handle: string
  direction: 'incoming' | 'outgoing'
  status: 'pending' | 'accepted' | 'declined'
  thread_id: string | null
  created_at: string
}

export default function VibeChatContacts({
  role,
  onOpenThread,
}: { role: string; onOpenThread: (threadId: string) => void }) {
  const [myHandle, setMyHandle] = useState('')
  const [lookupText, setLookupText] = useState('')
  const [found, setFound] = useState<Lookup | null>(null)
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [looking, setLooking] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const mayInvite = ['teacher', 'parent', 'admin'].includes(role)

  const refresh = useCallback(async () => {
    const db = getSupabaseClient()
    setError('')
    const [handleResult, connectionsResult] = await Promise.all([
      db.rpc('vibechat_my_handle'),
      db.rpc('vibechat_my_contacts'),
    ])
    if (handleResult.error || connectionsResult.error) {
      setError('Contacts are not available. Check your connection and try again.')
    } else {
      setMyHandle(handleResult.data ?? '')
      setConnections((connectionsResult.data ?? []) as Connection[])
    }
    setLoading(false)
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  async function lookup(event: React.FormEvent) {
    event.preventDefault()
    if (!mayInvite) return
    setFound(null)
    setNotice('')
    setError('')
    const input = lookupText.trim().toLowerCase()
    if (!/^@[a-z0-9][a-z0-9.]{2,30}$/.test(input)) {
      setError('Enter an exact VibeChat ID, for example @mumbi.4821')
      return
    }
    setLooking(true)
    const { data, error: lookupError } = await getSupabaseClient().rpc('vibechat_lookup_handle', { p_handle: input })
    setLooking(false)
    if (lookupError) setError('Could not search for this contact. Try again.')
    else if (!data?.length) setNotice('Contact not found or not available to you.')
    else setFound(data[0] as Lookup)
  }

  async function invite() {
    if (!found || busy) return
    setBusy('invite')
    setError('')
    const { error: requestError } = await getSupabaseClient().rpc('vibechat_request_contact', { p_handle: found.handle })
    if (requestError) setError('Could not send this request. It may already exist or your request limit was reached.')
    else {
      setNotice('Connection request recorded. Chat opens after acceptance.')
      setFound(null)
      await refresh()
    }
    setBusy(null)
  }

  async function respond(connection: Connection, accept: boolean) {
    if (busy || connection.direction !== 'incoming' || connection.status !== 'pending') return
    setBusy(connection.id)
    setError('')
    const { data: threadId, error: responseError } = await getSupabaseClient().rpc('vibechat_respond_contact', {
      p_request: connection.id, p_accept: accept,
    })
    if (responseError) setError('Could not update this request. Please retry.')
    else {
      setNotice(accept ? 'Contact accepted.' : 'Contact declined.')
      await refresh()
      if (accept && threadId) onOpenThread(threadId)
    }
    setBusy(null)
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
            }}><Copy size={15} aria-hidden/> Copy</button>
        </div>
        <small className={styles.subtitle}>Sharing your ID does not give strangers permission to message you.</small>
      </div>
      {mayInvite ? <form onSubmit={e=>void lookup(e)} className={styles.contactBlock}>
        <label htmlFor="vc-handle"><strong>Find someone by ID</strong></label>
        <p className={styles.subtitle}>Available contacts include published tutors and authorized colleagues in your school.</p>
        <div className={styles.contactRow}>
          <input id="vc-handle" type="search" className={styles.search} style={{margin:0,flex:1,minWidth:0,width:'auto'}}
            placeholder="@username.1234" autoComplete="off" value={lookupText}
            maxLength={40} onChange={e=>setLookupText(e.target.value)} />
          <button className={styles.primary} disabled={looking || !lookupText.trim()}>
            <Search size={17} aria-hidden/> {looking?'Finding…':'Find'}
          </button>
        </div>
        {found && <div className={styles.contactRow}>
          <div style={{flex:1}}><strong>{found.display_name}</strong>
            <div className={styles.subtitle}>{found.handle} · {found.account_role}</div></div>
          <button type="button" className={styles.primary} disabled={busy==='invite'} onClick={()=>void invite()}>
            <UserPlus size={16} aria-hidden/> Connect
          </button>
        </div>}
      </form> : <p className={styles.subtitle}>To connect with a new tutor, use your parent or guardian account. Existing approved learning conversations remain available.</p>}
      <section aria-label="Connection requests">
        <h3>Connections</h3>
        {connections.filter(c=>c.status!=='declined').length===0 ? <p className={styles.subtitle}>No connections or requests yet.</p> :
          connections.filter(c=>c.status!=='declined').map(c=><article className={styles.contactRow} key={c.id}>
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

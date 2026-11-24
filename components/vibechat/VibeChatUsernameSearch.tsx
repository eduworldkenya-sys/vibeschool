'use client'

import { useEffect, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase'
import styles from './VibeChat.module.css'
import VibeChatAvatar from './VibeChatAvatar'

type Match = { handle: string; display_name: string; account_role: string; avatar_url: string | null }

export default function VibeChatUsernameSearch({query, role, onRequested, onOpenThread}: {
  query: string; role: string; onRequested?: () => void; onOpenThread?: (threadId: string) => void
}) {
  const input = query.trim().toLowerCase().replace(/^@/, '')
  const valid = /^[a-z0-9][a-z0-9._]{2,30}$/.test(input)
  const [result, setResult] = useState<{input: string; rows: Match[]; error: boolean} | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [sent, setSent] = useState<string[]>([])
  const [requestError, setRequestError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    setResult(null)
    if (!valid) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const {data, error} = await getSupabaseClient().rpc('vibechat_search_handles', {p_query: input})
        if (error) throw error
        if (!cancelled) setResult({input, rows: data ?? [], error: false})
      } catch {
        if (!cancelled) setResult({input, rows: [], error: true})
      }
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [input, valid, role, retry])

  async function connect(handle: string) {
    if (!valid || busy || !result || result.input !== input ||
      !result.rows.some(row => row.handle === handle)) return
    setBusy(handle)
    setRequestError('')
    try {
      const {data, error} = await getSupabaseClient().rpc('vibechat_open_or_request_contact', {p_handle: handle})
      if (error) throw error
      if (data) { onOpenThread?.(data); return }
      setSent(previous => [...previous, handle])
      onRequested?.()
    } catch {
      setRequestError('Could not send connection request. Please try again.')
    } finally { setBusy(null) }
  }

  if (!valid) return null
  const current = result?.input === input ? result : null
  return <section aria-label="Matching usernames" className={styles.contactBlock}>
    <strong>People</strong>
    {!current ? <small role="status">Searching…</small> :
      current.error ? <div role="alert">Search unavailable. <button type="button" className={styles.back} onClick={()=>setRetry(n=>n+1)}>Retry</button></div> :
      current.rows.length === 0 ? <small role="status">No matching available usernames.</small> :
      current.rows.map(row => <div className={styles.contactRow} key={row.handle}>
        <VibeChatAvatar name={row.display_name} avatarUrl={row.avatar_url}/>
        <div style={{flex:1,minWidth:0,overflowWrap:'anywhere'}}>
          <strong>{row.display_name}</strong><div className={styles.subtitle}>{row.handle}</div>
        </div>
        <button type="button" className={styles.primary} disabled={!!busy || sent.includes(row.handle)}
          onClick={()=>void connect(row.handle)}><UserPlus size={16} aria-hidden/> {sent.includes(row.handle)?'Requested':busy===row.handle?'Sending…':'Chat'}</button>
      </div>)}
    {requestError && <small role="alert">{requestError}</small>}
  </section>
}

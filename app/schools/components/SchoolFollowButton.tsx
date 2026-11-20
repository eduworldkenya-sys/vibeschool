'use client'

import { useEffect, useState } from 'react'
import { BellPlus, Check, LoaderCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { schoolUrl } from '@/lib/school-urls'
import styles from './SchoolFollowButton.module.css'

type FollowState = 'loading' | 'visitor' | 'following' | 'not-following'

export default function SchoolFollowButton({ slug, initialStatus, compact=false }: { slug: string; initialStatus?: FollowState; compact?: boolean }) {
  const [status, setStatus] = useState<FollowState>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setStatus('loading')
    setError('')
    if (initialStatus !== undefined) { setStatus(initialStatus); return () => { active = false } }
    void (async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (!active) return
        if (!user) {
          setStatus(authError && authError.name !== 'AuthSessionMissingError' ? 'not-following' : 'visitor')
          return
        }
        const { data, error: readError } = await supabase.from('school_follows')
          .select('school_slug').eq('school_slug', slug).eq('follower_id', user.id).maybeSingle()
        if (!active) return
        if (readError) { setError('Unable to check follow status.'); setStatus('not-following') }
        else setStatus(data ? 'following' : 'not-following')
      } catch {
        if (active) { setError('Unable to check follow status.'); setStatus('not-following') }
      }
    })()
    return () => { active = false }
  }, [slug, initialStatus])

  async function toggleFollow() {
    if (busy || status === 'loading') return
    setBusy(true)
    setError('')
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (!user) {
        if (authError && authError.name !== 'AuthSessionMissingError') {
          setError('Connection failed. Try again.')
          return
        }
        window.location.assign('/login?redirect=' + encodeURIComponent(schoolUrl(slug)))
        return
      }
      const following = status === 'following'
      const result = following
        ? await supabase.from('school_follows').delete().eq('school_slug', slug).eq('follower_id', user.id)
        : await supabase.from('school_follows').insert({ school_slug: slug, follower_id: user.id })
      if (result.error) {
        if (!following && result.error.code === '23505') setStatus('following')
        else setError('Could not update. Try again.')
        return
      }
      setStatus(following ? 'not-following' : 'following')
    } catch {
      setError('Could not update. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const following = status === 'following'
  return <div className={styles.followControl}>
    <button type="button" className={following ? styles.active : styles.button} onClick={() => void toggleFollow()}
      disabled={status === 'loading' || busy} aria-pressed={following} aria-label={following ? 'Unfollow school' : 'Follow school'}>
      {busy || status === 'loading' ? <LoaderCircle size={17} aria-hidden="true" className={styles.spin}/>
        : following ? <Check size={17} aria-hidden="true"/> : <BellPlus size={17} aria-hidden="true"/>}
      <span>{following ? 'Following' : compact ? 'Follow' : 'Follow school'}</span>
    </button>
    {error && <span role="alert" className={styles.error}>{error}</span>}
  </div>
}

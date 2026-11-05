'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase'
import styles from '@/components/vibetutor/VibeTutor.module.css'

type AccountState = 'loading' | 'guest' | 'signed-in' | 'error'
export default function TutorAccountPage() {
  const [state, setState] = useState<AccountState>('loading')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [hasListing, setHasListing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const client = getSupabaseClient()
        const { data: auth, error: authError } = await client.auth.getUser()
        if (!active) return
        if (authError) throw authError
        if (!auth.user) { setState('guest'); return }
        const [{ data: profile }, { data: listing, error: listingError }] = await Promise.all([
          client.from('profiles').select('full_name').eq('id', auth.user.id).maybeSingle(),
          client.from('vibetutor_tutors').select('profile_id,display_name').eq('profile_id', auth.user.id).maybeSingle(),
        ])
        if (!active) return
        if (listingError) throw listingError
        const metadata = auth.user.user_metadata || {}
        setHasListing(!!listing)
        setName(listing?.display_name || profile?.full_name || String(metadata.full_name || metadata.name || 'Account'))
        setEmail(auth.user.email || '')
        setState('signed-in')
      } catch {
        if (active) setState('error')
      }
    }
    void load()
    return () => { active = false }
  }, [])

  async function signOut() {
    setError('')
    const { error: signOutError } = await getSupabaseClient().auth.signOut()
    if (signOutError) { setError('Could not sign out. Please retry.'); return }
    window.location.assign('/vibetutor/account')
  }

  return (
    <section className={styles.formWrap}>
      <header className={styles.formHead}>
        <h1 className={styles.formTitle}>Account</h1>
      </header>
      {state === 'loading' && <p role="status">Loading your account…</p>}
      {state === 'error' && <p role="alert">Account details could not be loaded. Refresh and try again.</p>}
      {state === 'guest' && <div className={styles.form}>
        <p>Sign in to manage your VibeTutor profile and listings.</p>
        <Link href="/login?redirect=%2Fvibetutor%2Faccount">Sign in</Link>
        <Link href="/vibetutor/become-tutor">Become a tutor</Link>
      </div>}
      {state === 'signed-in' && <div className={styles.form}>
        <p><strong>{name}</strong></p>
        {email && <p className={styles.muted}>{email}</p>}
        <Link href="/vibetutor/become-tutor">{hasListing ? 'Edit tutor profile' : 'Become a tutor'}</Link>
        {hasListing && <Link href="/vibetutor/availability">Edit availability</Link>}
        <Link href="/vibetutor/browse">Browse tuition listings</Link>
        <div className={styles.formActions}><button type="button" className={styles.btnSecondary} onClick={() => void signOut()}>Sign out</button></div>
        {error && <p role="alert">{error}</p>}
      </div>}
    </section>
  )
}

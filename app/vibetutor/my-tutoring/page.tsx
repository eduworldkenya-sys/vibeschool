'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase'
import { summarizeDays } from '@/components/vibetutor/data'
import styles from '@/components/vibetutor/VibeTutor.module.css'

type TutorListing = {
  display_name: string
  subjects: string[]
  levels: string[]
  available_days: string[]
  status: 'published' | 'paused'
}

export default function MyTutoring() {
  const [state, setState] = useState<'loading' | 'signed-out' | 'missing' | 'ready' | 'error'>('loading')
  const [listing, setListing] = useState<TutorListing | null>(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const client = getSupabaseClient()
        const { data: auth, error: authError } = await client.auth.getUser()
        if (!active) return
        if (authError) throw authError
        if (!auth.user) { setState('signed-out'); return }
        const { data, error } = await client.from('vibetutor_tutors')
          .select('display_name,subjects,levels,available_days,status')
          .eq('profile_id', auth.user.id).maybeSingle()
        if (!active) return
        if (error) throw error
        if (!data) { setState('missing'); return }
        setListing(data as TutorListing)
        setState('ready')
      } catch {
        if (active) setState('error')
      }
    }
    void load()
    return () => { active = false }
  }, [retry])

  return <div className={styles.formWrap}>
    <header className={styles.formHead}>
      <h1 className={styles.formTitle}>My tutoring</h1>
      <p className={styles.muted}>Manage your tutoring with your VibeSchool account.</p>
    </header>
    {state === 'loading' && <p role="status">Loading your tutoring…</p>}
    {state === 'signed-out' && <p><Link href="/login?redirect=%2Fvibetutor%2Fmy-tutoring">Sign in</Link> to manage your tutoring.</p>}
    {state === 'error' && <div role="alert">Your tutoring details could not be loaded. <button type="button" onClick={() => { setState('loading'); setRetry(value => value + 1) }}>Retry</button></div>}
    {state === 'missing' && <section className={styles.form}>
      <p>You do not have a tutor listing yet.</p>
      <Link href="/vibetutor/become-tutor">Create a tutor listing</Link>
    </section>}
    {state === 'ready' && listing && <section className={styles.form} aria-label="My tutor listing">
      <h2>{listing.display_name}</h2>
      <p className={styles.muted}>{listing.status === 'published' ? 'Published listing' : 'Paused listing'}</p>
      <p><strong>Subjects:</strong> {listing.subjects?.join(', ') || 'Not set'}</p>
      <p><strong>Levels:</strong> {listing.levels?.join(', ') || 'Not set'}</p>
      <p><strong>Available:</strong> {summarizeDays(listing.available_days || [])}</p>
      <div className={styles.formActions}>
        <Link className={styles.btnSubmit} href="/vibetutor/become-tutor">Edit my listing</Link>
        <Link className={styles.btnSecondary} href="/vibetutor/availability">Edit availability</Link>
      </div>
      <Link href="/vibetutor/browse">Browse tuition requests</Link>
    </section>}
  </div>
}

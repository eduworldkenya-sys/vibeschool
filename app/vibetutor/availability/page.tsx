'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase'
import { DAYS, summarizeDays } from '@/components/vibetutor/data'
import SchedulePicker from '@/components/vibetutor/SchedulePicker'
import styles from '@/components/vibetutor/VibeTutor.module.css'

type LoadState = 'loading' | 'ready' | 'missing' | 'signed-out' | 'error'
const validDays = new Set<string>(DAYS)

export default function EditTutorAvailability() {
  const [status, setStatus] = useState<LoadState>('loading')
  const [days, setDays] = useState<string[]>([])
  const [original, setOriginal] = useState<string[]>([])
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const client = getSupabaseClient()
        const { data: auth, error: authError } = await client.auth.getUser()
        if (!active) return
        if (authError) throw authError
        if (!auth.user) { setStatus('signed-out'); return }
        const { data, error: fetchError } = await client.from('vibetutor_tutors')
          .select('display_name,available_days').eq('profile_id', auth.user.id).maybeSingle()
        if (!active) return
        if (fetchError) throw fetchError
        if (!data) { setStatus('missing'); return }
        const stored = Array.isArray(data.available_days)
          ? DAYS.filter(day => data.available_days.includes(day))
          : []
        setDays(stored)
        setOriginal(stored)
        setName(data.display_name || 'Tutor')
        setStatus('ready')
      } catch {
        if (active) setStatus('error')
      }
    }
    void load()
    return () => { active = false }
  }, [retry])

  async function save() {
    if (saving || status !== 'ready' || days.length === 0 || days.some(day => !validDays.has(day))) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const client = getSupabaseClient()
      const { data: auth, error: authError } = await client.auth.getUser()
      if (authError || !auth.user) { setStatus('signed-out'); return }
      // RLS enforces profile ownership; only update the availability column.
      const { data, error: updateError } = await client.from('vibetutor_tutors')
        .update({ available_days: DAYS.filter(day => days.includes(day)) })
        .eq('profile_id', auth.user.id)
        .select('available_days')
        .single()
      if (updateError || !data) throw updateError || new Error('No matching tutor profile')
      const saved = DAYS.filter(day => data.available_days.includes(day))
      setDays(saved)
      setOriginal(saved)
      setNotice('Availability updated. Your public listing now shows ' + summarizeDays(saved) + '.')
    } catch {
      setError('Could not save availability. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className={styles.formWrap}>
      <header className={styles.formHead}>
        <h1 className={styles.formTitle}>Edit availability</h1>
        <p className={styles.muted}>Choose the days you are available to teach.</p>
      </header>
      {status === 'loading' && <p role="status">Loading your tutor profile…</p>}
      {status === 'signed-out' && <p>Please <Link href="/login?redirect=%2Fvibetutor%2Favailability">sign in</Link> to edit your availability.</p>}
      {status === 'missing' && <p>You do not have a tutor profile yet. <Link href="/vibetutor/become-tutor">Create your tutor profile</Link> first.</p>}
      {status === 'error' && <div role="alert">Could not load your tutor profile. <button type="button" onClick={() => {setStatus('loading');setRetry(v => v+1)}}>Retry</button></div>}
      {status === 'ready' && <section className={styles.form} aria-label="Tutor availability">
        <p><strong>{name}</strong></p>
        <SchedulePicker days={days} onDays={value => { setDays(value); setNotice(''); setError('') }} />
        <p className={styles.muted}>Selected: {summarizeDays(days)}</p>
        {days.length === 0 && <p role="alert" className={styles.hint}>Choose at least one day.</p>}
        {error && <p role="alert" className={styles.hint}>{error}</p>}
        {notice && <p role="status">{notice}</p>}
        <div className={styles.formActions}>
          <button type="button" className={styles.btnSecondary} disabled={saving || days.join(',') === original.join(',')} onClick={() => setDays(original)}>Cancel changes</button>
          <button type="button" className={styles.btnSubmit} disabled={saving || days.length === 0 || days.join(',') === original.join(',')} onClick={() => void save()}>{saving ? 'Saving…' : 'Save availability'}</button>
        </div>
        <Link href="/vibetutor/browse">View tutor listings</Link>
      </section>}
    </main>
  )
}

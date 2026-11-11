'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import polish from '@/components/vibetutor/VibeTutorPolish.module.css'
import styles from '@/components/vibetutor/VibeTutor.module.css'
import { Field, Segmented, ToggleChips } from '@/components/vibetutor/Form'
import SchedulePicker from '@/components/vibetutor/SchedulePicker'
import { AREAS, LEVELS, SUBJECTS_BY_LEVEL, type Mode } from '@/components/vibetutor/data'
import { getSupabaseClient } from '@/lib/supabase'
import { saveTutorListing } from '@/components/vibetutor/listings'
import { clearDraft, readDraft, saveDraft } from '@/components/vibetutor/handoff'

const DRAFT_KEY = 'vibetutor:tutor-form:v1'

type TutorDraft = { name: string; levels: string[]; subjects: string[]; mode: Mode; area: string; rate: string; days: string[]; phone: string }

const toggle = (list: string[], value: string) => list.includes(value) ? list.filter(x => x !== value) : [...list, value]
// Limit by numbering format as the user types or pastes; never discard leading zeroes.
const normalizedPhone = (value: string) => {
  const compact = value.trim().replace(/[^+0-9]/g, '')
  const digits = compact.replace(/\D/g, '')
  if (compact.startsWith('+')) return '+' + digits.slice(0, 12)
  if (digits.startsWith('254')) return digits.slice(0, 12)
  return digits.slice(0, 10)
}
const validKenyanPhone = (value: string) => /^(?:0[71][0-9]{8}|254[71][0-9]{8}|\+254[71][0-9]{8})$/.test(value)

export default function BecomeTutor() {
  const [name, setName] = useState('')
  const [professionalName, setProfessionalName] = useState('')
  const [levels, setLevels] = useState<string[]>([])
  const [subjects, setSubjects] = useState<string[]>([])
  const [mode, setMode] = useState<Mode>('either')
  const [area, setArea] = useState('')
  const [rate, setRate] = useState('')
  const [days, setDays] = useState<string[]>([])
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [existingListing, setExistingListing] = useState(false)
  const [authStatus, setAuthStatus] = useState<'checking' | 'signed-in' | 'signed-out' | 'error'>('checking')
  const [authRetryKey, setAuthRetryKey] = useState(0)
  const [ready, setReady] = useState(false)
  const [touched, setTouched] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const availableSubjects = useMemo(() => [...new Set(levels.flatMap(level => SUBJECTS_BY_LEVEL[level] || []))], [levels])

  useEffect(() => {
    const draft = readDraft<TutorDraft>(DRAFT_KEY)
    if (draft) {
      setName(draft.name); setLevels(draft.levels); setSubjects(draft.subjects)
      setMode(draft.mode); setArea(draft.area); setRate(draft.rate)
      setDays(draft.days); setPhone(normalizedPhone(draft.phone)); setTouched(true)
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready || !touched) return
    saveDraft<TutorDraft>(DRAFT_KEY, { name, levels, subjects, mode, area, rate, days, phone })
  }, [ready, touched, name, levels, subjects, mode, area, rate, days, phone])

  useEffect(() => {
    let active = true
    const checkSignIn = async () => {
      try {
        const { data, error } = await getSupabaseClient().auth.getUser()
        if (!active) return
        if (error) { setAuthStatus('error'); return }
        if (!data.user) { setSignedIn(false); setAuthStatus('signed-out'); return }
        const metadata = data.user.user_metadata || {}
        // Always load the owner's listing before enabling publishing/editing.
        const client = getSupabaseClient()
        const { data: listing, error: listingError } = await client.from('vibetutor_tutors')
          .select('display_name,levels,subjects,teaching_mode,area,rate_kes,available_days,phone')
          .eq('profile_id', data.user.id).maybeSingle()
        if (!active) return
        if (listingError) { setAuthStatus('error'); return }
        const { data: profile } = await client.from('profiles')
          .select('full_name').eq('id', data.user.id).maybeSingle()
        if (!active) return
        const canonicalName = profile?.full_name?.trim() || ''
        setProfessionalName(canonicalName)
        setSignedIn(true)
        setExistingListing(!!listing)
        if (listing) {
          setName(canonicalName || listing.display_name || '')
          setLevels(listing.levels || [])
          setSubjects(listing.subjects || [])
          setMode(listing.teaching_mode === 'online' || listing.teaching_mode === 'physical' ? listing.teaching_mode : 'either')
          setArea(listing.area || '')
          setRate(listing.rate_kes == null ? '' : String(listing.rate_kes))
          setDays(listing.available_days || [])
          setPhone(normalizedPhone(listing.phone || ''))
          setConsent(true)
          setTouched(false)
          clearDraft(DRAFT_KEY)
        } else {
          setName(canonicalName || String(metadata.full_name || metadata.name || metadata.display_name || ''))
          setPhone(current => current || normalizedPhone(String(metadata.phone || data.user?.phone || '')))
        }
        setAuthStatus('signed-in')
      } catch {
        if (active) setAuthStatus('error')
      }
    }
    void checkSignIn()
    return () => { active = false }
  }, [authRetryKey])

  const updateLevels = (next: string[]) => {
    setTouched(true)
    setLevels(next)
    const allowed = new Set([...new Set(next.flatMap(level => SUBJECTS_BY_LEVEL[level] || []))])
    setSubjects(current => current.filter(subject => allowed.has(subject)))
  }
  const updatePhone = (value: string) => { setTouched(true); setPhone(normalizedPhone(value)) }
  const clearForm = () => { setName(professionalName); setLevels([]); setSubjects([]); setMode('either'); setArea(''); setRate(''); setDays([]); setPhone(''); setConsent(false); setTouched(false); clearDraft(DRAFT_KEY) }
  const completion = [levels.length > 0 && subjects.length > 0, !!area && Number(rate) > 0, days.length > 0, !!name.trim() && validKenyanPhone(phone) && consent]
  const validForm = completion.every(Boolean) && !!name.trim() && validKenyanPhone(phone) && consent
  return (
    <div className={styles.formWrap}>
      <header className={styles.formHead}>
        <h1 className={styles.formTitle}>{existingListing ? 'Edit tutor profile' : 'Teach on VibeTutor'}</h1>
        <p className={styles.muted}>{existingListing ? 'Update your teaching details and availability.' : 'Add your teaching details in one simple form.'}</p>
        {signedIn && existingListing && <p className={styles.muted}>Your saved details are loaded automatically. <Link href="/vibetutor/availability">Edit only availability</Link>.</p>}
      </header>
      {touched && <div className={polish.wizardProgress} aria-label={`${completion.filter(Boolean).length} of 4 sections complete`}>
        <div className={polish.wizardMeta}><strong>Profile setup</strong><span>{completion.filter(Boolean).length} of 4 complete</span></div>
        <div className={polish.wizardTrack} role="progressbar" aria-valuenow={completion.filter(Boolean).length} aria-valuemin={0} aria-valuemax={4} aria-label="Form completion"><span style={{ width: `${completion.filter(Boolean).length * 25}%` }} /></div>
        <ol className={polish.wizardSteps}>
          {['Teaching', 'Tuition details', 'Availability', 'Contact & consent'].map((label,index) => <li key={label} className={completion[index] ? polish.wizardStepDone : polish.wizardStep} aria-label={`Step ${index + 1}: ${label}, ${completion[index] ? 'complete' : 'incomplete'}`}>
            <span className={polish.wizardStepNumber}>{index + 1}</span>
            <span className={polish.wizardStepText}>{label}</span>
            {completion[index] && <span className={polish.wizardStepCheck} aria-hidden="true">✓</span>}
          </li>)}
        </ol>
      </div>}
      <form className={styles.form} onSubmit={e => { e.preventDefault(); if (!validForm || submitting || authStatus === 'checking' || authStatus === 'error') return; if (!signedIn) { saveDraft<TutorDraft>(DRAFT_KEY, { name, levels, subjects, mode, area, rate, days, phone }); window.location.assign('/login?redirect=%2Fvibetutor%2Fbecome-tutor'); return } setSubmitError(''); setSubmitting(true); saveTutorListing({ name, levels, subjects, mode, area, rate, days, phone }).then(result => { if (result.ok) { clearDraft(DRAFT_KEY); window.location.assign('/vibetutor/browse') } else setSubmitError(result.error) }).catch(() => setSubmitError('We could not save your tutor profile. Check your connection and try again.')).finally(() => setSubmitting(false)) }}>
        <Field label="Levels you teach" required><ToggleChips label="Levels" options={LEVELS} selected={levels} onToggle={value => updateLevels(toggle(levels, value))} /></Field>
        <Field label="Subjects" required>{levels.length > 0 && <ToggleChips label="Subjects" options={availableSubjects} selected={subjects} onToggle={value => { setTouched(true); setSubjects(toggle(subjects, value)) }} />}</Field>
        <Field label="Teaching format"><Segmented<Mode> label="Teaching format" value={mode} onChange={value => { setTouched(true); setMode(value) }} options={[{ value: 'online', label: 'Online' }, { value: 'physical', label: 'In person' }, { value: 'either', label: 'Either' }]} /></Field>
        <Field label="Area" required><select className={styles.input} value={area} onChange={e => { setTouched(true); setArea(e.target.value) }}><option value="">Choose area</option>{AREAS.map(item => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Rate per hour (KSh)" required><input className={styles.input} inputMode="numeric" value={rate} onChange={e => { setTouched(true); setRate(e.target.value.replace(/[^0-9]/g, '')) }} placeholder="e.g. 500" /></Field>
        <Field label="Days available" required><SchedulePicker days={days} onDays={value => { setTouched(true); setDays(value) }} /></Field>
        {signedIn && <p className={polish.prefillNote}>Your public tutor name comes from your teacher account. You can edit your other teaching details here.</p>}
        <Field label="Tutor name" required><input className={styles.input} value={name} readOnly={signedIn && !!professionalName} onChange={e => { if (!professionalName) { setTouched(true); setName(e.target.value) } }} maxLength={60} autoComplete="name" />{signedIn && !!professionalName && <span className={styles.hint}>Matches your teacher profile. Update your account name to change the public name.</span>}</Field>
        <Field label="Phone number" required><input className={styles.input} type="tel" inputMode="numeric" autoComplete="tel" maxLength={13} pattern="(?:0[17][0-9]{8}|[+]?254[17][0-9]{8})" value={phone} onChange={e => updatePhone(e.target.value)}  placeholder="07XXXXXXXX or +2547XXXXXXXX" aria-invalid={phone.length > 0 && !validKenyanPhone(phone)} />{phone.length > 0 && !validKenyanPhone(phone) && <span className={styles.hint}>Enter a valid Kenyan mobile number.</span>}</Field>
        <label className={styles.checkRow}><input type="checkbox" checked={consent} onChange={e => { setTouched(true); setConsent(e.target.checked) }} /><span>I agree to be listed on VibeTutor. My phone number stays private.</span></label>
        <div className={styles.formActions}>{!existingListing && <button type="button" className={styles.btnSecondary} onClick={clearForm}>Clear form</button>}<button type="submit" className={styles.btnSubmit} disabled={!validForm || submitting || authStatus === 'checking' || authStatus === 'error'}>{submitting ? 'Saving…' : existingListing ? 'Save profile changes' : 'Create tutor profile'}</button></div>
        {authStatus === 'error' && <p role="alert" className={styles.hint}>We could not verify your sign-in. Check your connection and retry before publishing. <button type="button" className={styles.btnSecondary} onClick={() => { setAuthStatus('checking'); setAuthRetryKey(value => value + 1) }}>Retry sign-in check</button></p>}
        {submitError && <p role="alert" className={styles.hint}>{submitError}</p>}
      </form>
    </div>
  )
}
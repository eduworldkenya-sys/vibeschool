'use client'

import { useEffect, useMemo, useState } from 'react'
import polish from '@/components/vibetutor/VibeTutorPolish.module.css'
import styles from '@/components/vibetutor/VibeTutor.module.css'
import { Field, Segmented, ToggleChips } from '@/components/vibetutor/Form'
import SchedulePicker from '@/components/vibetutor/SchedulePicker'
import { AREAS, LEVELS, SUBJECTS_BY_LEVEL, type Mode } from '@/components/vibetutor/data'
import { getSupabaseClient } from '@/lib/supabase'
import { clearDraft, readDraft, saveDraft } from '@/components/vibetutor/handoff'

const DRAFT_KEY = 'vibetutor:tutor-form:v1'

type TutorDraft = { name: string; levels: string[]; subjects: string[]; mode: Mode; area: string; rate: string; days: string[]; phone: string }

const toggle = (list: string[], value: string) => list.includes(value) ? list.filter(x => x !== value) : [...list, value]
const normalizedPhone = (value: string) => { const digits = value.replace(/\D/g, ''); return digits.length === 10 && digits.startsWith('0') ? '+254' + digits.slice(1) : digits.length === 12 && digits.startsWith('254') ? '+' + digits : value.trim() }
const validKenyanPhone = (value: string) => /^(?:0[71][0-9]{8}|254[71][0-9]{8}|\+254[71][0-9]{8})$/.test(value.replace(/[\s-]/g, ''))

export default function BecomeTutor() {
  const [name, setName] = useState('')
  const [levels, setLevels] = useState<string[]>([])
  const [subjects, setSubjects] = useState<string[]>([])
  const [mode, setMode] = useState<Mode>('either')
  const [area, setArea] = useState('')
  const [rate, setRate] = useState('')
  const [days, setDays] = useState<string[]>([])
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [photo, setPhoto] = useState('')
  const [signedIn, setSignedIn] = useState(false)
  const [ready, setReady] = useState(false)
  const [touched, setTouched] = useState(false)
  const availableSubjects = useMemo(() => [...new Set(levels.flatMap(level => SUBJECTS_BY_LEVEL[level] || []))], [levels])

  useEffect(() => {
    const draft = readDraft<TutorDraft>(DRAFT_KEY)
    if (draft) {
      setName(draft.name); setLevels(draft.levels); setSubjects(draft.subjects)
      setMode(draft.mode); setArea(draft.area); setRate(draft.rate)
      setDays(draft.days); setPhone(draft.phone); setTouched(true)
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready || !touched) return
    saveDraft<TutorDraft>(DRAFT_KEY, { name, levels, subjects, mode, area, rate, days, phone })
  }, [ready, touched, name, levels, subjects, mode, area, rate, days, phone])

  useEffect(() => {
    let active = true
    getSupabaseClient().auth.getUser().then(({ data }) => {
      if (!active || !data.user) return
      const metadata = data.user.user_metadata || {}
      setSignedIn(true)
      setName(current => current || String(metadata.full_name || metadata.name || metadata.display_name || ''))
      setPhone(current => current || String(metadata.phone || data.user?.phone || ''))
    }).catch(() => undefined)
    return () => { active = false }
  }, [])

  const updateLevels = (next: string[]) => {
    setTouched(true)
    setLevels(next)
    const allowed = new Set([...new Set(next.flatMap(level => SUBJECTS_BY_LEVEL[level] || []))])
    setSubjects(current => current.filter(subject => allowed.has(subject)))
  }
  const updatePhone = (value: string) => { setTouched(true); setPhone(value.replace(/[^0-9+ -]/g, '').slice(0, 16)) }
  const clearForm = () => { setName(''); setLevels([]); setSubjects([]); setMode('either'); setArea(''); setRate(''); setDays([]); setPhone(''); setConsent(false); setPhoto(''); setTouched(false); clearDraft(DRAFT_KEY) }
  const completion = [levels.length > 0 && subjects.length > 0, !!area && Number(rate) > 0, days.length > 0]
  const validForm = completion.every(Boolean) && !!name.trim() && validKenyanPhone(phone) && consent
  return (
    <div className={styles.formWrap}>
      <header className={styles.formHead}>
        <h1 className={styles.formTitle}>Teach on VibeTutor</h1>
        <p className={styles.muted}>Add your teaching details in one simple form.</p>
      </header>
      {touched && <div className={polish.wizardProgress} aria-label={`${completion.filter(Boolean).length} of 3 sections complete`}>
          <div className={polish.wizardMeta}><strong>Progress</strong><span>{completion.filter(Boolean).length} of 3 complete</span></div>
          <div className={polish.wizardSteps}>{["Teaching","Tuition details","Availability"].map((label,index)=><span key={label} title={label} aria-label={`${label} ${completion[index]?'complete':'incomplete'}`} className={completion[index]?polish.wizardStepDone:polish.wizardStep}>{completion[index]?'✓':index+1}</span>)}</div>
        </div>}
      <form className={styles.form} onSubmit={e => { e.preventDefault(); if (validForm) { saveDraft<TutorDraft>(DRAFT_KEY, { name, levels, subjects, mode, area, rate, days, phone }); window.location.assign('/login?next=%2Fvibetutor%2Fbecome-tutor') } }}>
        <Field label="Levels you teach" required><ToggleChips label="Levels" options={LEVELS} selected={levels} onToggle={value => updateLevels(toggle(levels, value))} /></Field>
        <Field label="Subjects" required>{levels.length > 0 && <ToggleChips label="Subjects" options={availableSubjects} selected={subjects} onToggle={value => { setTouched(true); setSubjects(toggle(subjects, value)) }} />}</Field>
        <Field label="Teaching format"><Segmented<Mode> label="Teaching format" value={mode} onChange={value => { setTouched(true); setMode(value) }} options={[{ value: 'online', label: 'Online' }, { value: 'physical', label: 'In person' }, { value: 'either', label: 'Either' }]} /></Field>
        <Field label="Area" required><select className={styles.input} value={area} onChange={e => { setTouched(true); setArea(e.target.value) }}><option value="">Choose area</option>{AREAS.map(item => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Rate per hour (KSh)" required><input className={styles.input} inputMode="numeric" value={rate} onChange={e => { setTouched(true); setRate(e.target.value.replace(/[^0-9]/g, '')) }} placeholder="e.g. 500" /></Field>
        <Field label="Days available" required><SchedulePicker days={days} onDays={value => { setTouched(true); setDays(value) }} /></Field>
        {signedIn && <p className={polish.prefillNote}>Account details prefilled where available. You can edit them.</p>}
        <Field label="Name" required><input className={styles.input} value={name} onChange={e => { setTouched(true); setName(e.target.value) }} maxLength={60} autoComplete="name" /></Field>
        <Field label="Phone number" required><input className={styles.input} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e => updatePhone(e.target.value)} onBlur={() => setPhone(current => normalizedPhone(current))} placeholder="07XX XXX XXX" aria-invalid={phone.length > 0 && !validKenyanPhone(phone)} />{phone.length > 0 && !validKenyanPhone(phone) && <span className={styles.hint}>Enter a valid Kenyan mobile number.</span>}</Field>
        <Field label="Profile photo" hint="Optional · A clear photo helps learners recognise you."><div className={polish.photoField}><div className={polish.photoControl}>{photo ? <img src={photo} alt="Profile photo preview" className={polish.photoPreview}/> : <span className={`${polish.photoPreview} ${polish.photoFallback}`} aria-hidden="true">{name.trim().slice(0,1).toUpperCase() || 'T'}</span>}<input className={polish.photoInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const file=e.target.files?.[0]; if(file && file.size <= 5*1024*1024) setPhoto(URL.createObjectURL(file)); else if(file) e.currentTarget.value='' }}/></div></div></Field>
        <label className={styles.checkRow}><input type="checkbox" checked={consent} onChange={e => { setTouched(true); setConsent(e.target.checked) }} /><span>I agree to be listed on VibeTutor. My phone number stays private.</span></label>
        <div className={styles.formActions}><button type="button" className={styles.btnSecondary} onClick={clearForm}>Clear form</button><button type="submit" className={styles.btnSubmit} disabled={!validForm}>Create tutor profile</button></div>
      </form>
    </div>
  )
}
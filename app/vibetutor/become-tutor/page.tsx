'use client'

import { useEffect, useMemo, useState } from 'react'
import polish from '@/components/vibetutor/VibeTutorPolish.module.css'
import styles from '@/components/vibetutor/VibeTutor.module.css'
import { Field, Segmented, ToggleChips } from '@/components/vibetutor/Form'
import SchedulePicker from '@/components/vibetutor/SchedulePicker'
import { AREAS, LEVELS, SUBJECTS_BY_LEVEL, type Mode } from '@/components/vibetutor/data'
import { getSupabaseClient } from '@/lib/supabase'

const toggle = (list: string[], value: string) => list.includes(value) ? list.filter(x => x !== value) : [...list, value]
const normalizedPhone = (value: string) => { const digits = value.replace(/\D/g, ''); return digits.length === 10 && digits.startsWith('0') ? '+254' + digits.slice(1) : digits.length === 12 && digits.startsWith('254') ? '+' + digits : value.trim() }
const validKenyanPhone = (value: string) => /^(?:0[71][0-9]{8}|254[71][0-9]{8}|\+254[71][0-9]{8})$/.test(value.replace(/[\s-]/g, ''))
const steps = ['Teaching', 'Lessons', 'Availability', 'Profile']

export default function BecomeTutor() {
  const [step, setStep] = useState(0)
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
  const availableSubjects = useMemo(() => [...new Set(levels.flatMap(level => SUBJECTS_BY_LEVEL[level] || []))], [levels])

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
    setLevels(next)
    const allowed = new Set([...new Set(next.flatMap(level => SUBJECTS_BY_LEVEL[level] || []))])
    setSubjects(current => current.filter(subject => allowed.has(subject)))
  }
  const updatePhone = (value: string) => setPhone(value.replace(/[^0-9+ -]/g, '').slice(0, 16))
  const validStep = step === 0 ? levels.length > 0 && subjects.length > 0
    : step === 1 ? !!area && Number(rate) > 0
    : step === 2 ? days.length > 0
    : !!name.trim() && validKenyanPhone(phone) && consent



  useEffect(() => {
    if (step < 3 && validStep) setStep(current => current === step ? current + 1 : current)
  }, [step, validStep])

  return (
    <div className={styles.formWrap}>
      <header className={styles.formHead}>
        <h1 className={styles.formTitle}>Teach on VibeTutor</h1>
        <p className={styles.muted}>Set up your tutor profile in four short steps.</p>
        <div className={polish.wizardProgress} aria-label={`Step ${step + 1} of 4`}>
          <div className={polish.wizardMeta}><strong>{steps[step]}</strong><span>Step {step + 1} of 4</span></div>
          <div className={polish.wizardSteps}>{steps.map((label, index) => <span key={label} aria-label={label} className={index < step ? polish.wizardStepDone : index === step ? polish.wizardStepOn : polish.wizardStep}>{index < step ? '✓' : index + 1}</span>)}</div>
        </div>
      </header>
      <form className={styles.form} onSubmit={e => { e.preventDefault(); if (step < 3 && validStep) setStep(step + 1); else if (step === 3 && validStep) window.location.assign('/login?next=%2Fvibetutor%2Fbecome-tutor') }}>
        {step === 0 && <>
          <Field label="Levels you teach" required><ToggleChips label="Levels" options={LEVELS} selected={levels} onToggle={value => updateLevels(toggle(levels, value))} /></Field>
          <Field label="Subjects" required>{levels.length > 0 && <ToggleChips label="Subjects" options={availableSubjects} selected={subjects} onToggle={value => setSubjects(toggle(subjects, value))} />}</Field>
        </>}
        {step === 1 && <>
          <Field label="Teaching format"><Segmented<Mode> label="Teaching format" value={mode} onChange={setMode} options={[{ value: 'online', label: 'Online' }, { value: 'physical', label: 'In person' }, { value: 'either', label: 'Either' }]} /></Field>
          <Field label="Area" required><select className={styles.input} value={area} onChange={e => setArea(e.target.value)}><option value="">Choose area</option>{AREAS.map(item => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Rate per hour (KSh)" required><input className={styles.input} inputMode="numeric" value={rate} onChange={e => setRate(e.target.value.replace(/[^0-9]/g, ''))} placeholder="e.g. 500" /></Field>
        </>}
        {step === 2 && <Field label="Days available" required><SchedulePicker days={days} onDays={setDays} /></Field>}
        {step === 3 && <>
          {signedIn && <p className={polish.prefillNote}>Account details prefilled where available. You can edit them.</p>}
          <Field label="Name" required><input className={styles.input} value={name} onChange={e => setName(e.target.value)} maxLength={60} autoComplete="name" /></Field>
          <Field label="Phone number" required><input className={styles.input} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e => updatePhone(e.target.value)} onBlur={() => setPhone(current => normalizedPhone(current))} placeholder="07XX XXX XXX" aria-invalid={phone.length > 0 && !validKenyanPhone(phone)} />{phone.length > 0 && !validKenyanPhone(phone) && <span className={styles.hint}>Enter a valid Kenyan mobile number.</span>}</Field>
          <Field label="Profile photo" hint="Optional · A clear photo helps learners recognise you."><div className={polish.photoField}><div className={polish.photoControl}>{photo ? <img src={photo} alt="Profile photo preview" className={polish.photoPreview}/> : <span className={`${polish.photoPreview} ${polish.photoFallback}`} aria-hidden="true">{name.trim().slice(0,1).toUpperCase() || 'T'}</span>}<input className={polish.photoInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const file=e.target.files?.[0]; if(file && file.size <= 5*1024*1024) setPhoto(URL.createObjectURL(file)); else if(file) e.currentTarget.value='' }}/></div></div></Field>
          <label className={styles.checkRow}><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /><span>I agree to be listed on VibeTutor. My phone number stays private.</span></label>
        </>}
        <div className={polish.wizardActions}>
          {step > 0 && <button type="button" className={styles.btnSecondary} onClick={() => setStep(step - 1)}>Back</button>}
          {step === 3 && <button type="submit" className={styles.btnSubmit} disabled={!validStep}>Create tutor profile</button>}
        </div>
      </form>
    </div>
  )
}

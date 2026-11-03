'use client'

import { useMemo, useState } from 'react'
import polish from '@/components/vibetutor/VibeTutorPolish.module.css'
import styles from '@/components/vibetutor/VibeTutor.module.css'
import { Field, Segmented, ToggleChips } from '@/components/vibetutor/Form'
import SchedulePicker from '@/components/vibetutor/SchedulePicker'
import { AREAS, LEVELS, SUBJECTS_BY_LEVEL, type Mode } from '@/components/vibetutor/data'

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
  const availableSubjects = useMemo(() => [...new Set(levels.flatMap(level => SUBJECTS_BY_LEVEL[level] || []))], [levels])
  const completed = [!!name.trim(), !!area, !!levels.length, !!subjects.length, Number(rate) > 0, !!days.length, validKenyanPhone(phone), consent].filter(Boolean).length
  const percent = Math.round(completed / 8 * 100)
  const ready = percent === 100

  const updateLevels = (next: string[]) => {
    setLevels(next)
    const allowed = new Set([...new Set(next.flatMap(level => SUBJECTS_BY_LEVEL[level] || []))])
    setSubjects(current => current.filter(subject => allowed.has(subject)))
  }
  const updatePhone = (value: string) => {
    const cleaned = value.replace(/[^0-9+ -]/g, '').slice(0, 16)
    setPhone(cleaned)
  }

  return (
    <div className={styles.formWrap}>
      <header className={styles.formHead}>
        <h1 className={styles.formTitle}>Teach on VibeTutor</h1>
        <p className={styles.muted}>Share what you teach and when you are available.</p>
        <div className={polish.progressRow} aria-label={`Form ${percent}% complete`}><svg className={polish.progressRing} viewBox="0 0 44 44" aria-hidden="true"><circle className={polish.progressTrack} cx="22" cy="22" r="18"/><circle className={polish.progressValue} cx="22" cy="22" r="18" strokeDasharray={113.1} strokeDashoffset={113.1 * (1 - percent / 100)}/></svg><span className={polish.progressCopy}><strong>{percent}% complete</strong><span>Complete the required details</span></span></div>
      </header>
      <form className={styles.form} onSubmit={e => { e.preventDefault(); if (ready) window.location.assign('/login') }}>
        <Field label="Name" required>
          <input className={styles.input} value={name} onChange={e => setName(e.target.value)} maxLength={60} autoComplete="name" />
        </Field>
        <Field label="Area" required>
          <select className={styles.input} value={area} onChange={e => setArea(e.target.value)}>
            <option value="">Choose area</option>
            {AREAS.map(item => <option key={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="Level" required>
          <ToggleChips label="Levels" options={LEVELS} selected={levels} onToggle={value => updateLevels(toggle(levels, value))} />
        </Field>
        <Field label="Subjects" required>
          {levels.length > 0 && <ToggleChips label="Subjects" options={availableSubjects} selected={subjects} onToggle={value => setSubjects(toggle(subjects, value))} />}
        </Field>
        <Field label="Teaching format">
          <Segmented<Mode> label="Teaching format" value={mode} onChange={setMode} options={[
            { value: 'online', label: 'Online' }, { value: 'physical', label: 'In person' }, { value: 'either', label: 'Either' },
          ]} />
        </Field>
        <Field label="Rate per hour (KSh)" required>
          <input className={styles.input} inputMode="numeric" value={rate} onChange={e => setRate(e.target.value.replace(/[^0-9]/g, ""))} placeholder="e.g. 500" />
        </Field>
        <Field label="Days available" required>
          <SchedulePicker days={days} onDays={setDays} />
        </Field>
        <Field label="Profile photo" hint="Optional · A clear photo helps learners recognise you.">
          <div className={polish.photoField}><div className={polish.photoControl}>{photo ? <img src={photo} alt="Profile photo preview" className={polish.photoPreview}/> : <span className={`${polish.photoPreview} ${polish.photoFallback}`} aria-hidden="true">{name.trim().slice(0,1).toUpperCase() || 'T'}</span>}<input className={polish.photoInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const file=e.target.files?.[0]; if(file && file.size <= 5*1024*1024) setPhoto(URL.createObjectURL(file)); else if(file) e.currentTarget.value='' }}/></div></div>
        </Field>
        <Field label="Phone number" required>
          <input className={styles.input} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e => updatePhone(e.target.value)} onBlur={() => setPhone(current => normalizedPhone(current))} placeholder="07XX XXX XXX" aria-invalid={phone.length > 0 && !validKenyanPhone(phone)} />
          {phone.length > 0 && !validKenyanPhone(phone) && <span className={styles.hint}>Enter a valid Kenyan mobile number.</span>}
        </Field>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
          <span>I agree to be listed on VibeTutor. My phone number stays private.</span>
        </label>
        <div className={styles.submitBar}>
          <button type="submit" className={styles.btnSubmit} disabled={!ready}>Continue with VibeSchool</button>
        </div>
      </form>
    </div>
  )
}

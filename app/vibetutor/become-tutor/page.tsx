'use client'

import { useMemo, useState } from 'react'
import styles from '@/components/vibetutor/VibeTutor.module.css'
import { FormStep, Field, Segmented, ToggleChips } from '@/components/vibetutor/Form'
import SchedulePicker from '@/components/vibetutor/SchedulePicker'
import { AREAS, LEVELS, SUBJECTS_BY_LEVEL, type Mode } from '@/components/vibetutor/data'

const toggle = (list: string[], value: string) => list.includes(value) ? list.filter(x => x !== value) : [...list, value]
const validKenyanPhone = (value: string) => /^(?:0|254|\\+254)(?:7|1)\\d{8}$/.test(value.replace(/[\\s-]/g, ''))

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
  const availableSubjects = useMemo(() => [...new Set(levels.flatMap(level => SUBJECTS_BY_LEVEL[level] || []))], [levels])
  const ready = Boolean(name.trim() && subjects.length && levels.length && area && Number(rate) > 0 && validKenyanPhone(phone) && days.length && consent)

  const updateLevels = (next: string[]) => {
    setLevels(next)
    const allowed = new Set([...new Set(next.flatMap(level => SUBJECTS_BY_LEVEL[level] || []))])
    setSubjects(current => current.filter(subject => allowed.has(subject)))
  }
  const updatePhone = (value: string) => {
    const cleaned = value.replace(/[^0-9+\\s-]/g, '').slice(0, 16)
    setPhone(cleaned)
  }

  return (
    <div className={styles.formWrap}>
      <header className={styles.formHead}>
        <h1 className={styles.formTitle}>Teach on VibeTutor</h1>
        <p className={styles.muted}>Share what you teach and when you are available.</p>
      </header>
      <form className={styles.form} onSubmit={e => { e.preventDefault(); if (ready) window.location.assign('/login') }}>
        <FormStep n={1} title="About you">
          <Field label="Name" required>
            <input className={styles.input} value={name} onChange={e => setName(e.target.value)} maxLength={60} autoComplete="name" />
          </Field>
          <Field label="Area" required>
            <select className={styles.input} value={area} onChange={e => setArea(e.target.value)}>
              <option value="">Choose area</option>
              {AREAS.map(item => <option key={item}>{item}</option>)}
            </select>
          </Field>
        </FormStep>
        <FormStep n={2} title="What you teach">
          <Field label="Level" required hint="Choose a level first. We will show its subjects next.">
            <ToggleChips label="Levels" options={LEVELS} selected={levels} onToggle={value => updateLevels(toggle(levels, value))} />
          </Field>
          <Field label="Subjects" required>
            {levels.length === 0
              ? <p className={styles.hint}>Select a level to see its subjects.</p>
              : <ToggleChips label="Subjects" options={availableSubjects} selected={subjects} onToggle={value => setSubjects(toggle(subjects, value))} />}
          </Field>
        </FormStep>
        <FormStep n={3} title="How you teach">
          <Field label="Teaching format">
            <Segmented<Mode> label="Teaching format" value={mode} onChange={setMode} options={[
              { value: 'online', label: 'Online' }, { value: 'physical', label: 'In person' }, { value: 'either', label: 'Either' },
            ]} />
          </Field>
          <Field label="Rate per hour (KSh)" required>
            <input className={styles.input} inputMode="numeric" value={rate} onChange={e => setRate(e.target.value.replace(/\\D/g, ''))} placeholder="e.g. 500" />
          </Field>
        </FormStep>
        <FormStep n={4} title="Holiday availability">
          <SchedulePicker days={days} onDays={setDays} />
        </FormStep>
        <FormStep n={5} title="Contact">
          <Field label="Phone number" required hint="Use 07…, 01… or +254…">
            <input className={styles.input} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e => updatePhone(e.target.value)} placeholder="07XX XXX XXX" aria-invalid={phone.length > 0 && !validKenyanPhone(phone)} />
            {phone.length > 0 && !validKenyanPhone(phone) && <span className={styles.hint}>Enter a valid Kenyan mobile number.</span>}
          </Field>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
            <span>I agree to be listed on VibeTutor. My phone number stays private.</span>
          </label>
        </FormStep>
        <div className={styles.submitBar}>
          <button type="submit" className={styles.btnSubmit} disabled={!ready}>Continue with VibeSchool</button>
        </div>
      </form>
    </div>
  )
}

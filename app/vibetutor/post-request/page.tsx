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

export default function PostRequest() {
  const [learner, setLearner] = useState('')
  const [subjects, setSubjects] = useState<string[]>([])
  const [level, setLevel] = useState('')
  const [mode, setMode] = useState<Mode>('either')
  const [area, setArea] = useState('')
  const [days, setDays] = useState<string[]>([])
  const [budget, setBudget] = useState('')
  const [phone, setPhone] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const availableSubjects = useMemo(() => SUBJECTS_BY_LEVEL[level] || [], [level])
  const completed = [!!learner.trim(), !!level, !!subjects.length, !!area, !!days.length, validKenyanPhone(phone)].filter(Boolean).length
  const percent = Math.round(completed / 6 * 100)
  const ready = percent === 100

  return (
    <div className={styles.formWrap}>
      <header className={styles.formHead}>
        <h1 className={styles.formTitle}>Request a tutor</h1>
        <p className={styles.muted}>Find tuition for your learner.</p>
        <div className={polish.progressRow} aria-label={`Form ${percent}% complete`}><svg className={polish.progressRing} viewBox="0 0 44 44" aria-hidden="true"><circle className={polish.progressTrack} cx="22" cy="22" r="18"/><circle className={polish.progressValue} cx="22" cy="22" r="18" strokeDasharray={113.1} strokeDashoffset={113.1 * (1 - percent / 100)}/></svg><span className={polish.progressCopy}><strong>{percent}% complete</strong><span>Complete the required details</span></span></div>
      </header>
      <form className={styles.form} onSubmit={e => { e.preventDefault(); if (ready) setSubmitted(true) }}>
        <Field label="Student name" required>
          <input className={styles.input} value={learner} onChange={e => { setLearner(e.target.value); setSubmitted(false) }} maxLength={60} />
        </Field>
        <Field label="Level" required>
          <select className={styles.input} value={level} onChange={e => { setLevel(e.target.value); setSubjects([]); setSubmitted(false) }}>
            <option value="">Choose level</option>
            {LEVELS.map(item => <option key={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="Subjects" required>
          {level && <ToggleChips label="Subjects" options={availableSubjects} selected={subjects} onToggle={value => { setSubjects(toggle(subjects, value)); setSubmitted(false) }} />}
        </Field>
        <Field label="Teaching format">
          <Segmented<Mode> label="Teaching format" value={mode} onChange={setMode} options={[
            { value: 'online', label: 'Online' }, { value: 'physical', label: 'In person' }, { value: 'either', label: 'Either' },
          ]} />
        </Field>
        <Field label="Area" required>
          <select className={styles.input} value={area} onChange={e => { setArea(e.target.value); setSubmitted(false) }}>
            <option value="">Choose area</option>
            {AREAS.map(item => <option key={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="Days available" required>
          <SchedulePicker days={days} onDays={value => { setDays(value); setSubmitted(false) }} />
        </Field>
        <Field label="Budget per hour (KSh)">
          <input className={styles.input} inputMode="numeric" value={budget} onChange={e => setBudget(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Optional" />
        </Field>
        <Field label="Parent or guardian phone" required>
          <input className={styles.input} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e => { setPhone(e.target.value.replace(/[^0-9+ -]/g, '').slice(0, 16)); setSubmitted(false) }} onBlur={() => setPhone(current => normalizedPhone(current))} placeholder="07XX XXX XXX" aria-invalid={phone.length > 0 && !validKenyanPhone(phone)} />
          {phone.length > 0 && !validKenyanPhone(phone) && <span className={styles.hint}>Enter a valid Kenyan mobile number.</span>}
        </Field>
        <div className={styles.submitBar}>
          <button type="submit" className={styles.btnSubmit} disabled={!ready}>Review request</button>
          {submitted && <div className={styles.success} role="status">
            <strong>Request preview</strong>
            <p>This preview does not publish or save a request.</p>
            <div className={styles.reviewSummary}>{learner} · {level} · {subjects.join(', ')} · {area} · {days.join(', ')} · {mode} · {budget ? `KSh ${budget}/hr` : 'Budget not set'}</div>
            <a className={styles.inlineAction} href="/login">Continue to sign in</a>
          </div>}
        </div>
      </form>
    </div>
  )
}

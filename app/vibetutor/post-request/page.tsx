'use client'

import { useMemo, useState } from 'react'
import styles from '@/components/vibetutor/VibeTutor.module.css'
import { FormStep, Field, Segmented, ToggleChips } from '@/components/vibetutor/Form'
import SchedulePicker from '@/components/vibetutor/SchedulePicker'
import { AREAS, LEVELS, SUBJECTS_BY_LEVEL, type Mode } from '@/components/vibetutor/data'

const toggle = (list: string[], value: string) => list.includes(value) ? list.filter(x => x !== value) : [...list, value]
const validKenyanPhone = (value: string) => /^(?:0|254|\\+254)(?:7|1)\\d{8}$/.test(value.replace(/[\\s-]/g, ''))

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
  const ready = Boolean(learner.trim() && subjects.length && level && area && days.length && validKenyanPhone(phone))

  return (
    <div className={styles.formWrap}>
      <header className={styles.formHead}>
        <h1 className={styles.formTitle}>Request a tutor</h1>
        <p className={styles.muted}>Tell tutors what support you need.</p>
      </header>
      <form className={styles.form} onSubmit={e => { e.preventDefault(); if (ready) setSubmitted(true) }}>
        <FormStep n={1} title="The learner">
          <Field label="Name or nickname" required hint="A nickname is fine. Avoid sharing a learner's private details publicly.">
            <input className={styles.input} value={learner} onChange={e => setLearner(e.target.value)} maxLength={60} />
          </Field>
        </FormStep>
        <FormStep n={2} title="What they need">
          <Field label="Level" required>
            <select className={styles.input} value={level} onChange={e => { setLevel(e.target.value); setSubjects([]); setSubmitted(false) }}>
              <option value="">Choose a level first</option>
              {LEVELS.map(item => <option key={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Subjects" required>
            {level ? <ToggleChips label="Subjects" options={availableSubjects} selected={subjects} onToggle={value => { setSubjects(toggle(subjects, value)); setSubmitted(false) }} />
              : <span className={styles.hint}>Choose a level to see its subjects.</span>}
          </Field>
          <Field label="Teaching format">
            <Segmented<Mode> label="Teaching format" value={mode} onChange={setMode} options={[
              { value: 'online', label: 'Online' }, { value: 'physical', label: 'In person' }, { value: 'either', label: 'Either' },
            ]} />
          </Field>
        </FormStep>
        <FormStep n={3} title="When and where">
          <Field label="Area" required>
            <select className={styles.input} value={area} onChange={e => setArea(e.target.value)}>
              <option value="">Choose area</option>
              {AREAS.map(item => <option key={item}>{item}</option>)}
            </select>
          </Field>
          <SchedulePicker days={days} onDays={setDays} />
          <Field label="Budget per hour (KSh)" hint="Optional">
            <input className={styles.input} inputMode="numeric" value={budget} onChange={e => setBudget(e.target.value.replace(/\\D/g, ''))} placeholder="e.g. 500" />
          </Field>
        </FormStep>
        <FormStep n={4} title="Parent or guardian contact">
          <Field label="Phone number" required hint="Use 07…, 01… or +254…">
            <input className={styles.input} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e => { setPhone(e.target.value.replace(/[^0-9+\\s-]/g, '').slice(0,16)); setSubmitted(false) }} placeholder="07XX XXX XXX" aria-invalid={phone.length > 0 && !validKenyanPhone(phone)} />
            {phone.length > 0 && !validKenyanPhone(phone) && <span className={styles.hint}>Enter a valid Kenyan mobile number.</span>}
          </Field>
        </FormStep>
        <div className={styles.submitBar}>
          <button type="submit" className={styles.btnSubmit} disabled={!ready}>Review tuition request</button>
          {submitted && <div className={styles.success} role="status">
            <strong>Request preview</strong>
            <p>Your details are ready. This preview does not publish or save a request.</p>
            <div className={styles.reviewSummary}>{level} · {subjects.join(', ')} · {area} · {days.join(', ')} · {mode} · {budget ? `KSh ${budget}/hr` : 'Budget not set'}</div>
            <a className={styles.inlineAction} href="/login">Continue to sign in</a>
          </div>}
        </div>
      </form>
    </div>
  )
}

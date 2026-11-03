'use client'

import { useState } from 'react'
import styles from '@/components/vibetutor/VibeTutor.module.css'
import { FormStep, Field, Segmented, ToggleChips } from '@/components/vibetutor/Form'
import SchedulePicker from '@/components/vibetutor/SchedulePicker'
import { AREAS, LEVELS, SUBJECTS, type DayPart, type Mode } from '@/components/vibetutor/data'

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v])

export default function PostRequest() {
  const [learner, setLearner] = useState('')
  const [subjects, setSubjects] = useState<string[]>([])
  const [level, setLevel] = useState('')
  const [mode, setMode] = useState<Mode>('either')
  const [area, setArea] = useState('')
  const [days, setDays] = useState<string[]>([])
  const [parts, setParts] = useState<DayPart[]>([])
  const [budget, setBudget] = useState('')
  const [phone, setPhone] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const ready = learner.trim() && subjects.length > 0 && level && area && days.length > 0 && parts.length > 0 && phone.trim()

  return (
    <div className={styles.formWrap}>
      <header className={styles.formHead}>
        <h1 className={styles.formTitle}>Request a tutor</h1>
        <p className={styles.muted}>Tell tutors what you need. It takes about two minutes and there is no fee.</p>
      </header>

      <p className={styles.notice}>Preview only. Requests are not saved or shared yet.</p>

      <form className={styles.form} onSubmit={e => { e.preventDefault(); if (ready) setSubmitted(true) }}>
        <FormStep n={1} title="The learner">
          <Field label="Name or nickname" required hint="Shared with tutors only after a request is verified.">
            <input className={styles.input} value={learner} onChange={e => setLearner(e.target.value)} maxLength={60} />
          </Field>
        </FormStep>

        <FormStep n={2} title="What they need" hint="Choose every subject that applies.">
          <Field label="Subjects" required>
            <ToggleChips label="Subjects" options={SUBJECTS} selected={subjects} onToggle={v => setSubjects(toggle(subjects, v))} />
          </Field>
          <Field label="Level" required>
            <select className={styles.input} value={level} onChange={e => setLevel(e.target.value)}>
              <option value="">Choose a level</option>
              {LEVELS.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Format">
            <Segmented<Mode>
              label="Format"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'online', label: 'Online' },
                { value: 'physical', label: 'In person' },
                { value: 'either', label: 'Either' },
              ]}
            />
          </Field>
        </FormStep>

        <FormStep n={3} title="When and where">
          <Field label="Area" required>
            <select className={styles.input} value={area} onChange={e => setArea(e.target.value)}>
              <option value="">Choose an area</option>
              {AREAS.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <SchedulePicker days={days} onDays={setDays} parts={parts} onParts={setParts} />
          <Field label="Budget per hour (KSh)" hint="Optional.">
            <input className={styles.input} inputMode="numeric" value={budget} onChange={e => setBudget(e.target.value.replace(/\D/g, ''))} />
          </Field>
        </FormStep>

        <FormStep n={4} title="Your contact" hint="Your number stays private.">
          <Field label="Parent or guardian phone" required hint="Kept private. Shared only after you agree to a booking.">
            <input className={styles.input} type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} />
          </Field>
        </FormStep>

        <div className={styles.submitBar}>
          <button type="submit" className={styles.btnSubmit} disabled={!ready}>Preview request</button>
          {submitted && <p className={styles.success}>Preview complete for {learner.trim() || 'this learner'}: {subjects.join(', ')}, {level}, {area}. Saving will be enabled in the next phase.</p>}
        </div>
      </form>
    </div>
  )
}

'use client'

import { useState } from 'react'
import styles from '@/components/vibetutor/VibeTutor.module.css'
import { FormStep, Field, Segmented } from '@/components/vibetutor/Form'
import { AREAS, LEVELS, SUBJECTS, type Mode } from '@/components/vibetutor/data'

export default function PostRequest() {
  const [learner, setLearner] = useState('')
  const [subject, setSubject] = useState('')
  const [level, setLevel] = useState('')
  const [mode, setMode] = useState<Mode>('either')
  const [area, setArea] = useState('')
  const [schedule, setSchedule] = useState('')
  const [budget, setBudget] = useState('')
  const [phone, setPhone] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const ready = learner.trim() && subject && level && area && phone.trim()

  return (
    <div className={styles.formWrap}>
      <header className={styles.formHead}>
        <h1 className={styles.formTitle}>Post a tuition request</h1>
        <p className={styles.muted}>Tell tutors what you need. It takes about two minutes.</p>
      </header>

      <p className={styles.notice}>Preview only. Requests are not saved or shared yet.</p>

      <form
        className={styles.form}
        onSubmit={e => { e.preventDefault(); if (ready) setSubmitted(true) }}
      >
        <FormStep n={1} title="The learner">
          <Field label="Name or nickname" required hint="Shared with tutors only after a request is verified.">
            <input className={styles.input} value={learner} onChange={e => setLearner(e.target.value)} maxLength={60} />
          </Field>
        </FormStep>

        <FormStep n={2} title="What they need">
          <Field label="Subject" required>
            <select className={styles.input} value={subject} onChange={e => setSubject(e.target.value)}>
              <option value="">Choose a subject</option>
              {SUBJECTS.map(s => <option key={s}>{s}</option>)}
            </select>
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

        <FormStep n={3} title="Where and when">
          <Field label="Area" required>
            <select className={styles.input} value={area} onChange={e => setArea(e.target.value)}>
              <option value="">Choose an area</option>
              {AREAS.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Schedule" hint="For example, weekday evenings or holiday mornings.">
            <input className={styles.input} value={schedule} onChange={e => setSchedule(e.target.value)} maxLength={120} />
          </Field>
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
          {submitted && <p className={styles.success}>Preview complete for {learner.trim() || 'this learner'}: {subject}, {level}, {area}. Saving will be enabled in the next phase.</p>}
        </div>
      </form>
    </div>
  )
}

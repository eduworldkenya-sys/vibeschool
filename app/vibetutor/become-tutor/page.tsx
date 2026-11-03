'use client'

import { useState } from 'react'
import styles from '@/components/vibetutor/VibeTutor.module.css'
import { FormStep, Field, Segmented, ToggleChips } from '@/components/vibetutor/Form'
import SchedulePicker from '@/components/vibetutor/SchedulePicker'
import { AREAS, LEVELS, SUBJECTS, type DayPart, type Mode } from '@/components/vibetutor/data'

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v])

export default function BecomeTutor() {
  const [name, setName] = useState('')
  const [subjects, setSubjects] = useState<string[]>([])
  const [levels, setLevels] = useState<string[]>([])
  const [mode, setMode] = useState<Mode>('either')
  const [area, setArea] = useState('')
  const [rate, setRate] = useState('')
  const [days, setDays] = useState<string[]>([])
  const [parts, setParts] = useState<DayPart[]>([])
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)

  const ready = name.trim() && subjects.length && levels.length && area && Number(rate) > 0 && phone.trim() && consent

  return (
    <div className={styles.formWrap}>
      <header className={styles.formHead}>
        <h1 className={styles.formTitle}>Teach on VibeTutor</h1>
        <p className={styles.muted}>Create a profile so learners can find you this holiday.</p>
      </header>


      <form
        className={styles.form}
        onSubmit={e => { e.preventDefault(); if (ready) window.location.assign('/login') }}
      >
        <FormStep n={1} title="About you">
          <Field label="Display name" required>
            <input className={styles.input} value={name} onChange={e => setName(e.target.value)} maxLength={60} />
          </Field>
          <Field label="Area" required>
            <select className={styles.input} value={area} onChange={e => setArea(e.target.value)}>
              <option value="">Choose an area</option>
              {AREAS.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </FormStep>

        <FormStep n={2} title="What you teach" hint="Pick everything you cover.">
          <Field label="Subjects" required>
            <ToggleChips label="Subjects" options={SUBJECTS} selected={subjects} onToggle={v => setSubjects(toggle(subjects, v))} />
          </Field>
          <Field label="Levels" required>
            <ToggleChips label="Levels" options={LEVELS} selected={levels} onToggle={v => setLevels(toggle(levels, v))} />
          </Field>
        </FormStep>

        <FormStep n={3} title="How you teach">
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
          <Field label="Rate per hour (KSh)" required>
            <input className={styles.input} inputMode="numeric" value={rate} onChange={e => setRate(e.target.value.replace(/\D/g, ''))} />
          </Field>
        </FormStep>

        <FormStep n={4} title="Holiday availability" hint="When can learners book you?">
          <SchedulePicker days={days} onDays={setDays} parts={parts} onParts={setParts} />
        </FormStep>

        <FormStep n={5} title="Contact and consent">
          <Field label="Phone number" required hint="Kept private. Only shared after you agree to a booking.">
            <input className={styles.input} type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} />
          </Field>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
            <span>I agree to be listed publicly on VibeTutor. My phone number stays private.</span>
          </label>
        </FormStep>

        <div className={styles.submitBar}>
          <button type="submit" className={styles.btnSubmit} disabled={!ready}>Continue with VibeSchool</button>
        </div>
      </form>
    </div>
  )
}

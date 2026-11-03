'use client'

import Link from 'next/link'
import { useState } from 'react'
import styles from '@/components/vibetutor/VibeTutor.module.css'
import { AREAS, LEVELS, SUBJECTS, type Mode } from '@/components/vibetutor/data'

export default function BecomeTutor() {
  const [name, setName] = useState('')
  const [subjects, setSubjects] = useState<string[]>([])
  const [levels, setLevels] = useState<string[]>([])
  const [area, setArea] = useState('')
  const [mode, setMode] = useState<Mode | ''>('')
  const [rate, setRate] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const valid = name.trim() && subjects.length && levels.length && area && mode && Number(rate) > 0

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter(x => x !== v) : [...list, v])

  return (
    <>
      <Link href="/vibetutor" className={styles.back}>← VibeTutor</Link>
      <h1 className={styles.title}>Register as a tutor</h1>
      <div className={styles.notice}>Preview only. Registrations are not saved yet.</div>
      <form className={styles.filters} style={{ gridTemplateColumns: '1fr' }} onSubmit={e => { e.preventDefault(); if (valid) setSubmitted(true) }}>
        <label className={styles.field}>Display name
          <input className={styles.input} value={name} onChange={e => setName(e.target.value)} maxLength={60} />
        </label>
        <fieldset className={styles.field} style={{ border: 0, padding: 0 }}>
          <legend>Subjects you teach</legend>
          {SUBJECTS.map(s => (
            <label key={s} style={{ display: 'inline-flex', gap: 6, marginRight: 12, marginBottom: 6 }}>
              <input type="checkbox" checked={subjects.includes(s)} onChange={() => toggle(subjects, setSubjects, s)} />{s}
            </label>
          ))}
        </fieldset>
        <fieldset className={styles.field} style={{ border: 0, padding: 0 }}>
          <legend>Levels you teach</legend>
          {LEVELS.map(s => (
            <label key={s} style={{ display: 'inline-flex', gap: 6, marginRight: 12, marginBottom: 6 }}>
              <input type="checkbox" checked={levels.includes(s)} onChange={() => toggle(levels, setLevels, s)} />{s}
            </label>
          ))}
        </fieldset>
        <label className={styles.field}>Area
          <select className={styles.select} value={area} onChange={e => setArea(e.target.value)} required>
            <option value="">Choose an area</option>
            {AREAS.map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className={styles.field}>Teaching mode
          <select className={styles.select} value={mode} onChange={e => setMode(e.target.value as Mode | '')} required>
            <option value="">Choose a mode</option>
            <option value="online">Online</option>
            <option value="physical">In person</option>
            <option value="either">Online or in person</option>
          </select>
        </label>
        <label className={styles.field}>Rate per hour (KSh)
          <input className={styles.input} inputMode="numeric" value={rate} onChange={e => setRate(e.target.value.replace(/\D/g, ''))} />
        </label>
        <button type="submit" className={styles.button} disabled={!valid}>Preview registration</button>
        {submitted && <p className={styles.meta}>Preview complete for {name}. Saving will be enabled in the backend phase.</p>}
      </form>
    </>
  )
}

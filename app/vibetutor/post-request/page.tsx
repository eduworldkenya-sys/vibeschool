'use client'

import Link from 'next/link'
import { useState } from 'react'
import styles from '@/components/vibetutor/VibeTutor.module.css'
import { AREAS, LEVELS, SUBJECTS } from '@/components/vibetutor/data'

export default function PostRequest() {
  const [subject, setSubject] = useState('')
  const [level, setLevel] = useState('')
  const [area, setArea] = useState('')
  const [details, setDetails] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const valid = subject && level && area

  return (
    <>
      <Link href="/vibetutor" className={styles.back}>← VibeTutor</Link>
      <h1 className={styles.title}>Post a tuition request</h1>
      <div className={styles.notice}>Preview only. Requests are not saved or shared yet.</div>
      <form className={styles.filters} onSubmit={e => { e.preventDefault(); if (valid) setSubmitted(true) }} style={{ gridTemplateColumns: '1fr' }}>
        <label className={styles.field}>Subject
          <select className={styles.select} value={subject} onChange={e => setSubject(e.target.value)} required>
            <option value="">Choose a subject</option>
            {SUBJECTS.map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className={styles.field}>Level
          <select className={styles.select} value={level} onChange={e => setLevel(e.target.value)} required>
            <option value="">Choose a level</option>
            {LEVELS.map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className={styles.field}>Area
          <select className={styles.select} value={area} onChange={e => setArea(e.target.value)} required>
            <option value="">Choose an area</option>
            {AREAS.map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className={styles.field}>Details (schedule, goals, budget)
          <textarea className={styles.textarea} value={details} onChange={e => setDetails(e.target.value)} maxLength={600} />
        </label>
        <button type="submit" className={styles.button} disabled={!valid}>Preview request</button>
        {submitted && <p className={styles.meta}>Preview complete: {subject}, {level}, {area}. Saving will be enabled in the backend phase.</p>}
      </form>
    </>
  )
}

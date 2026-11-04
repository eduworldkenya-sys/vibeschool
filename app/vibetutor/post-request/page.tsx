'use client'

import { useEffect, useMemo, useState } from 'react'
import polish from '@/components/vibetutor/VibeTutorPolish.module.css'
import styles from '@/components/vibetutor/VibeTutor.module.css'
import { Field, Segmented, ToggleChips } from '@/components/vibetutor/Form'
import SchedulePicker from '@/components/vibetutor/SchedulePicker'
import { AREAS, LEVELS, SUBJECTS_BY_LEVEL, type Mode } from '@/components/vibetutor/data'
import { getSupabaseClient } from '@/lib/supabase'
import { clearDraft, readDraft, saveDraft } from '@/components/vibetutor/handoff'

const DRAFT_KEY = 'vibetutor:learner-request:v1'

type RequestDraft = { learner: string; subjects: string[]; level: string; mode: Mode; area: string; days: string[]; budget: string; phone: string }

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
  const [signedIn, setSignedIn] = useState(false)
  const [ready, setReady] = useState(false)
  const [touched, setTouched] = useState(false)
  const availableSubjects = useMemo(() => SUBJECTS_BY_LEVEL[level] || [], [level])

  useEffect(() => {
    const draft = readDraft<RequestDraft>(DRAFT_KEY)
    if (draft) {
      setLearner(draft.learner); setSubjects(draft.subjects); setLevel(draft.level)
      setMode(draft.mode); setArea(draft.area); setDays(draft.days)
      setBudget(draft.budget); setPhone(draft.phone); setTouched(true)
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready || !touched) return
    saveDraft<RequestDraft>(DRAFT_KEY, { learner, subjects, level, mode, area, days, budget, phone })
  }, [ready, touched, learner, subjects, level, mode, area, days, budget, phone])

  useEffect(() => {
    let active = true
    getSupabaseClient().auth.getUser().then(({ data }) => {
      if (!active || !data.user) return
      const metadata = data.user.user_metadata || {}
      setSignedIn(true)
      setPhone(current => current || String(metadata.phone || data.user?.phone || ''))
      setLearner(current => current || String(metadata.child_name || metadata.learner_name || ''))
    }).catch(() => undefined)
    return () => { active = false }
  }, [])

  const clearForm = () => { setLearner(''); setSubjects([]); setLevel(''); setMode('either'); setArea(''); setDays([]); setBudget(''); setPhone(''); setTouched(false); clearDraft(DRAFT_KEY) }
  const completion = [!!level && subjects.length > 0, !!area, days.length > 0, validKenyanPhone(phone)]
  const validForm = completion.every(Boolean)
  return (
    <div className={styles.formWrap}>
      <header className={styles.formHead}>
        <h1 className={styles.formTitle}>Request a tutor</h1>
        <p className={styles.muted}>Tell us what your learner needs in one form.</p>
        <div className={polish.wizardProgress} aria-label={`${completion.filter(Boolean).length} of 4 sections complete`}>
          <div className={polish.wizardMeta}><strong>Your request</strong><span>{completion.filter(Boolean).length} of 4 complete</span></div>
          <div className={polish.wizardSteps}>{["Learner","Lessons","Schedule","Contact"].map((label,index)=><span key={label} title={label} aria-label={`${label} ${completion[index]?'complete':'incomplete'}`} className={completion[index]?polish.wizardStepDone:polish.wizardStep}>{completion[index]?'✓':index+1}</span>)}</div>
        </div>
      </header>
      <form className={styles.form} onSubmit={e => { e.preventDefault(); if (validForm) { saveDraft<RequestDraft>(DRAFT_KEY, { learner, subjects, level, mode, area, days, budget, phone }); window.location.assign('/login?next=%2Fvibetutor%2Fpost-request') } }}>
        <Field label="Level" required><select className={styles.input} value={level} onChange={e => { setTouched(true); setLevel(e.target.value); setSubjects([]) }}><option value="">Choose level</option>{LEVELS.map(item => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Subjects" required>{level && <ToggleChips label="Subjects" options={availableSubjects} selected={subjects} onToggle={value => { setTouched(true); setSubjects(toggle(subjects, value)) }} />}</Field>
        <Field label="Teaching format"><Segmented<Mode> label="Teaching format" value={mode} onChange={value => { setTouched(true); setMode(value) }} options={[{ value: 'online', label: 'Online' }, { value: 'physical', label: 'In person' }, { value: 'either', label: 'Either' }]} /></Field>
        <Field label="Area" required><select className={styles.input} value={area} onChange={e => { setTouched(true); setArea(e.target.value) }}><option value="">Choose area</option>{AREAS.map(item => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Budget per hour (KSh)"><input className={styles.input} inputMode="numeric" value={budget} onChange={e => { setTouched(true); setBudget(e.target.value.replace(/[^0-9]/g, '')) }} placeholder="Optional" /></Field>
        <Field label="Days available" required><SchedulePicker days={days} onDays={value => { setTouched(true); setDays(value) }} /></Field>
        {signedIn && <p className={polish.prefillNote}>Account contact details prefilled where available. You can edit them.</p>}
        <Field label="Student name" hint="Optional if you prefer not to share it yet."><input className={styles.input} value={learner} onChange={e => { setTouched(true); setLearner(e.target.value) }} maxLength={60} autoComplete="off" /></Field>
        <Field label="Parent or guardian phone" required><input className={styles.input} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e => { setTouched(true); setPhone(e.target.value.replace(/[^0-9+ -]/g, '').slice(0, 16)) }} onBlur={() => setPhone(current => normalizedPhone(current))} placeholder="07XX XXX XXX" aria-invalid={phone.length > 0 && !validKenyanPhone(phone)} />{phone.length > 0 && !validKenyanPhone(phone) && <span className={styles.hint}>Enter a valid Kenyan mobile number.</span>}</Field>
        <div className={styles.formActions}><button type="button" className={styles.btnSecondary} onClick={clearForm}>Clear form</button><button type="submit" className={styles.btnSubmit} disabled={!validForm}>Find a tutor</button></div>
      </form>
    </div>
  )
}
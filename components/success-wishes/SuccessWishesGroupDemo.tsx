'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './SuccessWishesGroupDemo.module.css'

type Student = { id: number; name: string; message: string; design: string }
const designs = ['Heritage', 'Botanical', 'Nightfall', 'Sunrise']
const makeStudent = (id: number): Student => ({ id, name: '', message: '', design: 'Heritage' })

export default function SuccessWishesGroupDemo({ onClose }: { onClose: () => void }) {
  const [students, setStudents] = useState<Student[]>([makeStudent(1), makeStudent(2)])
  const [sender, setSender] = useState('')
  const [step, setStep] = useState<'names' | 'cards' | 'review'>('names')
  const [active, setActive] = useState(0)
  const [copyForAll, setCopyForAll] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const nextId = useRef(3)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    function keydown(event: KeyboardEvent) { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', keydown)
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', keydown) }
  }, [onClose])

  function update(index: number, fields: Partial<Student>) {
    setStudents(items => items.map((s, i) => i === index ? { ...s, ...fields } : s))
  }
  function add() {
    if (students.length < 4) setStudents(items => [...items, makeStudent(nextId.current++)])
  }
  function remove(index: number) {
    if (students.length > 2) { setStudents(items => items.filter((_, i) => i !== index)); setActive(0) }
  }
  const current = students[active]
  const namesReady = students.every(s => s.name.trim()) && new Set(students.map(s => s.name.trim().toLowerCase())).size === students.length
  const cardsReady = students.every(s => s.message.trim()) && sender.trim().length > 0

  return (
    <div className={styles.backdrop} onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="group-demo-title" tabIndex={-1} ref={dialogRef}>
        <header className={styles.header}>
          <div><span className={styles.eyebrow}>GROUP WISHES · DEMO</span><h2 id="group-demo-title">Four smiles. One price.</h2><p>Up to 4 cards · KSh 100</p></div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close group demo">×</button>
        </header>
        <nav className={styles.steps} aria-label="Demo progress">
          <span className={step === 'names' ? styles.selected : ''}>1. Students</span>
          <span className={step === 'cards' ? styles.selected : ''}>2. Cards</span>
          <span className={step === 'review' ? styles.selected : ''}>3. Review</span>
        </nav>
        <div className={styles.body}>
          {step === 'names' && <section>
            <div className={styles.row}><h3>Add students</h3><small>{students.length} of 4</small></div>
            {students.map((student, i) => <div key={student.id} className={styles.nameRow}>
              <label><span>Student {i + 1}</span><input maxLength={80} value={student.name} placeholder="Student name" onChange={e => update(i, { name: e.target.value })}/></label>
              {i > 1 && <button type="button" className={styles.remove} onClick={() => remove(i)} aria-label={'Remove student ' + (i + 1)}>×</button>}
            </div>)}
            {students.length < 4 && <button className={styles.secondary} type="button" onClick={add}>+ Add {students.length === 2 ? "third" : "fourth"} student</button>}
            <p className={styles.hint}>Each student gets a personal card and private link.</p>
          </section>}
          {step === 'cards' && <section>
            <div className={styles.row}><h3>Personalise</h3><small>{active + 1} of {students.length}</small></div>
            <div className={styles.tabs} role="group" aria-label="Choose student">
              {students.map((s,i) => <button key={s.id} type="button" className={i === active ? styles.activeTab : ''} onClick={() => setActive(i)}>{s.name}{s.message.trim() ? ' ✓' : ''}</button>)}
            </div>
            <label className={styles.field}><span>Your name</span><input maxLength={80} placeholder="Sender name" value={sender} onChange={e => setSender(e.target.value)}/></label>
            <label className={styles.field}><span>Card design</span><select value={current.design} onChange={e => update(active,{design:e.target.value})}>{designs.map(d=><option key={d} value={d}>{d}</option>)}</select></label>
            <label className={styles.field}><span>Message for {current.name}</span><textarea rows={4} maxLength={220} value={current.message} placeholder="Write a personal wish…" onChange={e => update(active,{message:e.target.value})}/></label>
            <label className={styles.toggle}><input type="checkbox" checked={copyForAll} onChange={e => setCopyForAll(e.target.checked)}/>Use this message for all students</label>
            <div className={styles.miniCard} aria-label={'Preview card for '+ current.name}>
              <small>{current.design.toUpperCase()} · SUCCESS WISHES 2026</small>
              <strong>To {current.name}</strong>
              <p>{current.message || 'Your message appears here.'}</p>
              <span>From {sender || 'Your name'}</span>
            </div>
          </section>}
          {step === 'review' && <section>
            <h3>Review your wishes</h3>
            <div className={styles.reviewList}>{students.map((s,i)=><div key={s.id} className={styles.reviewItem}><div><strong>{s.name}</strong><small>{s.design} · {s.message}</small></div><button type="button" onClick={()=>{setActive(i);setStep('cards')}}>Edit</button></div>)}</div>
            <div className={styles.total}><span>{students.length} personalised cards</span><strong>KSh 100</strong></div>
            <p className={styles.hint}>One payment. Separate private links for every student.</p>
            <div className={styles.demoNotice} role="status">Demo only — payment and sharing are not active.</div>
          </section>}
        </div>
        <footer className={styles.actions}>
          {step !== 'names' && <button type="button" className={styles.secondary} onClick={() => setStep(step === 'review' ? 'cards' : 'names')}>Back</button>}
          {step === 'names' && <button type="button" className={styles.primary} disabled={!namesReady} onClick={() => setStep('cards')}>Personalise cards</button>}
          {step === 'cards' && <button type="button" className={styles.primary} onClick={() => {
            if (copyForAll && current.message.trim()) {setStudents(items=>items.map(s=>({...s,message:current.message})));setCopyForAll(false)}
            if (active < students.length - 1) setActive(n=>n+1)
            else if (cardsReady || (copyForAll && current.message.trim() && sender.trim())) setStep('review')
          }}>{active === students.length - 1 ? 'Review wishes' : 'Next student'}</button>}
          {step === 'review' && <button type="button" className={styles.primary} disabled>Pay KSh 100 · Coming soon</button>}
        </footer>
      </div>
    </div>
  )
}

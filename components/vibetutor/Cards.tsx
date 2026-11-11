'use client'

import { useState } from 'react'
import Link from 'next/link'
import styles from './VibeTutor.module.css'
import Icon from './Icon'
import { modeLabel, summarizeDays, summarizeParts, type DemoRequest, type DemoTutor } from './data'

export function TutorCard({ t }: { t: DemoTutor }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <article className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.avatar} aria-hidden="true">{t.initials}</div>
          <div className={styles.cardTitleWrap}>
            <h3 className={styles.cardTitle}>{t.name}</h3>
            <p className={styles.muted}><Icon name="pin" size={14} /> {t.area}</p>
          </div>
          {!t.real && <span className={styles.demo}>Example</span>}
        </div>
        <div className={styles.tags}>{t.subjects.map(s => <span key={s} className={styles.tag}>{s}</span>)}</div>
        <p className={styles.meta}>{t.levels.join(' · ')}</p>
        <div className={styles.cardFoot}>
          <p className={styles.price}>KSh {t.rateKes.toLocaleString('en-KE')}<span className={styles.priceUnit}> / hour</span></p>
          <span className={styles.modeText}>{modeLabel(t.mode)}</span>
        </div>
        <p className={styles.holiday}>{t.holidayAvailable ? 'Holiday tuition' : 'Available days'} · {summarizeDays(t.days)}</p>
        <button type="button" className={styles.cardAction} onClick={() => setOpen(true)}>View tutor <Icon name="arrow" size={15} /></button>
      </article>
      {open && <div className={styles.modalBackdrop} role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false) }}>
        <section className={styles.detailModal} role="dialog" aria-modal="true" aria-labelledby={`tutor-${t.id}`}>
          <button type="button" className={styles.modalClose} onClick={() => setOpen(false)} aria-label="Close details">×</button>
          {!t.real && <span className={styles.demo}>Example profile</span>}
          <h2 id={`tutor-${t.id}`} className={styles.modalTitle}>{t.name}</h2>
          <p className={styles.muted}>{t.area} · {modeLabel(t.mode)}</p>
          <p className={styles.modalText}>{t.bio}</p>
          <div className={styles.tags}>{t.subjects.map(s => <span key={s} className={styles.tag}>{s}</span>)}</div>
          <p className={styles.meta}><strong>Levels:</strong> {t.levels.join(', ')}</p>
          <p className={styles.meta}><strong>Experience:</strong> {t.experience}</p>
          <p className={styles.meta}><strong>Availability:</strong> {summarizeDays(t.days)}</p>
          <p className={styles.modalPrice}>KSh {t.rateKes.toLocaleString('en-KE')} / hour</p>
          <p className={styles.hint}>{t.real ? 'Sign in to discuss tuition arrangements. Confirm the tutor and lesson details before attending.' : 'Example profile only. No tutor is connected to this example.'}</p>
          <Link href="/login" className={styles.modalSignIn}>Sign in to contact</Link>
        </section>
      </div>}
    </>
  )
}

export function RequestCard({ r }: { r: DemoRequest }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <article className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitleWrap}>
            <h3 className={styles.cardTitle}>{r.subjects.join(', ')}</h3>
            <p className={styles.muted}>{r.level} · {r.learnerLabel}</p>
          </div>
          {!r.real && <span className={styles.demo}>Example</span>}
        </div>
        <div className={styles.tags}><span className={styles.tag}><Icon name="pin" size={13} /> {r.area}</span><span className={styles.tag}>{modeLabel(r.mode)}</span></div>
        <p className={styles.meta}>{summarizeDays(r.days)} · {summarizeParts(r.dayparts)}</p>
        <div className={styles.cardFoot}>
          <p className={styles.price}>Up to KSh {r.budgetKes.toLocaleString('en-KE')}<span className={styles.priceUnit}> / hour</span></p>
          <span className={styles.modeText}>{r.postedDaysAgo === 1 ? 'Posted yesterday' : `Posted ${r.postedDaysAgo} days ago`}</span>
        </div>
        <button type="button" className={styles.cardAction} onClick={() => setOpen(true)}>View request <Icon name="arrow" size={15} /></button>
      </article>
      {open && <div className={styles.modalBackdrop} role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false) }}>
        <section className={styles.detailModal} role="dialog" aria-modal="true" aria-labelledby={`request-${r.id}`}>
          <button type="button" className={styles.modalClose} onClick={() => setOpen(false)} aria-label="Close details">×</button>
          {!r.real && <span className={styles.demo}>Example request</span>}
          <h2 id={`request-${r.id}`} className={styles.modalTitle}>{r.subjects.join(', ')}</h2>
          <p className={styles.muted}>{r.learnerLabel} · {r.level}</p>
          <p className={styles.modalText}>{r.note}</p>
          <p className={styles.meta}><strong>Area:</strong> {r.area}</p>
          <p className={styles.meta}><strong>Format:</strong> {modeLabel(r.mode)}</p>
          <p className={styles.meta}><strong>Available days:</strong> {summarizeDays(r.days)}</p>
          <p className={styles.meta}><strong>Preferred time:</strong> {summarizeParts(r.dayparts)}</p>
          <p className={styles.modalPrice}>Budget up to KSh {r.budgetKes.toLocaleString('en-KE')} / hour</p>
          <p className={styles.hint}>{r.real ? 'Sign in to respond. Parent or guardian oversight is required for learners under 18.' : 'Example request only. No learner is connected to this example.'}</p>
          <Link href="/login" className={styles.modalSignIn}>Sign in to respond</Link>
        </section>
      </div>}
    </>
  )
}

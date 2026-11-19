'use client'

import { useState } from 'react'
import Link from 'next/link'
import styles from './VibeTutor.module.css'
import Icon from './Icon'
import { defaultCharacter, vibeMePath } from '@/lib/vibeme'
import { modeLabel, summarizeDays, summarizeParts, type DemoRequest, type DemoTutor } from './data'

export function TutorCard({ t, compact = false, score }: { t: DemoTutor; compact?: boolean; score?: number }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      {compact ? <button type="button" className={styles.discoveryRow} onClick={() => setOpen(true)}>
        <span className={styles.discoveryAvatar} aria-hidden="true"><img src={t.avatarUrl ?? vibeMePath(defaultCharacter(t.id))} alt="" /></span>
        <span className={styles.discoveryCopy}>
          <strong>{t.name}</strong>
          <span className={styles.discoveryMeta}>{t.subjects.join(' · ')}</span>
          <span className={styles.discoveryMeta}>{t.levels.join(' · ')} · {modeLabel(t.mode)}</span>
          {t.real ? (score !== undefined ? <span className={styles.discoveryMatch}>{score}% match</span> : <span className={styles.discoveryMeta}>{t.area || modeLabel(t.mode)}</span>) : <span className={styles.demo}>Sample profile</span>}
        </span>
        <span className={styles.discoveryChevron} aria-hidden="true">›</span>
      </button> : <article className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.avatar} aria-hidden="true"><img src={t.avatarUrl ?? vibeMePath(defaultCharacter(t.id))} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%" }} /></div>
          <div className={styles.cardTitleWrap}>
            <h3 className={styles.cardTitle}>{t.name}</h3>
            <p className={styles.muted}><Icon name="pin" size={14} /> {t.area}</p>
          </div>
        </div>
        <div className={styles.tags}>{t.subjects.map(s => <span key={s} className={styles.tag}>{s}</span>)}</div>
        <p className={styles.meta}>{t.levels.join(' · ')}</p>
        <div className={styles.cardFoot}>
          <p className={styles.price}>{t.real ? 'KSh ' : 'Indicative KSh '}{t.rateKes.toLocaleString('en-KE')}<span className={styles.priceUnit}> / hour</span></p>
          <span className={styles.modeText}>{modeLabel(t.mode)}</span>
        </div>
        <p className={styles.holiday}>{t.real ? (t.holidayAvailable ? 'Holiday tuition' : 'Available days') + ' · ' + summarizeDays(t.days) : 'Sample profile · tutor matching'}</p>
        <button type="button" className={styles.cardAction} onClick={() => setOpen(true)}>{t.real ? 'View tutor' : 'View profile'} <Icon name="arrow" size={15} /></button>
      </article>}
      {open && <div className={styles.modalBackdrop} role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false) }}>
        <section className={styles.detailModal} role="dialog" aria-modal="true" aria-labelledby={`tutor-${t.id}`}>
          <button type="button" className={styles.modalClose} onClick={() => setOpen(false)} aria-label="Close details">×</button>
          <h2 id={`tutor-${t.id}`} className={styles.modalTitle}>{t.name}</h2>
          <p className={styles.muted}>{t.area} · {modeLabel(t.mode)}</p>
          {t.real && t.bio.trim() && <p className={styles.modalText}>{t.bio}</p>}
          <div className={styles.tags}>{t.subjects.map(s => <span key={s} className={styles.tag}>{s}</span>)}</div>
          <p className={styles.meta}><strong>Levels:</strong> {t.levels.join(', ')}</p>
          {t.real && t.experience.trim() && <p className={styles.meta}><strong>Experience:</strong> {t.experience}</p>}
          <p className={styles.meta}><strong>Availability:</strong> {t.real ? summarizeDays(t.days) : 'By request'}</p>
          <p className={styles.modalPrice}>{t.real ? 'KSh ' : 'Indicative KSh '}{t.rateKes.toLocaleString('en-KE')} / hour</p>
          <p className={styles.hint}>{t.real ? 'Sign in to discuss tuition arrangements.' : 'Sample profile. Request a matching tutor.'}</p>
          {t.real
            ? <Link href="/login" className={styles.modalSignIn}>Sign in to contact</Link>
            : <Link href={'/vibetutor/post-request?example=' + encodeURIComponent(t.id)} className={styles.modalSignIn}>Request tutor</Link>}
        </section>
      </div>}
    </>
  )
}

export function RequestCard({ r, compact = false, score }: { r: DemoRequest; compact?: boolean; score?: number }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      {compact ? <button type="button" className={styles.discoveryRow} onClick={() => setOpen(true)}>
        <span className={styles.discoveryAvatar} aria-hidden="true"><Icon name="user" size={30} /></span>
        <span className={styles.discoveryCopy}>
          <strong>{r.subjects.join(' · ')}</strong>
          <span className={styles.discoveryMeta}>{r.level} · {modeLabel(r.mode)}</span>
          {r.real ? (score !== undefined ? <span className={styles.discoveryMatch}>{score}% match</span> : <span className={styles.discoveryMeta}>{r.area || modeLabel(r.mode)}</span>) : <span className={styles.demo}>Example request</span>}
        </span>
        <span className={styles.discoveryChevron} aria-hidden="true">›</span>
      </button> : <article className={styles.card}>
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
      </article>}
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

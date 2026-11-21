'use client'

import { useEffect, useState } from 'react'
import { supabase, getSupabaseClient } from '@/lib/supabase'
import Link from 'next/link'
import styles from './VibeTutor.module.css'
import Icon from './Icon'
import { defaultCharacter, vibeMePath } from '@/lib/vibeme'
import { modeLabel, summarizeDays, summarizeParts, type DemoRequest, type DemoTutor } from './data'

export function TutorCard({ t, compact = false, score }: { t: DemoTutor; compact?: boolean; score?: number }) {
  const [open, setOpen] = useState(false)
  if (!t.real) return null
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
          <Link href="/login" className={styles.modalSignIn}>Sign in to contact</Link>
        </section>
      </div>}
    </>
  )
}

export function RequestCard({ r, compact = false, score, signedIn = false }: { r: DemoRequest; compact?: boolean; score?: number; signedIn?: boolean }) {
  const [open, setOpen] = useState(false)
  const [intro, setIntro] = useState('I am available to help with tutoring. Please reply through VibeTutor if you would like to discuss.')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [contactError, setContactError] = useState('')
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('request') === r.id) setOpen(true)
  }, [r.id])
  async function sendInterest() {
    if (sending || sent) return
    setSending(true); setContactError('')
    try {
      const {data:{user},error:authError} = await getSupabaseClient().auth.getUser()
      if (authError || !user) { setContactError('Sign in before contacting the request owner.'); return }
      const {error} = await supabase.rpc('vibetutor_request_interest_send',{p_request:r.id,p_message:intro.trim()})
      if (error) { setContactError('Unable to contact this request owner. Check that you have a published tutor profile or review your existing enquiry.'); return }
      setSent(true)
    } catch { setContactError('Could not send your enquiry. Try again.') }
    finally { setSending(false) }
  }
  return (
    <>
      {compact ? <button type="button" className={styles.discoveryRow} onClick={() => setOpen(true)}>
        <span className={styles.discoveryAvatar} aria-hidden="true"><Icon name="user" size={30} /></span>
        <span className={styles.discoveryCopy}>
          <strong>{r.learnerLabel}</strong>
          <span className={styles.discoveryMeta}>{r.subjects.join(' · ')}</span>
          <span className={styles.discoveryMeta}>{r.level} · {modeLabel(r.mode)} · {r.area}</span>
          <span className={styles.discoveryMeta}>{summarizeDays(r.days)} · {summarizeParts(r.dayparts)} · {r.budgetKes ? `KSh ${r.budgetKes}/hr` : 'Budget open'}</span>
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

          <p className={styles.meta}><strong>Area:</strong> {r.area}</p>
          <p className={styles.meta}><strong>Format:</strong> {modeLabel(r.mode)}</p>
          <p className={styles.meta}><strong>Available days:</strong> {summarizeDays(r.days)}</p>
          <p className={styles.meta}><strong>Preferred time:</strong> {summarizeParts(r.dayparts)}</p>
          <p className={styles.modalPrice}>Budget up to KSh {r.budgetKes.toLocaleString('en-KE')} / hour</p>
          <p className={styles.hint}>{r.real ? 'Sign in to respond. Only verified tutors can send enquiries to the adult who posted this request.' : 'Example request only. No learner is connected to this example.'}</p>
          {!signedIn ? <Link href={'/login?redirect=' + encodeURIComponent('/vibetutor/browse?view=students&request=' + r.id)} className={styles.modalSignIn}>Sign in to contact request owner</Link> :
            <div><label htmlFor={'interest-' + r.id}>Introduce yourself to the request owner</label>
              <textarea id={'interest-' + r.id} className={styles.input} value={intro} maxLength={500} rows={3} onChange={e => setIntro(e.target.value)} />
              <button className={styles.modalSignIn} type="button" disabled={sending || sent || intro.trim().length < 10} onClick={() => void sendInterest()}>{sent ? 'Interest sent' : sending ? 'Sending…' : 'Contact request owner'}</button>
              {contactError && <p role="alert" className={styles.hint}>{contactError}</p>}
              {sent && <p role="status" className={styles.hint}>Enquiry sent privately to the request owner. <Link href="/vibetutor/inquiries">View enquiries</Link></p>}
            </div>}
        </section>
      </div>}
    </>
  )
}

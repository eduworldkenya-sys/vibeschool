import Link from 'next/link'
import styles from './VibeTutor.module.css'
import Icon from './Icon'
import { modeLabel, summarizeDays, summarizeParts, type DemoRequest, type DemoTutor } from './data'

export function TutorCard({ t }: { t: DemoTutor }) {
  return (
    <article className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.avatar} aria-hidden="true">{t.initials}</div>
        <div className={styles.cardTitleWrap}>
          <h3 className={styles.cardTitle}>{t.name}</h3>
          <p className={styles.muted}><Icon name="pin" size={14} /> {t.area}</p>
        </div>
        <span className={styles.demo}>Example</span>
      </div>
      <p className={styles.rating}>
        <Icon name="star" size={14} className={styles.star} />
        <strong>{t.rating.toFixed(1)}</strong>
        <span className={styles.muted}>({t.reviews} reviews)</span>
      </p>
      <div className={styles.tags}>
        {t.subjects.map(s => <span key={s} className={styles.tag}>{s}</span>)}
      </div>
      <p className={styles.meta}>{t.levels.join(' · ')}</p>
      <div className={styles.cardFoot}>
        <p className={styles.price}>KSh {t.rateKes.toLocaleString('en-KE')}<span className={styles.priceUnit}> / hour</span></p>
        <span className={styles.modeText}>{modeLabel(t.mode)}</span>
      </div>
      {t.holidayAvailable && <p className={styles.holiday}>Available this holiday</p>}
      <Link href="/login" className={styles.btnDisabled}>Sign in to contact</Link>
    </article>
  )
}

export function RequestCard({ r }: { r: DemoRequest }) {
  return (
    <article className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitleWrap}>
          <h3 className={styles.cardTitle}>{r.subjects.join(', ')}</h3>
          <p className={styles.muted}>{r.level} · {r.learnerLabel}</p>
        </div>
        <span className={styles.demo}>Demo</span>
      </div>
      <div className={styles.tags}>
        <span className={styles.tag}><Icon name="pin" size={13} /> {r.area}</span>
        <span className={styles.tag}>{modeLabel(r.mode)}</span>
      </div>
      <p className={styles.meta}>{summarizeDays(r.days)} · {summarizeParts(r.dayparts)}</p>
      <div className={styles.cardFoot}>
        <p className={styles.price}>Up to KSh {r.budgetKes.toLocaleString('en-KE')}<span className={styles.priceUnit}> / hour</span></p>
        <span className={styles.modeText}>{r.postedDaysAgo === 1 ? 'Posted yesterday' : `Posted ${r.postedDaysAgo} days ago`}</span>
      </div>
      <Link href="/login" className={styles.btnDisabled}>Sign in to respond</Link>
    </article>
  )
}

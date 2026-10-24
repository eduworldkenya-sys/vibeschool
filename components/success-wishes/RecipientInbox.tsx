'use client'

import { Heart, LockKeyhole, LogOut, Sparkles } from 'lucide-react'
import styles from './SuccessWishes.module.css'
import inbox from './RecipientInbox.module.css'
import WishCardExperience from './WishCardExperience'

export type InboxMessage = {
  id: string; senderName: string; relationship: string
  kind: 'text' | 'voice' | 'video'; state: 'request' | 'available'
  text?: string | null; createdAt: string; mediaUrl?: string | null
}
export type InboxViewingWindow = { weekday: number; startsAt: string; endsAt: string; venue: string; guidance: string }
export type InboxAction = 'accept' | 'hide' | 'block' | 'report'

type Props = {
  schoolName?: string
  messages: InboxMessage[]
  viewingTimes: InboxViewingWindow[]
  loaded: boolean
  busy: boolean
  error: string
  onRetry: () => void
  onSignOut: () => void
  onAct: (messageId: string, action: InboxAction) => void
  onPlayVoice: (messageId: string) => void
  onPlayVideo: (messageId: string) => void
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function SafetyMenu({ message, busy, onAct }: { message: InboxMessage; busy: boolean; onAct: Props['onAct'] }) {
  return <details className={inbox.safety}>
    <summary>More options</summary>
    <div className={inbox.safetyRow}>
      {message.state === 'available' && <button type="button" className={inbox.safetyButton} disabled={busy} onClick={() => onAct(message.id, 'hide')}>Hide message</button>}
      <button type="button" className={inbox.safetyButton} disabled={busy} onClick={() => onAct(message.id, 'block')}>Block sender</button>
      <button type="button" className={inbox.safetyButton} disabled={busy} onClick={() => onAct(message.id, 'report')}>Report message</button>
    </div>
  </details>
}

// Presentation only. Identity, consent, acceptance and private playback stay in the inbox APIs.
export default function RecipientInbox({ schoolName, messages, viewingTimes, loaded, busy, error, onRetry, onSignOut, onAct, onPlayVoice, onPlayVideo }: Props) {
  const ready = messages.filter(message => message.state === 'available').length
  const waiting = messages.length - ready
  const summary = !loaded ? 'Loading your wishes…'
    : messages.length === 0 ? 'Nothing here yet.'
    : `${ready} ${ready === 1 ? 'wish' : 'wishes'} ready` + (waiting > 0 ? ` · ${waiting} waiting for you to accept` : '')

  return <section className={styles.panel} aria-label="Your private success wishes">
    <div className={inbox.header}>
      <div>
        <span className={inbox.eyebrow}><Sparkles size={14} aria-hidden="true" />JUST FOR YOU</span>
        <h2 className={inbox.title}>Your success wishes</h2>
        <p className={inbox.summary} aria-live="polite">{summary}</p>
      </div>
      <button type="button" className={[styles.secondary, inbox.signOutTop].join(' ')} disabled={busy} onClick={onSignOut}>
        <LogOut size={15} aria-hidden="true" />Finish &amp; sign out
      </button>
    </div>

    {error && <div className={styles.error} role="alert">{error}</div>}
    {busy && <p className={styles.status} role="status">Please wait…</p>}
    {!loaded && !busy && <button className={styles.secondary} type="button" onClick={onRetry}>Retry loading messages</button>}

    {loaded && messages.length === 0 && <div className={inbox.empty}>
      <Heart size={32} aria-hidden="true" />
      <h3>No wishes yet</h3>
      <p className={styles.hint}>When someone sends you a message and it is ready, it will appear here.</p>
    </div>}

    <div className={inbox.list}>
      {messages.map(message => {
        const date = new Date(message.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
        if (message.state === 'request') {
          const initial = (Array.from(message.senderName.trim())[0] || '?').toUpperCase()
          return <article key={message.id} className={inbox.request} aria-label={'Wish waiting from ' + message.senderName}>
            <div className={inbox.requestHead}>
              <span className={inbox.miniSeal} aria-hidden="true">{initial}</span>
              <div>
                <strong>{message.senderName} sent you a wish</strong>
                <small>{message.relationship} · Sender-provided name · {date}</small>
              </div>
            </div>
            <p className={inbox.requestNote}>It stays sealed until you accept it. Only open messages from people you recognise.</p>
            <div className={inbox.requestActions}>
              <button type="button" className={inbox.accept} disabled={busy} onClick={() => onAct(message.id, 'accept')}>Accept &amp; open</button>
              <button type="button" className={inbox.decline} disabled={busy} onClick={() => onAct(message.id, 'hide')}>Not now</button>
            </div>
            <SafetyMenu message={message} busy={busy} onAct={onAct} />
          </article>
        }
        return <article key={message.id} className={inbox.card} aria-label={'Wish from ' + message.senderName}>
          <div className={inbox.cardTop}>
            <div><strong>{message.senderName}</strong><small>{message.relationship} · Sender-provided name</small></div>
            <time dateTime={message.createdAt}>{date}</time>
          </div>
          <WishCardExperience recipient="You" school={schoolName} sender={message.senderName} text={message.text} kind={message.kind}
            mediaUrl={message.mediaUrl} busy={busy}
            onPlay={message.kind === 'voice' ? () => onPlayVoice(message.id) : message.kind === 'video' ? () => onPlayVideo(message.id) : undefined} />
          <SafetyMenu message={message} busy={busy} onAct={onAct} />
        </article>
      })}
    </div>

    <section className={styles.section} aria-label="School-device viewing sessions">
      <h3>School-device viewing times</h3>
      <p className={styles.hint}>No personal phone? Ask school staff about using a shared device. Times are in East Africa Time (EAT).</p>
      {viewingTimes.length > 0
        ? <div className={styles.results}>{viewingTimes.map((item, index) => <div className={styles.school} key={`${item.weekday}-${item.startsAt}-${index}`}>
          <div><strong>{DAYS[item.weekday]} · {item.startsAt.slice(0, 5)}–{item.endsAt.slice(0, 5)} EAT</strong>
            <span>{item.venue}{item.guidance ? ' · ' + item.guidance : ''}</span></div>
        </div>)}</div>
        : <p className={styles.status}>No school-device viewing times are currently listed. Check with your school.</p>}
    </section>

    <button type="button" className={inbox.finish} disabled={busy} onClick={onSignOut}>
      <LockKeyhole size={16} aria-hidden="true" />Finish &amp; sign out
    </button>
    <p className={inbox.finishNote}>Using a shared device? Finish and sign out before handing it back.</p>
  </section>
}

'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Inbox, LockKeyhole, RotateCcw, Send, ShieldCheck } from 'lucide-react'
import styles from '@/components/success-wishes/SuccessWishes.module.css'

type Status = 'compose' | 'request' | 'accepted' | 'hidden'
const SCHOOL = 'VibeSchool Test Academy'
const CANDIDATE = 'Test Candidate'
const SENDER = 'Test Sender'

// Deliberately browser-memory-only. Never connects to actual sending,
// verification, school or candidate APIs; never stores or transmits text.
export default function TextTestClient() {
  const [tab, setTab] = useState<'sender' | 'candidate'>('sender')
  const [text, setText] = useState('I believe in you. All the best in your exams!')
  const [status, setStatus] = useState<Status>('compose')
  const [showPreview, setShowPreview] = useState(false)
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')

  function reset() {
    setTab('sender'); setText('I believe in you. All the best in your exams!')
    setStatus('compose'); setShowPreview(false); setConsent(false); setError('')
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (status !== 'compose') return
    if (text.trim().length < 1 || text.trim().length > 2000 || !consent) {
      setError('Write a message and confirm that you are testing with fictitious details.')
      return
    }
    setShowPreview(true)
  }

  function simulateSend() {
    if (status !== 'compose' || !showPreview || !consent || !text.trim()) return
    setStatus('request')
    setShowPreview(false)
    setTab('candidate')
  }

  return <div className={styles.page}>
    <header className={styles.header}>
      <Link className={styles.brand} href="/success-wishes">VibeSchool</Link>
      <div className={styles.headerNote}><ShieldCheck size={16} aria-hidden="true" /> Preview test only</div>
    </header>
    <main className={styles.main}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>SUCCESS WISHES · CONTROLLED TEST</p>
        <h1>Test the text journey.</h1>
        <p>Walk through a synthetic sender-to-candidate experience. This is a browser-only simulation; no actual email, school, candidate, payment or server message is used.</p>
      </div>
      <section className={styles.notice} role="status">
        <strong>Test environment — not real delivery.</strong> Use fictitious details only. Your message exists in this tab's memory and disappears on refresh.
      </section>
      <nav className={styles.tabs} aria-label="Test journey roles">
        <button type="button" className={tab === 'sender' ? styles.activeTab+' '+styles.tab : styles.tab} onClick={() => setTab('sender')}>Sender</button>
        <button type="button" className={tab === 'candidate' ? styles.activeTab+' '+styles.tab : styles.tab} onClick={() => setTab('candidate')}>Candidate</button>
      </nav>
      {tab === 'sender' ? <section className={styles.panel} aria-label="Synthetic sender">
        <h2>Send your support</h2>
        <p className={styles.hint}>Fictitious school and candidate are preselected so no real learner information can be entered.</p>
        <div className={styles.section}>
          <div className={styles.grid}>
            <label className={styles.field}>School<input readOnly value={SCHOOL} /></label>
            <label className={styles.field}>Candidate<input readOnly value={CANDIDATE} /></label>
            <label className={styles.field}>From<input readOnly value={SENDER} /></label>
            <label className={styles.field}>Relationship<input readOnly value="Family friend (test)" /></label>
          </div>
        </div>
        {status === 'compose' ? showPreview ? <div className={styles.preview}>
          <h3>Review the wish</h3>
          <p className={styles.messageText}>{text}</p>
          <p className={styles.hint}>This will create a simulated message request visible only in this browser tab.</p>
          <div className={styles.actions}>
            <button className={styles.secondary} type="button" onClick={() => setShowPreview(false)}><ArrowLeft size={15} /> Edit message</button>
            <button className={styles.primary} type="button" onClick={simulateSend}><Send size={16}/> Send test wish <ArrowRight size={15}/></button>
          </div>
        </div> : <form onSubmit={submit} className={styles.section}>
          <label className={styles.field}>Your text wish
            <textarea value={text} onChange={event => setText(event.target.value)} maxLength={2000} required placeholder="Write a test message" />
          </label>
          <p className={styles.count}>{text.length} / 2000 characters</p>
          <label className={styles.consent}>
            <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} required />
            <span>I understand this is a synthetic test and I will not enter personal information.</span>
          </label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.actions}><span className={styles.hint}><LockKeyhole size={12} aria-hidden="true"/> No data transmitted</span><button type="submit" className={styles.primary} disabled={!text.trim() || !consent}>Preview wish <ArrowRight size={16}/></button></div>
        </form> : <div className={styles.section}>
          <div className={styles.notice}><Check size={16} aria-hidden="true"/> Synthetic wish created in this tab. This is not a delivery receipt.</div>
          <p className={styles.messageText}>{text}</p>
          <button type="button" className={styles.secondary} onClick={() => setTab('candidate')}>View test candidate inbox <ArrowRight size={15}/></button>
        </div>}
      </section> : <section className={styles.panel} aria-label="Synthetic candidate inbox">
        <div className={styles.inboxHeader}><div><h2>Test Candidate's inbox</h2><p className={styles.hint}>{SCHOOL} · browser-only test</p></div><Inbox size={24} aria-hidden="true"/></div>
        {status === 'compose' ? <div className={styles.empty}><h3>No wishes yet</h3><p className={styles.hint}>Switch to Sender to create a synthetic wish.</p><button className={styles.secondary} type="button" onClick={() => setTab('sender')}>Go to sender</button></div> :
          <article className={styles.message}><div className={styles.messageHeader}><div><strong>{SENDER}</strong><small>Family friend (test) · fictitious</small></div></div>
          {status === 'request' ? <>
            <p className={styles.status}>A test message request is waiting. Accept it to reveal the text, or hide it.</p>
            <div className={styles.actions}><button className={styles.primary} type="button" onClick={() => setStatus('accepted')}><Check size={15}/> Accept test wish</button><button className={styles.secondary} type="button" onClick={() => setStatus('hidden')}>Hide wish</button></div>
          </> : status === 'accepted' ? <><p className={styles.status}>Accepted — this text is visible only after acceptance.</p><p className={styles.messageText}>{text}</p><button type="button" className={styles.secondary} onClick={() => setStatus('hidden')}>Hide wish</button></> : <p className={styles.status}>This simulated wish was hidden and cannot be opened.</p>}
          </article>}
      </section>}
      <div className={styles.actions}>
        <button type="button" className={styles.quiet} onClick={reset}><RotateCcw size={15} aria-hidden="true"/> Reset test</button>
        <Link href="/success-wishes" className={styles.quiet}>Return to Success Wishes <ArrowRight size={15} aria-hidden="true"/></Link>
      </div>
      <p className={styles.footer}>This page tests interface behavior, not actual OTP delivery, school authorisation, database persistence or candidate-device security. Real Success Wishes remains disabled.</p>
    </main>
  </div>
}

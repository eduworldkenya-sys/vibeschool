'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { TrackedLink } from '@/components/public/TrackedLink'
import { trackPublicEvent } from '@/lib/publicTelemetry'
import styles from './contact.module.css'

const WHATSAPP_NUMBER = '254728232157'
const topics = [
  { key: 'general', label: 'A general question', detail: 'About VibeSchool and how it works' },
  { key: 'school', label: 'Schools & partnerships', detail: 'Schools, organisations and collaborations' },
  { key: 'account', label: 'Account or login help', detail: 'Access, sign-in or a technical problem' },
  { key: 'safety', label: 'Privacy or child safety', detail: 'A concern that needs careful handling' },
  { key: 'careers', label: 'Careers', detail: 'Working with VibeSchool' },
] as const

type Topic = (typeof topics)[number]['key']
type SupportCategory = 'account' | 'school_access' | 'student_access' | 'technical' | 'privacy' | 'legal' | 'safety' | 'other'

const accountIssues: ReadonlyArray<readonly [SupportCategory, string]> = [
  ['account', 'Account or login'], ['school_access', 'School access'],
  ['student_access', 'Learner access'], ['technical', 'Technical problem'],
  ['other', 'Something else'],
]
const sensitiveIssues: ReadonlyArray<readonly [SupportCategory, string]> = [
  ['safety', 'Child safety or safeguarding'], ['privacy', 'Privacy or personal information'],
  ['legal', 'Legal concern'],
]

const whatsappIntroductions: Record<'general' | 'school' | 'account' | 'safety', string> = {
  general: 'Hello VibeSchool. I have a question about your services.',
  school: 'Hello VibeSchool. I would like to discuss using or working with VibeSchool at a school or organisation.',
  account: 'Hello VibeSchool. I cannot access my account. Please advise how I can get help without sharing a password or login code.',
  safety: 'Hello VibeSchool. I need to raise a privacy or safeguarding concern. How can I report it without sending private learner information here?',
}

function whatsappLink(topic: keyof typeof whatsappIntroductions) {
  return 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(whatsappIntroductions[topic])
}

export default function ContactPage() {
  const [topic, setTopic] = useState<Topic>('general')
  const [signedIn, setSignedIn] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [category, setCategory] = useState<SupportCategory>('account')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [ticketId, setTicketId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    supabase.auth.getUser()
      .then(({ data: { user } }) => { if (active) setSignedIn(Boolean(user)) })
      .catch(() => { if (active) setSignedIn(false) })
      .finally(() => { if (active) setAuthReady(true) })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      setSignedIn(Boolean(session?.user))
      setAuthReady(true)
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  function choose(next: Topic) {
    setTopic(next)
    setCategory(next === 'safety' ? 'safety' : 'account')
    setResult(null)
    setTicketId(null)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setResult(null)
    setTicketId(null)
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        setSignedIn(false)
        setResult('Your session has ended. Sign in again to send a private support request.')
        return
      }
      if (subject.trim().length < 3 || message.trim().length < 10) {
        setResult('Add a short subject and a little more detail about what happened.')
        return
      }
      const { data: caseId, error } = await supabase.rpc('submit_contact_request', {
        p_category: category, p_subject: subject.trim(), p_message: message.trim(),
      })
      if (error || caseId == null) {
        setResult("We couldn't send your request. Please try again.")
        return
      }
      trackPublicEvent('public_contact_support_submit', '/contact')
      setSubject('')
      setMessage('')
      setTicketId(String(caseId))
      setResult('Request received. Keep this reference for follow-up.')
    } catch {
      setResult("We couldn't send your request. Please check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  const privateTopic = topic === 'account' || topic === 'safety'
  return (
    <div className={styles.page}>
      <PublicHeader product="Contact" />
      <main id="main-content">
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <p className={styles.eyebrow}>CONTACT VIBESCHOOL</p>
            <h1>What brings you here?</h1>
            <p>Choose what you need. We’ll show you the next step.</p>
          </div>
        </section>

        <section className={styles.contactSection} aria-label="Contact VibeSchool">
          <div className={styles.contactInner}>
            <fieldset className={styles.topicList}>
              <legend><span className={styles.step}>01</span> What is this about?</legend>
              {topics.map(item => (
                <button key={item.key} type="button" className={styles.topicButton} aria-pressed={topic === item.key} onClick={() => choose(item.key)}>
                  <span className={styles.topicText}><strong>{item.label}</strong><small>{item.detail}</small></span>
                  <span className={styles.topicArrow} aria-hidden="true">{topic === item.key ? '●' : '→'}</span>
                </button>
              ))}
            </fieldset>

            <section className={styles.nextStep} aria-labelledby="contact-next" aria-live="polite">
              <p className={styles.stepHeading}><span className={styles.step}>02</span> YOUR NEXT STEP</p>

              {topic === 'general' && (
                <>
                  <h2 id="contact-next">Ask us directly.</h2>
                  <p>Have a question about VibeSchool? Start a WhatsApp conversation. You don’t need an account.</p>
                  <TrackedLink className={styles.primaryAction} href={whatsappLink('general')} event="public_contact_whatsapp" external target="_blank" rel="noopener noreferrer">Chat on WhatsApp <span aria-hidden="true">↗</span></TrackedLink>
                  <p className={styles.contactNumber}>WhatsApp · 0728 232 157</p>
                </>
              )}

              {topic === 'school' && (
                <>
                  <h2 id="contact-next">Tell us about your school or idea.</h2>
                  <p>Exploring VibeSchool for a school, institution, government programme or partnership? Start with a short WhatsApp message.</p>
                  <TrackedLink className={styles.primaryAction} href={whatsappLink('school')} event="public_institution_contact" external target="_blank" rel="noopener noreferrer">Start the conversation <span aria-hidden="true">↗</span></TrackedLink>
                  <p className={styles.contactNumber}>WhatsApp · 0728 232 157</p>
                </>
              )}

              {topic === 'careers' && (
                <>
                  <h2 id="contact-next">Interested in working with us?</h2>
                  <p>Explore the careers page for information about opportunities at VibeSchool.</p>
                  <Link className={styles.primaryAction} href="/careers">Explore careers <span aria-hidden="true">→</span></Link>
                </>
              )}

              {privateTopic && (
                <>
                  <h2 id="contact-next">{topic === 'account' ? 'Let’s sort out your account.' : 'Tell us about your concern.'}</h2>
                  <p>{topic === 'account'
                    ? 'For account or school-access problems, a signed-in request helps us find the right records without asking for passwords.'
                    : 'For privacy or learner-safety concerns, share the minimum detail needed. Do not include private learner records or passwords in public messages.'}</p>
                  {!authReady && <p className={styles.statusText} role="status">Checking your sign-in status…</p>}
                  {authReady && !signedIn && (
                    <div className={styles.accountActions}>
                      <Link className={styles.primaryAction} href="/login/global">Sign in for private support <span aria-hidden="true">→</span></Link>
                      <p className={styles.recoveryLead}>{topic === 'account' ? 'Can’t sign in?' : 'Can’t use your account?'}</p>
                      <TrackedLink className={styles.secondaryAction} href={whatsappLink(topic)} event="public_contact_whatsapp" external target="_blank" rel="noopener noreferrer">Ask how to get help on WhatsApp <span aria-hidden="true">↗</span></TrackedLink>
                    </div>
                  )}
                  {authReady && signedIn && (
                    <form className={styles.form} onSubmit={submit}>
                      <label>What needs attention?
                        <select value={category} onChange={e => setCategory(e.target.value as SupportCategory)}>
                          {(topic === 'safety' ? sensitiveIssues : accountIssues).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </label>
                      <label>Subject
                        <input value={subject} onChange={e => setSubject(e.target.value)} minLength={3} maxLength={160} required placeholder="A few words about the issue" />
                      </label>
                      <label>What happened?
                        <textarea value={message} onChange={e => setMessage(e.target.value)} minLength={10} maxLength={5000} required rows={5} placeholder="Tell us what happened and what help you need" />
                      </label>
                      <p className={styles.formHint}>Do not include passwords, one-time codes, payment PINs or unnecessary learner details.</p>
                      <button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send support request'}</button>
                    </form>
                  )}
                  {result && <div className={styles.result} role="status">{result}{ticketId && <div><strong>Reference: {ticketId}</strong></div>}</div>}
                  {topic === 'safety' && <p className={styles.urgentNote}>If someone is in immediate danger, contact local emergency or safeguarding authorities. This form is not an emergency service.</p>}
                </>
              )}
            </section>
          </div>
        </section>
      </main>
      <PublicFooter hideSupport />
    </div>
  )
}

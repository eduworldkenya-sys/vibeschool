'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Heart, LockKeyhole, Mail, Mic, Search, ShieldCheck, Video } from 'lucide-react'
import styles from './SuccessWishes.module.css'

type School = { id: string; name: string; county: string | null }
type Configuration = { enabled: boolean; mediaEnabled: boolean; paymentsEnabled: boolean; maxSeconds: number; maxBytes: number }
type Kind = 'text' | 'voice' | 'video'
type Message = { id: string; senderName: string; relationship: string; kind: Kind; state: 'request' | 'available'; text?: string | null; createdAt: string; mediaUrl?: string | null }
type ViewingWindow = { weekday: number; startsAt: string; endsAt: string; venue: string; guidance: string }
type Receipt = { reference?: string; managementToken?: string; status?: string; message?: string }
type SavedWishDraft = {
  savedAt: number; school: School; admissionNumber: string; candidateName: string;
  senderName: string; relationship: string; text: string; retryKey: string
}
const DRAFT_KEY = 'vs-success-wishes-private-tab-draft-v1'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(typeof body?.error === 'string' ? body.error : 'This could not be completed. Please try again.')
  return body as T
}

function SchoolPicker({ selected, onChange, disabled = false }: { selected: School | null; onChange: (value: School | null) => void; disabled?: boolean }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<School[]>([])
  const [busy, setBusy] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')
  const generation = useRef(0)

  async function search() {
    const current = ++generation.current
    setBusy(true); setError(''); setSearched(false)
    try {
      const data = await request<{ schools: School[]; available: boolean; error?: string }>(`/api/success-wishes/schools?q=${encodeURIComponent(query.trim())}`)
      if (current !== generation.current) return
      if (!data.available) throw new Error(data.error || 'School search is unavailable. Please try again later.')
      setResults(data.schools); setSearched(true)
    } catch (reason) {
      if (current === generation.current) { setResults([]); setError(reason instanceof Error ? reason.message : 'School search could not load.') }
    } finally { if (current === generation.current) setBusy(false) }
  }

  if (selected) return <div className={styles.chosen}><ShieldCheck size={20} aria-hidden="true"/><div><strong>{selected.name}</strong><small>{selected.county || 'Kenya'}</small></div><button className={styles.quiet} type="button" disabled={disabled} onClick={() => { generation.current++; onChange(null); setResults([]); setSearched(false) }}>Change</button></div>

  return <div>
    <label className={styles.field}><span>School</span><div className={styles.searchRow}><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search school name" disabled={disabled || busy} maxLength={100} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void search() } }}/><button type="button" className={styles.secondary} onClick={() => void search()} disabled={disabled || busy || query.trim().length < 2}><Search size={16} aria-hidden="true"/>{busy ? 'Searching…' : 'Find'}</button></div></label>
    {error && <p className={styles.status} role="alert">{error}</p>}
    {searched && results.length === 0 && <p className={styles.status} role="status">No participating schools found. Check the name or contact your school.</p>}
    <div className={styles.results} aria-live="polite">{results.map(school => <button type="button" className={styles.school} key={school.id} onClick={() => onChange(school)}><div><strong>{school.name}</strong><span>{school.county || 'Kenya'}</span></div><span aria-hidden="true">→</span></button>)}</div>
  </div>
}

function SendForm({ config }: { config: Configuration | null }) {
  const [school, setSchool] = useState<School | null>(null)
  const [admissionNumber, setAdmissionNumber] = useState('')
  const [candidateName, setCandidateName] = useState('')
  const [senderName, setSenderName] = useState('')
  const [senderEmail, setSenderEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [senderProof, setSenderProof] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [relationship, setRelationship] = useState('')
  const [kind, setKind] = useState<Kind>('text')
  const [text, setText] = useState('')
  const [consent, setConsent] = useState(false)
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [mediaUrl, setMediaUrl] = useState('')
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const idempotencyKey = useRef('')
  const restoreKey = useRef('')
  const [saveDraft, setSaveDraft] = useState(false)
  const [storedDraft, setStoredDraft] = useState<SavedWishDraft | null>(null)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const value: unknown = JSON.parse(raw)
      if (!value || typeof value !== 'object') return
      const data = value as Partial<SavedWishDraft>
      if (typeof data.savedAt !== 'number' || Date.now() - data.savedAt > 30 * 60 * 1000
        || !data.school || typeof data.school.id !== 'string'
        || typeof data.candidateName !== 'string' || typeof data.text !== 'string'
        || typeof data.admissionNumber !== 'string' || typeof data.senderName !== 'string'
        || typeof data.relationship !== 'string' || data.text.length > 2000) {
        sessionStorage.removeItem(DRAFT_KEY)
        return
      }
      setStoredDraft(data as SavedWishDraft)
    } catch { try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* storage unavailable */ } }
  }, [])

  function restoreDraft() {
    if (!storedDraft) return
    restoreKey.current = /^[a-f0-9]{64}$/.test(storedDraft.retryKey) ? storedDraft.retryKey : ''
    setSchool(storedDraft.school); setAdmissionNumber(storedDraft.admissionNumber)
    setCandidateName(storedDraft.candidateName); setSenderName(storedDraft.senderName)
    setRelationship(storedDraft.relationship); setKind('text'); setText(storedDraft.text)
    setConsent(false); setSaveDraft(true); setStoredDraft(null)
  }

  function discardDraft() {
    try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* storage unavailable */ }
    restoreKey.current = ''; idempotencyKey.current = ''
    setSaveDraft(false); setStoredDraft(null)
  }

  // A failed request can be retried only if all submission details are unchanged.
  useEffect(() => {
    idempotencyKey.current = restoreKey.current || ''
    restoreKey.current = ''
  }, [school?.id, admissionNumber, candidateName, senderName, relationship, kind, text])

  useEffect(() => {
    if (!saveDraft || !school || kind !== 'text' || receipt) return
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        savedAt: Date.now(), school, admissionNumber, candidateName, senderName,
        relationship, text, retryKey: idempotencyKey.current,
      } satisfies SavedWishDraft))
    } catch { /* user may have storage disabled; form still works */ }
  }, [saveDraft, school, admissionNumber, candidateName, senderName, relationship, kind, text, receipt])

  useEffect(() => {
    if (!file) { setMediaUrl(''); return }
    const url = URL.createObjectURL(file); setMediaUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function chooseFile(next: File | undefined) {
    setError(''); setFile(null)
    if (!next) return
    if (!next.type.startsWith(kind === 'voice' ? 'audio/' : 'video/')) { setError('Choose a supported media file.'); return }
    if (next.size > (config?.maxBytes || 25 * 1024 * 1024)) { setError('This file is too large. Choose a smaller file.'); return }
    setFile(next)
  }

  function showPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    if (!school) { setError('Choose the candidate’s school.'); return }
    if (kind !== 'text' && !file) { setError('Choose a file to preview.'); return }
    setPreview(true)
  }

  async function requestSenderCode() {
    if (!config?.enabled || verifying) return
    setVerifying(true); setError('')
    try {
      await request('/api/success-wishes/verify-sender', {
        method: 'POST', body: JSON.stringify({ email: senderEmail.trim() }),
      })
      setOtpSent(true); setOtpCode('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Verification email could not be sent.') }
    finally { setVerifying(false) }
  }

  async function verifySenderCode() {
    if (!otpSent || verifying) return
    setVerifying(true); setError('')
    try {
      const verified = await request<{ verified: boolean; senderProof: string }>('/api/success-wishes/verify-sender', {
        method: 'PATCH', body: JSON.stringify({ email: senderEmail.trim(), code: otpCode.trim() }),
      })
      if (!verified.verified) throw new Error('Email verification failed.')
      setSenderProof(verified.senderProof); setOtpCode('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Email verification failed.') }
    finally { setVerifying(false) }
  }

  async function send() {
    if (!school || busy || !config?.enabled || kind !== 'text') return
    if (!senderProof) { setError('Verify your email before submitting.'); return }
    setBusy(true); setError('')
    if (!idempotencyKey.current) {
      const random = crypto.getRandomValues(new Uint8Array(32))
      idempotencyKey.current = Array.from(random, byte => byte.toString(16).padStart(2, '0')).join('')
    }
    try {
      if (saveDraft) {
        try {
          sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
            savedAt: Date.now(), school, admissionNumber, candidateName, senderName,
            relationship, text, retryKey: idempotencyKey.current,
          } satisfies SavedWishDraft))
        } catch { /* no persistent storage is required to send */ }
      }
      const result = await request<Receipt>('/api/success-wishes/messages', { method: 'POST', body: JSON.stringify({ schoolId: school.id, admissionNumber: admissionNumber.trim(), candidateName: candidateName.trim(), senderName: senderName.trim(), relationship: relationship.trim(), kind, text: text.trim(), consent: true, senderProof, idempotencyKey: idempotencyKey.current }) })
      discardDraft()
      setReceipt(result)
      setText(''); setCandidateName(''); setAdmissionNumber(''); setSenderName(''); setRelationship(''); setConsent(false); setFile(null)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Your message could not be submitted.') }
    finally { setBusy(false) }
  }

  if (receipt) return <section className={styles.panel} aria-live="polite"><CheckCircle2 size={34} className={styles.successIcon} aria-hidden="true"/><h2>Submission received</h2><p className={styles.hint}>{receipt.message || 'Your message has been received. Availability depends on recipient verification and any required payment.'}</p>{receipt.reference && <p className={styles.status}>Reference: <strong>{receipt.reference}</strong></p>}{receipt.managementToken && <div className={styles.section}><label className={styles.field}>Private withdrawal code<input readOnly value={receipt.managementToken} autoComplete="off" onFocus={event => event.target.select()}/><small>Save this code privately now. It is shown only here and lets you withdraw your message. Do not send it to the candidate.</small></label></div>}{receipt.status && <p className={styles.status}>Status: {receipt.status.replace(/_/g, ' ')}</p>}<div className={styles.actions}><button className={styles.secondary} type="button" onClick={() => { setReceipt(null); setPreview(false); idempotencyKey.current = '' }}>Send another wish</button></div></section>

  if (preview) return <section className={styles.panel}><h2>Review your wish</h2><p className={styles.hint}>Check the recipient before submitting.</p><div className={styles.preview}><div className={styles.eyebrow}>For {candidateName}</div><strong>{school?.name}</strong><p className={styles.hint}>Admission number: {admissionNumber}</p>{kind === 'text' ? <p className={styles.messageText}>{text}</p> : kind === 'voice' ? <audio className={styles.media} controls src={mediaUrl} preload="metadata"/> : <video className={styles.media} controls src={mediaUrl} preload="metadata" playsInline/>}<p className={styles.sender}>From {senderName} · {relationship}</p></div>{kind !== 'text' && <p className={styles.status}>This is a local preview. Media sending is not available yet; your file has not been uploaded.</p>}{config?.paymentsEnabled && <p className={styles.status}>Any required payment must be confirmed before delivery. Submitting does not confirm payment.</p>}{config?.enabled && <div className={styles.section}>
      <h3>Verify your email</h3>
      <p className={styles.hint}>A six-digit code confirms control of your email address. Your email is not shared with the candidate.</p>
      <p className={styles.status}>{senderEmail || 'Add your email in the form.'}</p>
      {senderProof ? <p className={styles.status} role="status"><ShieldCheck size={16} aria-hidden="true"/> Email verified.</p> :
        <div className={styles.row}>
          <button className={styles.secondary} type="button" disabled={verifying || !senderEmail} onClick={() => void requestSenderCode()}>{verifying ? 'Please wait…' : otpSent ? 'Resend code' : 'Email a code'}</button>
          {otpSent && <><label className={styles.field}>Six-digit code<input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otpCode} onChange={event => setOtpCode(event.target.value)} autoComplete="one-time-code"/></label><button type="button" className={styles.secondary} disabled={verifying || !/^[0-9]{6}$/.test(otpCode)} onClick={() => void verifySenderCode()}>Verify code</button></>}
        </div>}
    </div>}
    {error && <div className={styles.error} role="alert">{error}</div>}<div className={styles.actions}><button className={styles.secondary} type="button" disabled={busy} onClick={() => setPreview(false)}>Edit</button><button className={styles.primary} type="button" onClick={() => void send()} disabled={busy || !config?.enabled || kind !== 'text' || !senderProof}>{busy ? 'Submitting…' : 'Submit wish'}</button></div></section>

  return <form className={styles.panel} onSubmit={showPreview}>
    <h2>Who are you cheering on?</h2><p className={styles.hint}>Your message goes to one candidate’s private inbox.</p>
    {storedDraft && <div className={styles.notice} role="status">
      <p>A draft was saved in this browser tab. Only restore it on your own device.</p>
      <div className={styles.row}>
        <button className={styles.secondary} type="button" onClick={restoreDraft}>Restore draft</button>
        <button className={styles.quiet} type="button" onClick={discardDraft}>Discard</button>
      </div>
    </div>}
    <div className={styles.section}><SchoolPicker selected={school} onChange={setSchool}/><div className={styles.grid} style={{ marginTop: 16 }}><label className={styles.field}>Candidate’s name<input value={candidateName} onChange={event => setCandidateName(event.target.value)} required maxLength={120} autoComplete="off"/></label><label className={styles.field}>Admission number<input value={admissionNumber} onChange={event => setAdmissionNumber(event.target.value)} required maxLength={60} autoComplete="off"/><small>Use the number issued by their school.</small></label></div></div>
    <div className={styles.section}><h3>Your message</h3><div className={styles.kinds} role="group" aria-label="Message format">{([{ id: 'text', label: 'Text', Icon: Mail }, { id: 'voice', label: 'Voice', Icon: Mic }, { id: 'video', label: 'Video', Icon: Video }] as const).map(({ id, label, Icon }) => <button key={id} type="button" aria-pressed={kind === id} className={`${styles.kind} ${kind === id ? styles.selectedKind : ''}`} onClick={() => { setKind(id); setFile(null); setError('') }}><Icon size={17} aria-hidden="true"/>{label}</button>)}</div>{kind === 'text' ? <><label className={styles.field}>Your encouragement<textarea value={text} onChange={event => setText(event.target.value)} required maxLength={2000} placeholder="Tell them what you want them to hear."/></label><p className={styles.count}>{text.length}/2,000</p></> : <div className={styles.file}><label className={styles.field}>{kind === 'voice' ? 'Choose a voice message' : 'Choose a video'}<input key={kind} type="file" accept={kind === 'voice' ? 'audio/*' : 'video/*'} onChange={event => chooseFile(event.target.files?.[0])}/><small>Up to {config?.maxSeconds || 60} seconds · {Math.round((config?.maxBytes || 25 * 1024 * 1024) / 1024 / 1024)} MB maximum.</small></label><p className={styles.status}>You can preview a file. Sending {kind === 'voice' ? 'voice messages' : 'videos'} is currently unavailable.</p></div>}</div>
    <div className={styles.section}><div className={styles.grid}><label className={styles.field}>Your name<input value={senderName} onChange={event => setSenderName(event.target.value)} required maxLength={100} autoComplete="off"/></label><label className={styles.field}>Relationship<input value={relationship} onChange={event => setRelationship(event.target.value)} required maxLength={60} placeholder="e.g. Mum, Uncle, Teacher" autoComplete="off"/></label></div><label className={styles.field}>Your email (for a private verification code)<input type="email" value={senderEmail} onChange={event => { setSenderEmail(event.target.value); setSenderProof(''); setOtpSent(false); setOtpCode('') }} required maxLength={254} autoComplete="email"/><small>Email verification does not establish a legal guardian relationship.</small></label><label className={styles.consent}><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} required/><span>I have permission to share this content with this candidate. I understand it is a private message.</span></label></div>
    {kind === 'text' && <label className={styles.consent}>
      <input type="checkbox" checked={saveDraft} onChange={event => {
        if (!event.target.checked) discardDraft()
        else setSaveDraft(true)
      }}/>
      <span>Save a draft for up to 30 minutes in this browser tab. Use only on a private device; leave unchecked on shared phones.</span>
    </label>}
    {error && <div className={styles.error} role="alert">{error}</div>}<div className={styles.actions}><span className={styles.hint}><LockKeyhole size={12} aria-hidden="true"/> Private by default</span><button type="submit" className={styles.primary} disabled={!school || !consent}>Preview wish <span aria-hidden="true">→</span></button></div>
  </form>
}

function Inbox({ registerExit }: { registerExit: (handler: (() => Promise<boolean>) | null) => void }) {
  const [school, setSchool] = useState<School | null>(null)
  const [admissionNumber, setAdmissionNumber] = useState('')
  const [code, setCode] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [viewingTimes, setViewingTimes] = useState<ViewingWindow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [inboxLoaded, setInboxLoaded] = useState(false)
  const inboxGeneration = useRef(0)

  useEffect(() => () => { inboxGeneration.current += 1 }, [])

  const signOut = useCallback(async (expired = false) => {
    // Invalidate pending reads before attempting the network sign-out.
    inboxGeneration.current += 1
    setMessages([]); setViewingTimes([]); setInboxLoaded(false)
    setBusy(true); setError('')
    try {
      await request('/api/success-wishes/session', { method: 'DELETE' })
      setAuthenticated(false); setMessages([]); setViewingTimes([]); setAdmissionNumber(''); setCode(''); setInboxLoaded(false)
      setNotice(expired ? 'Your session ended after inactivity. Open your inbox again to continue.' : 'Signed out. Your messages are no longer shown on this device.')
      return true
    } catch { setAuthenticated(false); setMessages([]); setViewingTimes([]); setAdmissionNumber(''); setCode(''); setInboxLoaded(false); setError('Sign-out could not be confirmed. Close this browser and contact your school before sharing the device.'); return false }
    finally { setBusy(false) }
  }, [])

  useEffect(() => {
    registerExit(busy ? async () => false : authenticated ? () => signOut() : null)
    return () => registerExit(null)
  }, [authenticated, busy, registerExit, signOut])

  useEffect(() => {
    if (!authenticated) return
    let timer: ReturnType<typeof setTimeout>
    const reset = () => { clearTimeout(timer); timer = setTimeout(() => void signOut(true), 5 * 60 * 1000) }
    reset()
    window.addEventListener('pointerdown', reset); window.addEventListener('keydown', reset)
    return () => { clearTimeout(timer); window.removeEventListener('pointerdown', reset); window.removeEventListener('keydown', reset) }
  }, [authenticated, signOut])

  async function loadInbox() {
    const current = ++inboxGeneration.current
    setBusy(true); setError(''); setInboxLoaded(false)
    try {
      const [data, viewing] = await Promise.all([
        request<{ messages: Message[] }>('/api/success-wishes/inbox'),
        request<{ windows: ViewingWindow[] }>('/api/success-wishes/my-viewing-times').catch(() => null),
      ])
      if (current !== inboxGeneration.current) return
      setMessages(data.messages); setViewingTimes(viewing?.windows || []); setInboxLoaded(true)
    } catch (reason) {
      if (current === inboxGeneration.current) setError(reason instanceof Error ? reason.message : 'Messages could not load.')
    } finally {
      if (current === inboxGeneration.current) setBusy(false)
    }
  }

  async function openVideo(messageId: string) {
    setBusy(true); setError('')
    try {
      const playback = await request<{url:string;expiresAt:string}>(
        '/api/success-wishes/media/playback?messageId='+encodeURIComponent(messageId),
      )
      const uri = new URL(playback.url)
      if (uri.protocol !== 'https:' || uri.hostname !== 'iframe.videodelivery.net' ||
        uri.username || uri.password) throw new Error('Video playback is unavailable.')
      setMessages(previous => previous.map(message =>
        message.id === messageId && message.state === 'available'
          ? {...message,mediaUrl:uri.href} : message))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Video playback is unavailable.')
    } finally { setBusy(false) }
  }

  async function act(messageId: string, action: 'accept' | 'hide' | 'block' | 'report') {
    if (action === 'block' && !window.confirm('Block this sender from sending future wishes to your inbox?')) return
    setBusy(true); setError('')
    try {
      await request('/api/success-wishes/actions', { method: 'POST', body: JSON.stringify({ messageId, action }) })
      setMessages(previous => previous.filter(message => message.id !== messageId))
      await loadInbox()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'This action could not be completed.'); setBusy(false) }
  }

  async function open(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!school || busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      await request('/api/success-wishes/session', { method: 'POST', body: JSON.stringify({ schoolId: school.id, admissionNumber: admissionNumber.trim(), code }) })
      setCode(''); setAuthenticated(true); await loadInbox()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Your inbox could not open.'); setBusy(false) }
  }

  if (authenticated) return <section className={styles.panel}><div className={styles.inboxHeader}><div><h2>Your success wishes</h2><p className={styles.hint}>A little encouragement from your people.</p></div><button type="button" className={styles.secondary} disabled={busy} onClick={() => void signOut()}>Finish & sign out</button></div>{error && <div className={styles.error} role="alert">{error}</div>}{busy && <p className={styles.status} role="status">Please wait…</p>}{!inboxLoaded && !busy && <button className={styles.secondary} type="button" onClick={() => void loadInbox()}>Retry loading messages</button>}{inboxLoaded && messages.length === 0 && <div className={styles.empty}><Heart size={30} aria-hidden="true"/><h3>No wishes yet</h3><p className={styles.hint}>When someone sends you a message and it is ready, it will appear here.</p></div>}<div className={styles.messages}>{messages.map(message => <article className={styles.message} key={message.id}><div className={styles.messageHeader}><div><strong>{message.senderName}</strong><small>{message.relationship} · Sender-provided name</small></div><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}</time></div>{message.state === 'request' ? <><p className={styles.status}>New message request. Only open messages from people you recognise.</p><div className={styles.row} style={{ marginTop: 12 }}><button className={styles.primary} type="button" disabled={busy} onClick={() => void act(message.id, 'accept')}>Accept message</button><button className={styles.secondary} type="button" disabled={busy} onClick={() => void act(message.id, 'hide')}>Hide message</button></div></> : message.text && <p className={styles.messageText}>{message.text}</p>}{message.state === 'available' && message.kind === 'voice' && message.mediaUrl && <audio className={styles.media} controls src={message.mediaUrl} preload="none"/>}{message.state === 'available' && message.kind === 'video' && (message.mediaUrl
    ? <iframe className={styles.media} title="Private success wish video" src={message.mediaUrl} referrerPolicy="no-referrer" allow="fullscreen" sandbox="allow-scripts allow-same-origin allow-presentation"/>
    : <button type="button" className={styles.secondary} disabled={busy} onClick={() => void openVideo(message.id)}>Play private video</button>)}<div className={styles.row} style={{ marginTop: 10 }}>{message.state === 'available' && <button type="button" className={styles.quiet} disabled={busy} onClick={() => void act(message.id, 'hide')}>Hide message</button>}<button type="button" className={styles.quiet} disabled={busy} onClick={() => void act(message.id, 'block')}>Block sender</button><button type="button" className={styles.quiet} disabled={busy} onClick={() => void act(message.id, 'report')}>Report message</button></div></article>)}</div><section className={styles.section} aria-label="School-device viewing sessions"><h3>School-device viewing times</h3><p className={styles.hint}>No personal phone? Ask school staff about using a shared device. Times are in East Africa Time (EAT).</p>{viewingTimes.length > 0 ? <div className={styles.results}>{viewingTimes.map((item, index) => <div className={styles.school} key={`${item.weekday}-${item.startsAt}-${index}`}><div><strong>{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][item.weekday]} · {item.startsAt.slice(0,5)}–{item.endsAt.slice(0,5)} EAT</strong><span>{item.venue}{item.guidance ? ' · ' + item.guidance : ''}</span></div></div>)}</div> : <p className={styles.status}>No school-device viewing times are currently listed. Check with your school.</p>}</section><p className={styles.footer}>Using a shared device? Finish and sign out before handing it back.</p></section>

  return <form className={styles.panel} onSubmit={open}><h2>Open your messages</h2><p className={styles.hint}>Use the private access code given to you by your school.</p>{notice && <p className={styles.notice} role="status" style={{ marginTop: 16 }}>{notice}</p>}<div className={styles.section}><SchoolPicker selected={school} onChange={setSchool} disabled={busy}/><div className={styles.grid} style={{ marginTop: 16 }}><label className={styles.field}>Admission number<input value={admissionNumber} onChange={event => setAdmissionNumber(event.target.value)} required maxLength={60} autoComplete="off" disabled={busy}/></label><label className={styles.field}>Private access code<input type="password" value={code} onChange={event => setCode(event.target.value)} required maxLength={100} autoComplete="off" disabled={busy}/></label></div></div>{error && <div className={styles.error} role="alert" style={{ marginTop: 16 }}>{error}</div>}<div className={styles.actions}><span className={styles.hint}>Forgot your code? Ask your school.</span><button className={styles.primary} type="submit" disabled={!school || busy}>{busy ? 'Opening…' : 'Open inbox'}<LockKeyhole size={14} aria-hidden="true"/></button></div></form>
}

function WithdrawMessage() {
  const [reference, setReference] = useState('')
  const [managementToken, setManagementToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [status, setStatus] = useState<{ status: string; paymentStatus: string; expiresAt: string } | null>(null)
  async function checkStatus() {
    if (!reference.trim() || !managementToken.trim()) { setError('Enter the reference and private code.'); return }
    setBusy(true); setError(''); setStatus(null)
    try {
      const result = await request<{ status: string; paymentStatus: string; expiresAt: string }>(
        '/api/success-wishes/status', {
          method: 'POST',
          body: JSON.stringify({ reference: reference.trim(), managementToken: managementToken.trim() }),
        },
      )
      setStatus(result)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Status could not be checked.') }
    finally { setBusy(false) }
  }
  async function withdraw(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setStatus(null)
    try {
      await request('/api/success-wishes/messages', { method: 'DELETE', body: JSON.stringify({ reference: reference.trim(), managementToken: managementToken.trim() }) })
      setDone(true); setReference(''); setManagementToken('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The message could not be withdrawn.') }
    finally { setBusy(false) }
  }
  return <details className={styles.section}>
    <summary style={{ cursor: 'pointer', fontSize: 12, color: '#526958', padding: '10px 0' }}>Check or withdraw a wish you sent</summary>
    {done ? <p className={styles.notice} role="status">Your withdrawal request has been completed.</p> : <form onSubmit={withdraw}>
      <div className={styles.grid} style={{ marginTop: 14 }}>
        <label className={styles.field}>Submission reference<input value={reference} disabled={busy} onChange={event => { setReference(event.target.value); setStatus(null) }} required autoComplete="off" maxLength={100}/></label>
        <label className={styles.field}>Private withdrawal code<input type="password" value={managementToken} disabled={busy} onChange={event => { setManagementToken(event.target.value); setStatus(null) }} required autoComplete="off" maxLength={200}/></label>
      </div>
      <p className={styles.hint} style={{ marginTop: 10 }}>Only someone with both the reference and private code can check or withdraw this wish. Do not share your code.</p>
      {status && <p className={styles.notice} role="status">Wish: <strong>{status.status.replace(/_/g, ' ')}</strong> · Payment: {status.paymentStatus.replace(/_/g, ' ')} · Available until {new Date(status.expiresAt).toLocaleDateString('en-KE')}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.row} style={{ marginTop: 14 }}>
        <button className={styles.secondary} type="button" disabled={busy} onClick={() => void checkStatus()}>Check status</button>
        <button className={styles.secondary} type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Withdraw message'}</button>
      </div>
    </form>}
  </details>
}

export default function SuccessWishes() {
  const [mode, setMode] = useState<'send' | 'inbox'>('send')
  const [config, setConfig] = useState<Configuration | null>(null)
  const [configError, setConfigError] = useState('')
  const exitInbox = useRef<(() => Promise<boolean>) | null>(null)
  const registerExit = useCallback((handler: (() => Promise<boolean>) | null) => { exitInbox.current = handler }, [])
  async function changeMode(next: 'send' | 'inbox') {
    if (next === mode) return
    if (exitInbox.current && !(await exitInbox.current())) return
    setMode(next)
  }
  useEffect(() => {
    let live = true
    request<Configuration>('/api/success-wishes/config').then(value => { if (live) setConfig(value) }).catch(() => { if (live) setConfigError('Availability could not be checked. You can prepare a wish, but sending is unavailable.') })
    return () => { live = false }
  }, [])
  return <div className={styles.page}><header className={styles.header}><Link href="/" className={styles.brand} onClick={event => { if (exitInbox.current) { event.preventDefault(); void exitInbox.current().then(ok => { if (ok) window.location.assign('/') }) } }}>VibeSchool<span style={{ color: '#82927c', fontWeight: 400 }}> / </span><span style={{ fontSize: 13, letterSpacing: 0 }}>Success Wishes</span></Link><span className={styles.headerNote}><LockKeyhole size={13} aria-hidden="true"/>Private messages</span></header><main className={styles.main} id="main-content"><div className={styles.intro}><p className={styles.eyebrow}>A few words. A familiar voice.</p><h1>Let them know you believe.</h1><p>Send your candidate a personal wish, or open encouragement from the people cheering you on.</p></div><div className={styles.tabs} role="group" aria-label="Success wishes options"><button type="button" className={`${styles.tab} ${mode === 'send' ? styles.activeTab : ''}`} aria-pressed={mode === 'send'} onClick={() => void changeMode('send')}><Heart size={17} aria-hidden="true"/>Send wishes</button><button type="button" className={`${styles.tab} ${mode === 'inbox' ? styles.activeTab : ''}`} aria-pressed={mode === 'inbox'} onClick={() => void changeMode('inbox')}><Mail size={17} aria-hidden="true"/>My messages</button></div>{configError && <div className={styles.notice} role="status">{configError}</div>}{config && !config.enabled && <div className={styles.notice} role="status">Success Wishes is not accepting messages yet. You can explore the form; nothing will be sent or charged.</div>}{mode === 'send' ? <><SendForm config={config}/><WithdrawMessage/></> : <Inbox registerExit={registerExit}/>}<p className={styles.footer}><ShieldCheck size={12} aria-hidden="true"/> Keep personal details private. <Link href="/legal/privacy" style={{ color: 'inherit' }} onClick={event => { if (exitInbox.current) { event.preventDefault(); void exitInbox.current().then(ok => { if (ok) window.location.assign('/legal/privacy') }) } }}>Privacy</Link> · <Link href="/success-wishes/school" style={{ color: 'inherit' }} onClick={event => { if (exitInbox.current) { event.preventDefault(); void exitInbox.current().then(ok => { if (ok) window.location.assign('/success-wishes/school') }) } }}>School access</Link></p></main></div>
}

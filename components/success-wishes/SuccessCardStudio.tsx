'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { ChevronRight, Volume2, VolumeX, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { playWishRevealSound } from '@/lib/success-wishes/signature-sound'
import styles from './SuccessCardStudio.module.css'

export type Template = 'heritage' | 'botanical' | 'nightfall' | 'sunrise'
export type CardValues = { candidate: string; sender: string; message: string; examYear?: string; school?: string }
export type CardDesignDraft = CardValues & { theme: Template }
const templates: { id: Template; name: string; subtitle: string; headline: string }[] = [
  { id: 'heritage', name: 'Golden Hour', subtitle: 'Warm & timeless', headline: 'The future is yours' },
  { id: 'botanical', name: 'New Beginnings', subtitle: 'Fresh & graceful', headline: 'Bloom into greatness' },
  { id: 'nightfall', name: 'Bright Star', subtitle: 'Bold & confident', headline: 'You were made to shine' },
  { id: 'sunrise', name: 'Above & Beyond', subtitle: 'Joyful & uplifting', headline: 'Go make it happen' },
]
const palette: Record<Template, { top: string; bottom: string; ink: string; accent: string; border: string }> = {
  heritage: { top: '#fbf2d0', bottom: '#d1bb84', ink: '#624928', accent: '#b4954d', border: '#b4954d' },
  botanical: { top: '#f3f2e9', bottom: '#c4d6bf', ink: '#285b49', accent: '#63866a', border: '#b1c5ad' },
  nightfall: { top: '#314a75', bottom: '#111b36', ink: '#fff6dc', accent: '#f0ce85', border: '#5e5874' },
  sunrise: { top: '#ffe9bc', bottom: '#ac829c', ink: '#613653', accent: '#ffedc4', border: '#eab8a0' },
}

function wrapped(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    // Break unusually long tokens rather than clipping the card image.
    const parts = word.match(new RegExp('.{1,' + maxChars + '}', 'g')) || [word]
    for (const part of parts) {
      if (line && (line + ' ' + part).length > maxChars) {
        lines.push(line); line = part
      } else {
        line = line ? line + ' ' + part : part
      }
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, maxLines)
}

export function CardArt({ template, values, svgRef, preview = false }: {
  template: Template; values: CardValues; svgRef?: React.Ref<SVGSVGElement>; preview?: boolean
}) {
  const id = useId().replace(/:/g, '')
  const theme = palette[template]
  const item = templates.find(t => t.id === template) || templates[0]
  const recipient = values.candidate.trim() || 'Candidate name'
  const sender = values.sender.trim() || 'Your name'
  const message = values.message.trim()
  const recipientLines = wrapped(recipient, 30, 2)
  const senderLines = wrapped('With love, ' + sender, 42, 1)
  const schoolLines = wrapped(values.school || '', 56, 1)
  const messageLines = wrapped(message, 56, 5)
  const messageStartY = 510 - Math.max(messageLines.length - 1, 0) * 22
  const ornaments: Record<Template, string> = { heritage: '✧', botanical: '✿', nightfall: '✦', sunrise: '✳' }
  return (
    <svg ref={svgRef} viewBox="0 0 1200 760" xmlns="http://www.w3.org/2000/svg" role="img"
      aria-label={`${item.name} Success Wishes card for ${recipient}, exam year ${values.examYear || 'not selected'}${values.school ? ', ' + values.school : ''}. Message: ${message || 'No message yet'}`} className={styles.art}
      preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id={id} cx={template === 'botanical' ? '0%' : '50%'} cy="25%" r="95%">
          <stop offset="0%" stopColor={theme.top}/>
          <stop offset="100%" stopColor={theme.bottom}/>
        </radialGradient>
        <pattern id={id + '-paper'} width="34" height="34" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="7" r="0.8" fill={theme.ink} opacity=".09"/><circle cx="25" cy="21" r="0.7" fill={theme.ink} opacity=".07"/>
          <path d="M15 3h2M8 27h1M29 10h1" stroke={theme.ink} strokeWidth=".7" opacity=".06"/>
        </pattern>
      </defs>
      <rect width="1200" height="760" rx="22" fill={'url(#' + id + ')'}/>
      <rect width="1200" height="760" rx="22" fill={'url(#' + id + '-paper)'}/>
      <rect x="20" y="20" width="1160" height="720" rx="12" fill="none" stroke={theme.border} strokeWidth="4"/>
      <rect x="40" y="40" width="1120" height="680" rx="8" fill="none" stroke={theme.accent} strokeWidth="2" opacity=".45"/>
      {template === 'nightfall' && <g fill={theme.accent} opacity=".45">
        <circle cx="170" cy="180" r="4"/><circle cx="990" cy="195" r="5"/><circle cx="740" cy="145" r="3"/>
        <circle cx="290" cy="315" r="3"/><circle cx="540" cy="165" r="4"/>
      </g>}
      <text x="75" y="92" fill={theme.ink} fontFamily="Arial, sans-serif" fontSize="19" fontWeight="bold" letterSpacing="4">VIBESCHOOL</text>
      <text x="1125" y="92" fill={theme.ink} fontFamily="Arial, sans-serif" fontSize="16" fontWeight="bold" letterSpacing="3" textAnchor="end">SUCCESS WISHES</text>
      <text x="600" y="178" fill={theme.accent} opacity=".14" fontSize="118" fontFamily="Georgia, serif" textAnchor="middle">{ornaments[template]}</text>
      <text x="600" y="242" fill={theme.ink} fontFamily="Georgia, serif" fontStyle={template === 'heritage' || template === 'botanical' ? 'italic' : 'normal'} fontSize={preview ? 34 : 38} textAnchor="middle" textLength="760" lengthAdjust="spacingAndGlyphs">{item.headline}</text>
      {recipientLines.map((line, i) => <text key={i} x="600" y={307 + i * 40} fill={theme.ink} fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="34" textAnchor="middle">{line}</text>)}
      {schoolLines.map((line, i) => <text key={i} x="600" y={381 + i * 24} fill={theme.ink} opacity=".82" fontFamily="Arial, sans-serif" fontSize="17" textAnchor="middle">{line}</text>)}
      {messageLines.length > 0 && <g>
        <rect x="92" y="407" width="1016" height="232" rx="18" fill={theme.ink} opacity=".055"/>
        <rect x="92" y="407" width="1016" height="232" rx="18" fill="none" stroke={theme.accent} strokeWidth="1.5" opacity=".32"/>
        <path d="M525 427 H675" stroke={theme.accent} strokeWidth="2" opacity=".55"/>
        {messageLines.map((line, i) => <text key={i} x="600" y={messageStartY + i * 43} fill={theme.ink} fontFamily="Georgia, serif" fontSize="31" textAnchor="middle">{line}</text>)}
      </g>}
      {senderLines.map((line, i) => <text key={i} x="75" y={685 + i * 25} fill={theme.ink} fontFamily="Georgia, serif" fontStyle="italic" fontSize="20" fontWeight="600" letterSpacing=".3">{line}</text>)}
      <text x="1125" y="685" fill={theme.ink} fontFamily="Arial, sans-serif" fontSize="21" fontWeight="bold" letterSpacing="3" textAnchor="end">{values.examYear || '2026'}</text>
    </svg>
  )
}

export function BookCard({ template, values, soundEnabled, onOpen, onOpenedChange }: { template: Template; values: CardValues; soundEnabled: boolean; onOpen: () => void; onOpenedChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false)
  const [envelopeOpened, setEnvelopeOpened] = useState(false)
  const replayTimer = useRef<number | null>(null)
  const item = templates.find(t => t.id === template) || templates[0]
  function openEnvelope() {
    if (envelopeOpened) return
    setEnvelopeOpened(true)
    if (soundEnabled) onOpen()
    replayTimer.current = window.setTimeout(() => {
      setOpen(true)
      onOpenedChange?.(true)
    }, 460)
  }
  function toggleCard() {
    if (replayTimer.current) window.clearTimeout(replayTimer.current)
    if (!open && soundEnabled) onOpen()
    onOpenedChange?.(!open)
    setOpen(value => !value)
  }
  function replay() {
    if (replayTimer.current) window.clearTimeout(replayTimer.current)
    setOpen(false)
    replayTimer.current = window.setTimeout(() => {
      if (soundEnabled) onOpen()
      setOpen(true)
      onOpenedChange?.(true)
    }, 180)
  }
  useEffect(() => () => { if (replayTimer.current) window.clearTimeout(replayTimer.current) }, [])
  return <div className={styles.bookPreview}>
    <div className={styles.bookStage + (open ? ' ' + styles.bookIsOpen : '')}>
      <div className={styles.bookSpread} aria-hidden={!open}>
        <div className={styles.bookPage}>
          <span className={styles.bookEyebrow}>WITH LOVE</span>
          <strong>{values.sender.trim() || 'Your name'}</strong>
          <span>For {values.candidate.trim() || 'your candidate'}</span>
          {values.school?.trim() && <span>{values.school.trim()}</span>}
          <span>{values.examYear || '2026'} exams</span>
          <span className={styles.bookOrnament}>✧</span>
        </div>
        <div className={styles.bookPage + ' ' + styles.bookMessagePage}>
          <span className={styles.bookEyebrow}>{item.name}</span>
          <h3>{item.headline}</h3>
          <strong>{values.candidate.trim() || 'Candidate name'}</strong>
          <p data-testid="success-card-message-preview">{values.message.trim() || 'Your personal message will appear here.'}</p>
          <span className={styles.bookSignoff}>With every good wish, {values.sender.trim() || 'Your name'}</span>
        </div>
      </div>
      <div aria-hidden="true" className={styles.bookCover + (envelopeOpened ? ' ' + styles.bookCoverVisible : '') + (open ? ' ' + styles.bookCoverOpened : '')}
        style={{ '--book-top': palette[template].top, '--book-bottom': palette[template].bottom, '--book-ink': palette[template].ink, '--book-accent': palette[template].accent } as React.CSSProperties}
      >
        <span>VIBESCHOOL · SUCCESS WISHES</span><b aria-hidden="true">{template === 'botanical' ? '✿' : template === 'nightfall' ? '✦' : template === 'sunrise' ? '✳' : '✧'}</b>
        <strong>{item.headline}</strong><small>{values.candidate.trim() || 'A wish for someone special'}</small><small>{values.examYear || '2026'}</small>
        <em>{open ? 'Tap to close' : 'Tap to open'}</em>
      </div>
      {!envelopeOpened && <button type="button" className={styles.bookEnvelope} onClick={openEnvelope} aria-label="Open the envelope and reveal the success card">
        <span>VIBESCHOOL · SUCCESS WISHES</span><b aria-hidden="true">✉</b><strong>A little encouragement for {values.candidate.trim() || 'someone special'}</strong><small>{values.school?.trim() || `${values.examYear || '2026'} exams`}</small><em>Tap to open</em>
      </button>}
      {envelopeOpened && <div className={styles.bookEnvelope + ' ' + styles.bookEnvelopeOpened} aria-hidden="true"><span>VIBESCHOOL · SUCCESS WISHES</span><b>✉</b><strong>A little encouragement</strong><em>Opened</em></div>}
    </div>
    {envelopeOpened && <div className={styles.bookActions}>
      <button type="button" className={styles.secondary} onClick={toggleCard} aria-expanded={open} aria-label={open ? 'Close the book card' : 'Open the book card'}>{open ? 'Close card' : 'Open card'}</button>
      {open && <button type="button" className={styles.primary} onClick={replay}>Replay opening</button>}
    </div>}
  </div>
}

type LocalSimulationOrder = { orderId: string; key: string; state: string; amountKes: 50 }

function CheckoutPreview({ theme, values, version, price, mediaFileName, onClose, testMode = false }: {
  theme: Template
  values: CardValues
  version: typeof versions[number]['id']
  price: number
  mediaFileName: string
  onClose: () => void
  testMode?: boolean
}) {
  const [mpesaNumber, setMpesaNumber] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [review, setReview] = useState(false)
  const [detailsConfirmed, setDetailsConfirmed] = useState(false)
  const [testOrder, setTestOrder] = useState<LocalSimulationOrder | null>(null)
  const [hostedAvailable, setHostedAvailable] = useState(false)
  const [sandboxMode, setSandboxMode] = useState<'local' | 'daraja'>('local')
  const [hostedState, setHostedState] = useState<'prepared' | 'submitting' |
    'awaiting_customer' | 'outcome_unknown' | 'reconciliation_required' |
    'settled_simulated' | 'failed' | 'expired' | 'cancelled'>('prepared')
  const [hostedMessage, setHostedMessage] = useState('')
  const [testState, setTestState] = useState<'awaiting_test_result' | 'settled_simulated' | 'failed_simulated'>('awaiting_test_result')
  const [testInvitation, setTestInvitation] = useState('')
  const [testBusy, setTestBusy] = useState(false)
  const [testError, setTestError] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const id = useId()

  useEffect(() => {
    if (!testMode) return
    let active = true
    fetch('/api/success-wishes/test-daraja', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (active && data?.available === true && data?.realAccess === false) setHostedAvailable(true) })
      .catch(() => undefined)
    return () => { active = false }
  }, [testMode])

  async function hostedRequest(body: Record<string, unknown>) {
    const response = await fetch('/api/success-wishes/test-daraja', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), cache: 'no-store',
    })
    const data: Record<string, unknown> = await response.json()
    if (data.mode !== 'daraja_sandbox' || data.realAccess !== false)
      throw new Error('Unverified hosted sandbox response.')
    if (!response.ok) {
      const error = new Error(typeof data.error === 'string' ? data.error : 'Sandbox status uncertain.')
      return { error, data, ok: false as const }
    }
    return { data, ok: true as const }
  }

  async function sendHostedStk() {
    if (!testOrder || !hostedAvailable || testBusy || hostedState !== 'prepared') return
    setTestBusy(true); setTestError(''); setHostedState('submitting')
    try {
      const result = await hostedRequest({
        action: 'start', orderId: testOrder.orderId, key: testOrder.key,
      })
      if (!result.ok || result.data.state !== 'awaiting_customer') {
        setHostedState('outcome_unknown')
        setTestError(result.ok ? 'Provider acknowledgement was not verified.' : result.error.message)
        return
      }
      setHostedState('awaiting_customer')
      setHostedMessage('Safaricom accepted the sandbox STK request. Payment has not been confirmed.')
    } catch {
      setHostedState('outcome_unknown')
      setTestError('Provider response was lost. Do not send another STK; reconcile this order.')
    } finally { setTestBusy(false) }
  }

  async function checkHostedStatus() {
    if (!testOrder || !hostedAvailable || testBusy ||
        !['awaiting_customer', 'reconciliation_required', 'outcome_unknown'].includes(hostedState)) return
    setTestBusy(true); setTestError('')
    try {
      const result = await hostedRequest({
        action: 'status', orderId: testOrder.orderId, key: testOrder.key,
      })
      if (!result.ok) {
        setHostedState('reconciliation_required')
        setTestError(result.error.message)
        return
      }
      const data = result.data
      if (data.state === 'settled_simulated') {
        if (typeof data.invitationToken !== 'string' || !data.invitationToken) {
          throw new Error('Simulated payment settled, but private test link was not issued.')
        }
        setTestInvitation(`${window.location.origin}/success-wishes/invitation#token=${encodeURIComponent(data.invitationToken)}`)
        setHostedState('settled_simulated')
        setHostedMessage('Daraja sandbox returned a simulated settlement. No real payment or entitlement.')
      } else if (['expired', 'cancelled', 'failed'].includes(String(data.state))) {
        setHostedState(data.state as 'expired' | 'cancelled' | 'failed')
        setHostedMessage('Safaricom sandbox did not complete this payment. The card remains locked.')
      } else {
        const uncertain = data.state === 'outcome_unknown' || data.state === 'reconciliation_required'
        setHostedState(uncertain ? data.state as 'outcome_unknown' | 'reconciliation_required' : 'awaiting_customer')
        setHostedMessage(typeof data.message === 'string' ? data.message : 'Still awaiting confirmed Safaricom sandbox settlement.')
      }
    } catch (e) { setTestError(e instanceof Error ? e.message : 'Could not verify status.') }
    finally { setTestBusy(false) }
  }

  function reviewCheckout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = mpesaNumber.replace(/[\s()-]/g, '')
    if (!/^(?:\+254|254|0)(?:7\d{8}|1\d{8})$/.test(normalized)) {
      setPhoneError('Enter a valid Kenyan M-Pesa number.')
      return
    }
    setPhoneError('')
    setReview(true)
  }

  async function testRequest(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await fetch('/api/success-wishes/test-checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      cache: 'no-store', body: JSON.stringify(body),
    })
    const data: Record<string, unknown> = await response.json()
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'The local test checkout failed.')
    if (data.mode !== 'local_simulation' || data.simulated !== true || data.realAccess !== false)
      throw new Error('Unexpected test checkout response.')
    return data
  }

  async function confirmCheckout() {
    if (!testMode) { setDetailsConfirmed(true); return }
    // Local test only: no real STK request, payment, entitlement or receipt.
    if (version !== 'text' || price !== 50) {
      setTestError('This simulated checkout covers the KES 50 text card only.')
      return
    }
    if (testBusy) return
    setTestBusy(true); setTestError('')
    try {
      const details = {
        candidate: values.candidate, sender: values.sender,
        message: values.message, examYear: values.examYear || '2026',
        school: values.school || '', theme, version, phone: mpesaNumber,
      }
      const result = sandboxMode === 'daraja'
        ? await hostedRequest({ action: 'prepare', ...details })
        : { ok: true as const, data: await testRequest({ action: 'start', ...details }) }
      if (!result.ok) throw result.error
      const data = result.data
      if (typeof data.orderId !== 'string' || typeof data.key !== 'string' ||
          data.state !== (sandboxMode === 'daraja' ? 'prepared' : 'awaiting_test_result') ||
          data.amountKes !== 50)
        throw new Error('Invalid test order confirmation.')
      setTestOrder({ orderId: data.orderId, key: data.key,
        state: String(data.state), amountKes: 50 })
      setTestState('awaiting_test_result')
      setHostedState('prepared')
      setTestInvitation('')
      setDetailsConfirmed(true)
    } catch (error) {
      setTestError(error instanceof Error ? error.message : 'The test checkout could not start.')
    } finally { setTestBusy(false) }
  }

  async function finishTest(outcome: 'success' | 'failure') {
    if (!testMode || !testOrder || testBusy || testState !== 'awaiting_test_result') return
    setTestBusy(true); setTestError('')
    try {
      const result = await testRequest({
        action: 'resolve', orderId: testOrder.orderId,
        key: testOrder.key, outcome,
      })
      if (outcome === 'success') {
        if (result.state !== 'settled_simulated' || typeof result.invitationToken !== 'string')
          throw new Error('Test invitation has not been released.')
        const url = `${window.location.origin}/success-wishes/invitation#token=${encodeURIComponent(result.invitationToken)}`
        setTestInvitation(url)
        setTestState('settled_simulated')
      } else {
        if (result.state !== 'failed_simulated' || result.invitationToken !== null)
          throw new Error('Test failure did not stay locked.')
        setTestState('failed_simulated')
      }
    } catch (error) {
      setTestError(error instanceof Error ? error.message : 'Unable to finish the test.')
    } finally { setTestBusy(false) }
  }

  async function copyTestInvitation() {
    if (!testInvitation) return
    try { await navigator.clipboard.writeText(testInvitation); setCopyStatus('Private test link copied.') }
    catch { setCopyStatus('Select and copy the private test link below.') }
  }

  return <div className={styles.modalBackdrop} role="presentation" onKeyDown={event => { if (event.key === 'Escape') onClose() }} onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className={styles.checkoutModal} role="dialog" aria-modal="true" aria-labelledby={id}>
      <button type="button" className={styles.modalClose} aria-label="Close checkout" onClick={onClose}><X size={20}/></button>
      {testMode && <p className={styles.eyebrow} role="status">{sandboxMode === 'daraja' ? 'DARAJA SANDBOX TEST · NOT REAL MONEY' : 'LOCAL SIMULATION · NO M-PESA CHARGE'}</p>}
      {detailsConfirmed ? <>
        <p className={styles.eyebrow}>CHECKOUT</p>
        <h2 id={id}>{!testMode ? 'Your details are ready' : sandboxMode === 'daraja' ?
          hostedState === 'settled_simulated' ? 'Sandbox test card unlocked' :
          ['failed', 'expired', 'cancelled'].includes(hostedState) ? 'Sandbox payment unsuccessful' :
          hostedState === 'prepared' ? 'Ready for sandbox STK' : 'Check sandbox payment' :
          testState === 'settled_simulated' ? 'Test card unlocked' :
          testState === 'failed_simulated' ? 'Test payment unsuccessful' : 'Simulate the payment result'}</h2>
        {!testMode && <p className={styles.checkoutNotice}>No payment prompt has been sent and your wish has not been submitted.</p>}
        <div className={styles.checkoutOrder}>
          <CardArt template={theme} values={{ ...values, examYear: values.examYear || '2026' }} preview/>
          <div><strong>{versions.find(item => item.id === version)?.name} · {values.candidate.trim()}</strong>
            <span>M-Pesa number: {mpesaNumber}</span><span>Total · KES {price}</span>
            {testOrder && <small>Local test order · {testOrder.orderId.slice(0, 8)}</small>}
          </div>
        </div>
        {!testMode ? <button type="button" className={styles.primary} onClick={onClose}>Back to your card</button> :
          sandboxMode === 'daraja' ? <>
            <p className={styles.checkoutFine}>Isolated Safaricom sandbox only · KES 50 test order · no real access. Sending STK is a separate one-time action.</p>
            {hostedState === 'prepared' ? <button type="button" className={styles.primary} disabled={testBusy} onClick={() => void sendHostedStk()}>{testBusy ? 'Sending one test STK…' : 'Send one sandbox STK'} <ChevronRight size={18}/></button> :
            ['awaiting_customer', 'reconciliation_required', 'outcome_unknown'].includes(hostedState) ?
              <button type="button" className={styles.primary} disabled={testBusy} onClick={() => void checkHostedStatus()}>{testBusy ? 'Checking…' : 'Check payment status'}</button> :
            hostedState === 'settled_simulated' ? <>
              <p className={styles.checkoutFine}>Sandbox simulated settlement verified by the isolated provider-status endpoint. This does not grant real customer access.</p>
              <label className={styles.checkoutLabel}>Private local test invitation
                <input readOnly value={testInvitation} onFocus={event => event.currentTarget.select()}/>
              </label>
              <div className={styles.checkoutActions}>
                <button type="button" className={styles.secondary} onClick={() => void copyTestInvitation()}>Copy invitation</button>
                <a className={styles.primary} href={testInvitation}>Open test card <ChevronRight size={18}/></a>
              </div>
            </> : <p className={styles.checkoutFine} role="status">This sandbox attempt did not settle. No card access was granted.</p>}
            {hostedMessage && <p className={styles.checkoutFine} role="status">{hostedMessage}</p>}
          </> :
          testState === 'awaiting_test_result' ? <>
            <p className={styles.checkoutFine}>Test only. Select a simulated outcome to verify whether the private card is released. No STK Push will be sent.</p>
            <div className={styles.checkoutActions}>
              <button type="button" className={styles.secondary} disabled={testBusy} onClick={() => void finishTest('failure')}>Simulate failure</button>
              <button type="button" className={styles.primary} disabled={testBusy} onClick={() => void finishTest('success')}>{testBusy ? 'Processing test…' : 'Simulate success'} <ChevronRight size={18}/></button>
            </div>
          </> : testState === 'failed_simulated' ? <>
            <p className={styles.checkoutFine} role="status">Simulated payment failed. No private invitation was created, and no access was granted.</p>
            <button type="button" className={styles.secondary} onClick={() => { setTestOrder(null); setDetailsConfirmed(false); setReview(true); setTestError('') }}>Start a new test</button>
          </> : <>
            <p className={styles.checkoutFine} role="status">Simulated success only. One LOCAL TEST invitation was created. This is not a Safaricom payment or a real purchase.</p>
            <label className={styles.checkoutLabel}>Private test invitation
              <input readOnly value={testInvitation} onFocus={event => event.currentTarget.select()}/>
            </label>
            <div className={styles.checkoutActions}>
              <button type="button" className={styles.secondary} onClick={() => void copyTestInvitation()}>Copy invitation</button>
              <a className={styles.primary} href={testInvitation}>Open test card <ChevronRight size={18}/></a>
            </div>
            {copyStatus && <p role="status" className={styles.checkoutFine}>{copyStatus}</p>}
          </>}
        {testError && <p role="alert" className={styles.checkoutError}>{testError}</p>}
      </> : <>
        <p className={styles.eyebrow}>CHECKOUT</p>
        <h2 id={id}>{review ? 'Review your wish' : 'Your order'}</h2>
        <div className={styles.checkoutOrder}>
          <CardArt template={theme} values={{ ...values, examYear: values.examYear || '2026' }} preview/>
          <div><strong>{versions.find(item => item.id === version)?.name} · {values.candidate.trim()}</strong>
            <span>For the {values.examYear || '2026'} exams</span>
            <span>{values.school?.trim() || 'No school selected'}</span>
            {mediaFileName && <span>{mediaFileName}</span>}
          </div>
        </div>
        {!review ? <form onSubmit={reviewCheckout} noValidate>
          {testMode && hostedAvailable && <div className={styles.checkoutActions} role="group" aria-label="Payment test mode">
            <button type="button" className={sandboxMode === 'local' ? styles.primary : styles.secondary} aria-pressed={sandboxMode === 'local'} onClick={() => setSandboxMode('local')}>Local simulation</button>
            <button type="button" className={sandboxMode === 'daraja' ? styles.primary : styles.secondary} aria-pressed={sandboxMode === 'daraja'} onClick={() => { setSandboxMode('daraja'); setMpesaNumber('254708374149'); setPhoneError('') }}>Daraja sandbox STK</button>
          </div>}
          <fieldset className={styles.numberPicker}><legend>Choose a number prefix</legend>{['07', '01', '+254'].map(prefix => <button type="button" key={prefix} aria-pressed={mpesaNumber.startsWith(prefix)} onClick={() => { setMpesaNumber(prefix); setPhoneError('') }}>{prefix}</button>)}</fieldset>
          <label className={styles.checkoutLabel} htmlFor={id + '-mpesa'}>M-Pesa number
            <input id={id + '-mpesa'} type="tel" inputMode="tel" autoComplete="tel" value={mpesaNumber}
              onChange={event => { setMpesaNumber(event.target.value); setPhoneError('') }}
              placeholder="07XX XXX XXX" maxLength={16} aria-describedby={id + '-phone-help'} required/>
          </label>
          <small id={id + '-phone-help'} className={styles.checkoutDisclosure}>{testMode ? sandboxMode === 'daraja' ? 'Safaricom sandbox number only (254708374149). A test STK can be sent once after confirmation.' : 'Used for the local test order only. No STK Push is sent.' : 'Choose the number for this review. No payment prompt is sent here.'}</small>
          {phoneError && <p role="alert" className={styles.checkoutError}>{phoneError}</p>}
          <div className={styles.orderTotal}>Total <strong>KES {price}</strong></div>
          <button type="submit" className={styles.primary}>Review order <ChevronRight size={18}/></button>
        </form> : <>
          <p className={styles.checkoutFine}>M-Pesa number: <strong>{mpesaNumber}</strong></p>
          <div className={styles.orderTotal}>Total <strong>KES {price}</strong></div>
          {!testMode && <p className={styles.checkoutNotice}>Review only. This page has not started a payment or sent your wish.</p>}
          <div className={styles.checkoutActions}>
            <button type="button" className={styles.secondary} disabled={testBusy} onClick={() => setReview(false)}>Edit number</button>
            <button type="button" className={styles.primary} disabled={testBusy} onClick={() => void confirmCheckout()}>{testBusy ? 'Creating test order…' : testMode ? sandboxMode === 'daraja' ? 'Prepare sandbox test' : 'Start local test checkout' : 'Finish review'} <ChevronRight size={18}/></button>
          </div>
          {testError && <p role="alert" className={styles.checkoutError}>{testError}</p>}
        </>}
      </>}
    </section>
  </div>
}

const versions = [
  { id: 'text', name: 'Text Wish', price: 50, detail: 'A personalised success card with your message, exactly as you wrote it.' },
  { id: 'voice', name: 'Voice Wish', price: 75, detail: 'Choose a voice message or record your own.' },
  { id: 'video', name: 'Video Wish', price: 100, detail: 'Record a video message.' },
] as const

const messageStarters = [
  { label: 'Trust your work', message: 'You have worked so hard to reach this moment. Walk in with courage; we believe in you.' },
  { label: 'Proud of you', message: 'Whatever the results, we are proud of the person you are becoming. Keep going.' },
  { label: 'Bright beginning', message: 'May your hard work meet a bright new beginning. Your future is full of possibility.' },
]

type SchoolOption = {
  school_id: string
  school_name: string
  county: string | null
  sub_county: string | null
}

type DirectorySchoolOption = {
  directory_id: string
  school_name: string
  county: string | null
  sub_county: string | null
}

export default function SuccessCardStudio({ initialDraft, testMode = false }: { initialDraft?: CardDesignDraft; testMode?: boolean }) {
  const [theme, setTheme] = useState<Template>(initialDraft?.theme || 'heritage')
  const [selectedVersion, setSelectedVersion] = useState<'text' | 'voice' | 'video'>('text')
  const [mediaEnabled, setMediaEnabled] = useState(false)
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState('')
  const [candidate, setCandidate] = useState(initialDraft?.candidate || '')
  const [sender, setSender] = useState(initialDraft?.sender || '')
  const [message, setMessage] = useState(initialDraft?.message || '')
  const [examYear, setExamYear] = useState(initialDraft?.examYear || '2026')
  const [school, setSchool] = useState(initialDraft?.school || '')
  const [selectedSchool, setSelectedSchool] = useState<SchoolOption | null>(null)
  const [schoolOptions, setSchoolOptions] = useState<SchoolOption[]>([])
  const [schoolSearchState, setSchoolSearchState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const schoolInputId = useId()
  const schoolResultsId = useId()
  const [error, setError] = useState('')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const stopSound = useRef<(() => void) | null>(null)
  const formStartSoundPlayed = useRef(false)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  const values = { candidate, sender, message, examYear, school }
  const ready = Boolean(candidate.trim() && sender.trim() && message.trim() && /^20\d{2}$/.test(examYear) && (selectedVersion === 'text' || mediaFile))
  useEffect(() => {
    let active = true
    fetch('/api/success-wishes/config', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(config => { if (active) setMediaEnabled(config?.mediaEnabled === true) })
      .catch(() => { if (active) setMediaEnabled(false) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (!mediaFile) { setMediaPreviewUrl(''); return }
    const url = URL.createObjectURL(mediaFile)
    setMediaPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [mediaFile])
  useEffect(() => () => {
    stopSound.current?.()
  }, [])
  useEffect(() => {
    const query = school.trim()
    if (query.length < 2 || selectedSchool?.school_name === query) {
      setSchoolOptions([])
      setSchoolSearchState('idle')
      return
    }

    let active = true
    setSchoolSearchState('loading')
    const timer = window.setTimeout(async () => {
      const { data, error: searchError } = await supabase.rpc('success_wishes_school_search_public_v1', {
        p_query: query,
        p_limit: 12,
      })
      if (!active) return
      if (searchError) {
        setSchoolOptions([])
        setSchoolSearchState('error')
        return
      }
      const options = (Array.isArray(data) ? data : []).filter((row): row is DirectorySchoolOption =>
        typeof row.directory_id === 'string' && typeof row.school_name === 'string'
      ).map(row => ({
        school_id: row.directory_id,
        school_name: row.school_name,
        county: typeof row.county === 'string' ? row.county : null,
        sub_county: typeof row.sub_county === 'string' ? row.sub_county : null,
      }))
      setSchoolOptions(options)
      setSchoolSearchState('ready')
    }, 250)

    return () => { active = false; window.clearTimeout(timer) }
  }, [school, selectedSchool])
  function playFormStartSound() {
    if (!soundEnabled || formStartSoundPlayed.current) return
    formStartSoundPlayed.current = true
    stopSound.current?.()
    stopSound.current = playWishRevealSound()
  }

  function toggleSound() {
    if (soundEnabled) {
      stopSound.current?.()
      stopSound.current = null
    }
    setSoundEnabled(!soundEnabled)
  }

  return <div className={styles.page}>
    <header className={styles.header}>
      <Link href="/" className={styles.brand}><span className={styles.brandMark}>V</span><span className={styles.brandText}>VIBESCHOOL<small>SUCCESS WISHES</small></span></Link>
      <div className={styles.headerActions}>
        <button type="button" className={styles.headerSound} aria-label={soundEnabled ? 'Mute card opening sound' : 'Turn card opening sound on'} aria-pressed={soundEnabled} onClick={toggleSound}>{soundEnabled ? <Volume2 size={17}/> : <VolumeX size={17}/>}</button>
      </div>
    </header>
    <main className={styles.main}>
      <section className={styles.intro}>
        <p className={styles.eyebrow}>DIGITAL SUCCESS CARDS</p>
        <h1>Wish students good luck <em>&amp; success.</em></h1>
        <p>A personalised card with your words, made to encourage someone before their exams.</p>
        <button type="button" className={styles.heroCta} onClick={() => document.getElementById('choose-card')?.scrollIntoView({ behavior: 'smooth' })}>Explore Success Cards <ChevronRight size={16}/></button>
        <small className={styles.heroNote}>Choose a card · write your wish · send encouragement</small>
      </section>
      <section aria-labelledby="choose-card-title" className={styles.designSection} id="choose-card">
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>MAKE IT PERSONAL</span><h2 id="choose-card-title">Choose a card design</h2></div><small>Tap a card to choose it</small></div>
        <div className={styles.gallery}>{templates.map(item => <button type="button" key={item.id} onClick={() => setTheme(item.id)}
          className={styles.option + (theme === item.id ? ' ' + styles.active : '')} aria-pressed={theme === item.id} aria-label={`Choose ${item.name} card`}>
          <CardArt template={item.id} values={{ candidate: candidate || 'Your candidate', sender, message: '', examYear: examYear || '2026', school }} preview/>
          <span className={styles.optionCaption}><strong>{item.name}</strong><small>{item.subtitle}</small></span>
        </button>)}</div>
      </section>
      <section className={styles.pricingStrip} aria-label="Wish versions and prices">
        <div className={styles.priceChoices} role="group" aria-label="Choose a wish version">
          {versions.map(version => <button key={version.id} type="button" className={styles.priceChoice} disabled={version.id !== 'text' && !mediaEnabled} aria-pressed={selectedVersion === version.id} onClick={() => { setSelectedVersion(version.id); setMediaFile(null) }}>
            {version.name.replace(' Wish', '')} wish · KES {version.price}
          </button>)}
        </div>
        <span className={styles.purchaseNote}>{versions.find(version => version.id === selectedVersion)?.name} · KES {versions.find(version => version.id === selectedVersion)?.price}</span>
      </section>
      <section className={styles.composer} aria-labelledby="personalise-card">
        <div className={styles.form} onFocusCapture={event => {
          if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) playFormStartSound()
        }}><div className={styles.heading}><span>DIGITAL SUCCESS CARD</span><h2 id="personalise-card">Write a wish they’ll remember.</h2></div>
          <div className={styles.formRow}>
            <label>Candidate name<input autoComplete="off" maxLength={48} value={candidate} onChange={e => setCandidate(e.target.value)} placeholder="Who are you celebrating?"/></label>
            <label>Exam year<input inputMode="numeric" type="text" pattern="20[0-9]{2}" maxLength={4} value={examYear} onChange={e => setExamYear(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="e.g. 2026"/></label>
          </div>
          <div className={styles.optionalField}>
            <div className={styles.optionalFieldHeading}><label htmlFor={schoolInputId}>School (optional)</label></div>
            <input id={schoolInputId} role="combobox" aria-autocomplete="list" aria-expanded={schoolOptions.length > 0} aria-controls={schoolResultsId} autoComplete="off" maxLength={80} value={school} onChange={e => { setSchool(e.target.value); setSelectedSchool(null) }} placeholder="Search school, e.g. Gilgil Township"/>
            {schoolSearchState === 'loading' && <p className={styles.schoolSearchStatus} role="status">Searching VibeSchool schools…</p>}
            {schoolSearchState === 'error' && <p className={styles.schoolSearchStatus} role="status">School search is unavailable right now. You can leave this optional field blank.</p>}
            {schoolSearchState === 'ready' && schoolOptions.length === 0 && <p className={styles.schoolSearchStatus} role="status">No matching school found. Try another name or leave this optional.</p>}
            {schoolOptions.length > 0 && <ul className={styles.schoolResults} id={schoolResultsId} role="listbox" aria-label="Matching VibeSchool schools">{schoolOptions.map(option => <li key={option.school_id}><button type="button" role="option" aria-selected={selectedSchool?.school_id === option.school_id} onClick={() => { setSelectedSchool(option); setSchool(option.school_name); setSchoolOptions([]); setSchoolSearchState('idle') }}><strong>{option.school_name}</strong><small>{[option.sub_county, option.county].filter(Boolean).join(', ') || 'School in VibeSchool directory'}</small></button></li>)}</ul>}
            {selectedSchool && <p className={styles.schoolSearchStatus} role="status">Selected from VibeSchool&apos;s school list: {selectedSchool.school_name}{selectedSchool.sub_county || selectedSchool.county ? ` · ${[selectedSchool.sub_county, selectedSchool.county].filter(Boolean).join(', ')}` : ''}</p>}
          </div>
          <label>Your name<input autoComplete="off" maxLength={48} value={sender} onChange={e => setSender(e.target.value)} placeholder="From whom?"/></label>
          <label>Your wish<textarea ref={messageInputRef} rows={6} maxLength={220} value={message} onChange={e => setMessage(e.target.value)}
            placeholder="Write something only you would say…"/></label>
          {selectedVersion !== 'text' && <label className={styles.mediaField}>{selectedVersion === 'voice' ? 'Record or choose your voice message' : 'Record or choose your video message'}<input type="file" accept={selectedVersion === 'voice' ? 'audio/*' : 'video/*'} capture={selectedVersion === 'voice' ? 'user' : 'environment'} onChange={event => setMediaFile(event.target.files?.[0] || null)}/>
            {mediaPreviewUrl && (selectedVersion === 'voice' ? <audio className={styles.mediaPlayer} controls src={mediaPreviewUrl}/> : <video className={styles.mediaPlayer} controls playsInline src={mediaPreviewUrl}/>)}
            <small className={styles.mediaDisclosure}>Recording preview only. This page does not deliver media.</small>
          </label>}
          <div className={styles.messageIdeas}>
            <div className={styles.messageIdeasHeading}><strong>Need a wish to start with?</strong><small>Tap a phrase, then make it yours</small></div>
            <div>{messageStarters.map(starter => <button type="button" key={starter.label} aria-label={'Use wish starter: ' + starter.label} onClick={() => {
              setMessage(starter.message)
              window.requestAnimationFrame(() => {
                messageInputRef.current?.focus()
                messageInputRef.current?.setSelectionRange(starter.message.length, starter.message.length)
              })
            }}>{starter.label}</button>)}</div>
          </div>
          <p className={styles.counter}>{message.length}/220 characters</p>
          {!ready && <p className={styles.hint}>Add the candidate’s name, your name and a wish. School is optional.</p>}
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <div className={styles.sendRow}>
            <p className={styles.orderTotal}>Total <strong>KES {versions.find(version => version.id === selectedVersion)?.price}</strong></p>
            <button type="button" className={styles.primary} disabled={!ready} onClick={() => setCheckoutOpen(true)}>Send this wish <ChevronRight size={18}/></button>
          </div>
        </div>
        <div className={styles.live} id="wish-preview"><span>LIVE CARD PREVIEW</span>
          <BookCard template={theme} values={values} soundEnabled={soundEnabled} onOpen={() => { stopSound.current?.(); stopSound.current = playWishRevealSound() }}/>
          <div className={styles.checkoutSummary}><h3>{versions.find(version => version.id === selectedVersion)?.name} <span>KES {versions.find(version => version.id === selectedVersion)?.price}</span></h3><p>{versions.find(version => version.id === selectedVersion)?.detail}</p>{mediaFile && <p>{mediaFile.name}</p>}
          </div></div>
      </section>
      <footer className={styles.footer}>
        <p><Link href="/legal/privacy">Privacy</Link></p></footer>
    </main>
    {checkoutOpen && <CheckoutPreview theme={theme} values={values} version={selectedVersion} price={versions.find(version => version.id === selectedVersion)?.price || 50} mediaFileName={mediaFile?.name || ''} testMode={testMode} onClose={() => setCheckoutOpen(false)}/>}
  </div>
}

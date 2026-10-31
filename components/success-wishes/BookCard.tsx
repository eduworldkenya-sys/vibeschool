'use client'

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { CardValues } from './SuccessCardStudio'
import { palette, templates, type Template } from './card-themes'
import styles from './BookCard.module.css'

type Phase = 'sealed' | 'unsealing' | 'revealing-book' | 'opening' | 'opened' | 'closing'
type Props = {
  template: Template; values: CardValues; soundEnabled: boolean; onOpen: () => void
  onOpenedChange?: (open: boolean) => void; beforeOpen?: () => Promise<boolean>
  mediaKind?: 'text' | 'voice' | 'video'; mediaSrc?: string
  senderPreview?: boolean; receiverView?: boolean; initiallyOpen?: boolean; autoOpen?: boolean
}

export function BookCard({ template, values, soundEnabled, onOpen, onOpenedChange, beforeOpen,
  mediaKind = 'text', mediaSrc = '', senderPreview = false, receiverView = false, initiallyOpen = false, autoOpen = false }: Props) {
  const [phase, setPhase] = useState<Phase>(initiallyOpen ? 'opened' : 'sealed')
  const [checking, setChecking] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [error, setError] = useState('')
  const phaseRef = useRef<Phase>(initiallyOpen ? 'opened' : 'sealed')
  const lock = useRef(false)
  const generation = useRef(0)
  const mounted = useRef(true)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const hasOpened = useRef(initiallyOpen)
  const callbacks = useRef({ beforeOpen, onOpen, onOpenedChange, soundEnabled })
  callbacks.current = { beforeOpen, onOpen, onOpenedChange, soundEnabled }
  const envelope = useRef<HTMLButtonElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  function move(next: Phase) { phaseRef.current = next; setPhase(next) }
  function delay(action: () => void, milliseconds: number) {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const current = generation.current
    timers.current.push(setTimeout(() => {
      if (mounted.current && current === generation.current) action()
    }, reduced ? 0 : milliseconds))
  }
  useEffect(() => {
    mounted.current = true
    lock.current = false
    const pending = timers.current
    return () => {
      mounted.current = false
      generation.current += 1
      pending.forEach(clearTimeout)
      timers.current = []
    }
  }, [])
  useEffect(() => {
    if (phase === 'opened' && senderPreview) closeButton.current?.focus({ preventScroll: true })
    if (phase === 'sealed' && hasOpened.current) envelope.current?.focus({ preventScroll: true })
  }, [phase, senderPreview])

  async function open(automatic = false) {
    if (lock.current || phaseRef.current !== 'sealed') return
    lock.current = true
    setChecking(true)
    setError('')
    const current = generation.current
    try {
      const allowed = callbacks.current.beforeOpen ? await callbacks.current.beforeOpen() : true
      if (!mounted.current || current !== generation.current) return
      if (!allowed) { lock.current = false; return }
      setChecking(false)
      move('unsealing')
      if (callbacks.current.soundEnabled && !automatic) callbacks.current.onOpen()
      delay(() => {
        move('revealing-book')
        delay(() => {
          move('opening')
          delay(() => {
            move('opened')
            if (receiverView && !hasOpened.current) {
              setCelebrating(true)
              delay(() => setCelebrating(false), 1500)
            }
            hasOpened.current = true
            lock.current = false
            callbacks.current.onOpenedChange?.(true)
          }, window.matchMedia('(max-width: 560px)').matches ? 950 : 1050)
        }, 450)
      }, 450)
    } catch {
      if (mounted.current && current === generation.current) {
        lock.current = false
        setError('Could not open your wish. Please try again.')
      }
    } finally {
      if (mounted.current && current === generation.current) setChecking(false)
    }
  }
  // A private gift link or inbox card is one action: animate after server-authorised reveal.
  // The effect does not rerun after the reader intentionally closes the book.
  useEffect(() => { if (receiverView && autoOpen && !initiallyOpen) void open(true) }, [receiverView, autoOpen, initiallyOpen])

  function close() {
    if (lock.current || phaseRef.current !== 'opened') return
    lock.current = true
    setCelebrating(false)
    move('closing')
    callbacks.current.onOpenedChange?.(false)
    delay(() => {
      move('sealed')
      lock.current = false
    }, window.matchMedia('(max-width: 560px)').matches ? 950 : 1050)
  }
  const theme = palette[template]
  const item = templates.find(t => t.id === template) || templates[0]
  const opened = phase === 'opened'
  const turning = phase === 'opening' || opened
  const busy = checking || phase === 'unsealing' || phase === 'revealing-book' || phase === 'opening' || phase === 'closing'
  const variables = { '--book-top': theme.top, '--book-bottom': theme.bottom,
    '--book-ink': theme.ink, '--book-accent': theme.accent } as CSSProperties
  return <div className={styles.preview} data-receiver-view={receiverView || undefined}
    data-card-open={opened} data-book-phase={phase} data-theme={template} style={variables}>
    <div className={styles.stage}>
      {celebrating && <div className={styles.celebration} aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <span key={index} style={{ '--piece-index': index } as CSSProperties} />)}</div>}
      <div className={styles.bookShadow} aria-hidden="true" />
      <div className={styles.pageStack} aria-hidden="true" />
      <div className={styles.spine} aria-hidden="true" />
      <div className={styles.spread} aria-hidden={!opened}>
        <div className={styles.page} role="group" aria-label="Card details" tabIndex={opened ? 0 : -1}>
          {opened && <><span className={styles.eyebrow}>WITH LOVE</span>
            <strong>{values.sender.trim() || 'Your name'}</strong>
            <span>For {values.candidate.trim() || 'your candidate'}</span>
            {values.school?.trim() && <span>{values.school.trim()}</span>}
            <span>{values.examYear || '2026'} exams</span><span className={styles.ornament}>✧</span></>}
        </div>
        <div className={styles.page} role="group" aria-label="Personal wish" tabIndex={opened ? 0 : -1}>
          {opened && <><span className={styles.eyebrow}>{item.name}</span><h3>{item.headline}</h3>
            <strong>{values.candidate.trim() || 'Candidate name'}</strong>
            <p data-testid="success-card-message-preview">{values.message.trim() || 'Your personal message will appear here.'}</p>
            <span className={styles.signoff}>With every good wish, {values.sender.trim() || 'Your name'}</span></>}
        </div>
      </div>
      <div className={styles.cover} data-turned={turning} aria-hidden="true">
        <div className={styles.coverThickness} aria-hidden="true" />
        <div className={styles.outside}><span>VIBESCHOOL · SUCCESS WISHES</span>
          <b>{template === 'botanical' ? '✿' : template === 'nightfall' ? '✦' : template === 'sunrise' ? '✳' : '✧'}</b>
          <strong>{item.headline}</strong><small>{values.candidate.trim() || 'Someone special'}</small></div>
        <div className={styles.inside}><span>WITH LOVE</span><b>✧</b></div>
      </div>
      {(phase === 'sealed' || phase === 'unsealing') && <button ref={envelope} type="button"
        className={styles.envelope} data-unsealing={phase === 'unsealing'} disabled={busy} aria-busy={busy}
        aria-label={hasOpened.current ? 'Open the book card' : 'Open the envelope and reveal the success card'}
        onClick={() => void open()}>
        <span>VIBESCHOOL · SUCCESS WISHES</span><b className={styles.wax}>✧</b>
        <strong>A gift for {values.candidate.trim() || 'someone special'}</strong>
        <small>{values.school?.trim() || `${values.examYear || '2026'} exams`}</small>
        <em>{checking ? 'Checking access…' : 'Tap the seal to open'}</em>
      </button>}
    </div>
    {opened && <div className={styles.actions}>
      <button ref={closeButton} type="button" onClick={() => close()} aria-label="Close the book card">Close card</button>
    </div>}
    {busy && <span role="status" className={styles.status}>{checking ? 'Checking access…' : phase === 'closing' ? 'Closing card…' : 'Opening your wish…'}</span>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {opened && mediaSrc && mediaKind !== 'text' && <section className={styles.playback} aria-label="Sender recording preview">
      <strong>{mediaKind === 'voice' ? 'Listen to your voice wish' : 'Watch your video wish'}</strong>
      {mediaKind === 'voice' ? <audio controls preload="metadata" src={mediaSrc} aria-label="Preview your recorded voice wish"/>
        : <video controls playsInline preload="metadata" src={mediaSrc} aria-label="Preview your recorded video wish"/>}
    </section>}
  </div>
}

export default BookCard

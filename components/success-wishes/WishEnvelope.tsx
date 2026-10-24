'use client'

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { playWishRevealSound } from '@/lib/success-wishes/signature-sound'
import styles from './WishEnvelope.module.css'

type Props = { recipient: string; sender: string; onOpened: () => void }

// Fixed offsets (not random) so every open looks the same.
const SPARKS = Array.from({ length: 14 }, (_, index) => {
  const angle = (index / 14) * Math.PI * 2
  const reach = 70 + (index % 3) * 24
  return { dx: Math.round(Math.cos(angle) * reach), dy: Math.round(Math.sin(angle) * reach), delay: (index % 4) * 40 }
})

// Presentation only. Sound plays strictly after the user taps the seal.
export default function WishEnvelope({ recipient, sender, onOpened }: Props) {
  const [opening, setOpening] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stopSound = useRef<(() => void) | null>(null)
  const done = useRef(false)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
    if (!done.current) stopSound.current?.()
  }, [])

  function open() {
    if (opening) return
    setOpening(true)
    stopSound.current = playWishRevealSound()
    const reduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    timer.current = setTimeout(() => { done.current = true; onOpened() }, reduced ? 0 : 1100)
  }

  const chars = Array.from(sender.trim())
  const initial = (chars.find(char => char.toLowerCase() !== char.toUpperCase() || /[0-9]/.test(char)) || chars[0] || 'V').toUpperCase()
  const name = recipient === 'You' ? 'you' : recipient

  return <div className={styles.stage}>
    <button type="button" className={[styles.button, opening ? styles.opening : ''].join(' ')}
      onClick={open} aria-disabled={opening} aria-label={'Open the wish from ' + sender}>
      <span className={styles.envelope} aria-hidden="true">
        <span className={styles.letter} />
        <span className={styles.pocket} />
        <span className={styles.flap} />
        <span className={styles.tag}><small>A wish for</small><strong>{name}</strong></span>
        <span className={styles.seal}>{initial}</span>
        {opening && SPARKS.map((spark, index) => <i key={index} className={styles.spark}
          style={{ '--dx': spark.dx + 'px', '--dy': spark.dy + 'px', animationDelay: spark.delay + 'ms' } as CSSProperties} />)}
      </span>
    </button>
    <p className={styles.hint} role="status">{opening ? 'Opening your wish…' : 'Tap the wax seal to open'}</p>
  </div>
}

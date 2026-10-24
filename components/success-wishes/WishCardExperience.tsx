'use client'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, GraduationCap, Heart, LockKeyhole, Mic, Play, RotateCcw, Sparkles, Video } from 'lucide-react'
import styles from './WishCardExperience.module.css'
import WishEnvelope from './WishEnvelope'

type Props = {
  recipient?: string; school?: string; sender?: string
  text?: string | null; kind?: 'text' | 'voice' | 'video'
  mediaUrl?: string | null; busy?: boolean; onPlay?: () => void
  ceremony?: boolean
}

// Pure presentation: real inbox API controls consent, identity and private playback.
export default function WishCardExperience({recipient, school, sender, text, kind = 'text', mediaUrl, busy = false, onPlay, ceremony = true}: Props) {
  const [step, setStep] = useState(0)
  const [opened, setOpened] = useState(!ceremony)
  const cover = useRef<HTMLElement>(null)
  const fromCeremony = useRef(false)
  const who = recipient || 'You'
  const from = sender || 'Someone special'
  const schoolName = school
  const wish = text?.trim()
  const screens = ['Cover', 'Message', 'Voice and video', 'Final wish']
  const next = () => setStep(value => Math.min(3, value + 1))
  const screenStyle = (index: number, variant: string) => [styles.phone, variant, step === index ? styles.current : styles.notCurrent].join(' ')

  useEffect(() => {
    if (opened && fromCeremony.current) cover.current?.focus({ preventScroll: true })
  }, [opened])

  return <section className={styles.experience} aria-label="Private success card">
    <div className={styles.topline}>
      <div><span className={styles.overline}><Sparkles size={14} aria-hidden="true"/>JUST FOR YOU</span>
        <h2>Open your special wish</h2>
        <p>A message from someone cheering you on.</p></div>
      <span className={styles.privacy}><LockKeyhole size={14} aria-hidden="true"/>Private view</span>
    </div>
    {!opened ? <WishEnvelope recipient={who} sender={from} onOpened={() => { fromCeremony.current = true; setOpened(true) }}/> : <>
    <div className={styles.screenGrid}>
      <article ref={cover} tabIndex={-1} className={screenStyle(0, styles.cover)} aria-label="Cover — 1 of 4">
        <div className={styles.phoneTop}><span><GraduationCap size={16} aria-hidden="true"/> VibeSchool</span><span>FOR YOU</span></div>
        <div className={styles.coverArtwork} aria-hidden="true"><span className={styles.halo}/><span className={styles.figureHead}/><span className={styles.figureBody}/><Sparkles className={styles.coverStar} size={25}/></div>
        <div className={styles.coverCopy}><span className={styles.cheer}>Your future is bright</span><div className={styles.coverTitle}>ALL THE<br/><em>BEST!</em></div><span className={styles.recipient}>{who}</span>{schoolName && <span className={styles.schoolName}>{schoolName}</span>}</div>
        <button className={styles.phoneAction} type="button" onClick={next}>Open your card <ArrowRight size={16} aria-hidden="true"/></button>
      </article>
      <article className={screenStyle(1, styles.note)} aria-label="Your message — 2 of 4">
        <div className={styles.phoneTop}><span><Heart size={15} aria-hidden="true"/> A message for you</span><span>02 / 04</span></div>
        <div className={styles.paper}><span className={styles.quoteMark} aria-hidden="true">“</span>
          <p className={styles.dear}>Dear {who === 'You' ? 'friend' : who.split(' ')[0].replace(/[()]/g, '')},</p>
          <p className={styles.wishText}>{wish || (kind === 'voice' ? 'A special voice message is waiting for you.' : kind === 'video' ? 'Someone has recorded a special video wish for you.' : 'Someone is cheering you on.')}</p>
          <div className={styles.signature}><Heart size={15} fill="currentColor" aria-hidden="true"/>With love, {from}</div>
        </div>
        <div className={styles.noteHorizon} aria-hidden="true"/>
        <button className={styles.phoneAction} type="button" onClick={next}>Continue <ArrowRight size={16} aria-hidden="true"/></button>
      </article>
      <article className={screenStyle(2, styles.voices)} aria-label="Voice and video — 3 of 4">
        <div className={styles.phoneTop}><span><Mic size={16} aria-hidden="true"/> Voices of support</span><span>03 / 04</span></div>
        {kind === 'text' ? <div className={styles.mediaPlaceholder}><Heart size={36} aria-hidden="true"/><strong>Words worth keeping</strong><p>This wish was sent as a personal message.</p></div> : <>
          <div className={styles.mediaPoster}>
            <span className={styles.mediaIcon}>{kind === 'voice' ? <Mic size={26} aria-hidden="true"/> : <Video size={26} aria-hidden="true"/>}</span>
            <strong>{kind === 'voice' ? 'A voice note for you' : 'A video wish for you'}</strong><small>From {from}</small>
            {mediaUrl && kind === 'voice' && <audio controls className={styles.player} src={mediaUrl} preload="none"/>}
            {mediaUrl && kind === 'video' && (mediaUrl.startsWith('blob:') ? <video controls playsInline className={styles.player} src={mediaUrl} preload="metadata"/> : <iframe className={styles.player} title="Private success wish video" src={mediaUrl} referrerPolicy="no-referrer" allow="fullscreen" sandbox="allow-scripts allow-same-origin allow-presentation"/>)}
            {!mediaUrl && onPlay && <button className={styles.playButton} type="button" disabled={busy} onClick={onPlay}><Play size={16} aria-hidden="true"/>{busy ? 'Opening…' : 'Play private ' + kind}</button>}
            {!mediaUrl && !onPlay && <p className={styles.mediaHint}>Your media preview is not available.</p>}
          </div>
          <p className={styles.mediaHint}>Finish and sign out when using a shared device.</p>
        </>}
        <button className={styles.phoneAction} type="button" onClick={next}>One last thing <ArrowRight size={16} aria-hidden="true"/></button>
      </article>
      <article className={screenStyle(3, styles.closing)} aria-label="Final encouragement — 4 of 4">
        <div className={styles.phoneTop}><span><Sparkles size={16} aria-hidden="true"/> Your moment</span><span>04 / 04</span></div>
        <div className={styles.sunrise}><span className={styles.sun} aria-hidden="true"/><div className={styles.finalTitle}>Go make<br/>it happen!</div><p>We believe in you.</p></div>
        <div className={styles.affirmations}><div><CheckCircle2 size={18} aria-hidden="true"/>You are capable</div><div><CheckCircle2 size={18} aria-hidden="true"/>You are prepared</div><div><CheckCircle2 size={18} aria-hidden="true"/>You are supported</div></div>
        <button className={styles.phoneAction} type="button" onClick={() => setStep(0)}><RotateCcw size={15} aria-hidden="true"/> View again</button>
      </article>
    </div>
    <nav className={styles.navigation} aria-label="Card pages"><button type="button" className={styles.back} onClick={() => setStep(value => Math.max(0, value - 1))} disabled={step === 0}><ArrowLeft size={16} aria-hidden="true"/> Back</button>
      <div className={styles.steps}>{screens.map((screen, index) => <button type="button" key={screen} className={[styles.dot, step === index ? styles.activeDot : ''].join(' ')} aria-current={step === index ? 'step' : undefined} aria-label={'Show ' + screen} onClick={() => setStep(index)}>{index < step ? <Check size={12} aria-hidden="true"/> : index + 1}</button>)}</div>
      <button type="button" className={styles.forward} onClick={step === 3 ? () => setStep(0) : next}>{step === 3 ? 'Replay' : 'Next'} <ArrowRight size={16} aria-hidden="true"/></button></nav>
    </>}
  </section>
}

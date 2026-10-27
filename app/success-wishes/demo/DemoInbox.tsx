'use client'

import Link from 'next/link'
import { useState } from 'react'
import { BookCard, type Template } from '@/components/success-wishes/SuccessCardStudio'
import ReceiverGift from '@/components/success-wishes/ReceiverGift'
import styles from '../Receiver.module.css'

const samples: { id: string; theme: Template; sender: string; message: string }[] = [
  { id: 'sample-family', theme: 'heritage', sender: 'Your family', message: 'You have worked so hard to reach this moment. Take a deep breath, trust what you have learnt and do your best. We believe in you, and we are proud of you.' },
  { id: 'sample-teacher', theme: 'botanical', sender: 'Your teacher', message: 'One question at a time. Read carefully, keep going and remember how far you have come. Your preparation matters. Wishing you every success!' },
  { id: 'sample-friend', theme: 'nightfall', sender: 'A friend', message: 'You were made to shine. Walk into your exams with courage. I am cheering you on every step of the way!' },
  { id: 'sample-mentor', theme: 'sunrise', sender: 'Your mentor', message: 'This is the beginning of another chapter. Keep your curiosity, kindness and determination. Your future holds so much possibility.' },
]

/** A public UI demonstration. Never reads, claims or modifies a real receiver session. */
export default function DemoInbox() {
  const [selected, setSelected] = useState<string | null>(null)
  const [opened, setOpened] = useState<string[]>([])
  const [filter, setFilter] = useState<'all' | 'unopened'>('all')
  const card = samples.find(item => item.id === selected)
  const unseen = samples.length - opened.length
  const visible = samples.filter(item => filter === 'all' || !opened.includes(item.id))

  return <div className={styles.page}>
    <header className={styles.top}>
      <Link className={styles.brand} href="/success-wishes">VIBESCHOOL / SUCCESS WISHES</Link>
      <span className={styles.muted}>Demo inbox</span>
    </header>
    <main className={styles.wrap}>
      <div className={styles.notice} role="note"><strong>Demo · Sample wishes only.</strong> No code needed. These are fictional messages; your private inbox is separate.</div>
      {card ? <>
        <div className={styles.actions}><button className={styles.secondary} onClick={() => setSelected(null)}>← Back to demo inbox</button></div>
        <section className={styles.hero}><p className={styles.eyebrow}>A SAMPLE GIFT FOR YOU</p><h1>A little joy, just for you.</h1></section>
        <div className={styles.giftStage}>
          <BookCard key={card.id} receiverView template={card.theme} soundEnabled={false} onOpen={() => {}}
            values={{ candidate: 'Sample candidate', sender: card.sender, message: card.message, school: 'Sample School', examYear: '2026' }}
            onOpenedChange={isOpen => { if (isOpen) setOpened(previous => previous.includes(card.id) ? previous : [...previous, card.id]) }} />
        </div>
      </> : <>
        <section className={styles.hero} style={{ paddingTop: 24 }}><p className={styles.eyebrow}>MADE FOR YOU</p><h1>Your little collection of joy.</h1><p>Tap a sample wish to experience opening your gift.</p></section>
        <div className={styles.stats}>
          <div className={styles.stat}><strong>{samples.length}</strong><span>Sample wishes</span></div>
          <div className={styles.stat}><strong>{unseen}</strong><span>Waiting to open</span></div>
        </div>
        <div className={styles.tabs}>
          <button className={styles.tab} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All wishes ({samples.length})</button>
          <button className={styles.tab} aria-pressed={filter === 'unopened'} onClick={() => setFilter('unopened')}>Unopened ({unseen})</button>
        </div>
        <div className={styles.gifts}>{visible.map(item => {
          const seen = opened.includes(item.id)
          return <button key={item.id} type="button" className={styles.gift} onClick={() => setSelected(item.id)} aria-label={seen ? 'Read sample wish again' : 'Open sample wish'}>
            <ReceiverGift theme={item.theme} label={seen ? 'A wish to remember' : 'A surprise inside'} />
            <div className={styles.giftMeta}><strong>{seen ? item.sender : 'Someone believes in you'}</strong><small>Sample message</small><span className={styles.giftAction}>{seen ? 'Read again ↗' : 'Unwrap my wish ↗'}</span></div>
          </button>
        })}</div>
        {visible.length === 0 && <section className={styles.panel}><h2>You opened every sample wish.</h2><button className={styles.secondary} onClick={() => setFilter('all')}>View all wishes</button></section>}
        <div className={styles.actions}><button className={styles.secondary} onClick={() => { setOpened([]); setFilter('all') }}>Reset demo</button><Link className={styles.primary} href="/success-wishes/inbox">Open my private inbox</Link></div>
      </>}
      <div className={styles.links}><Link href="/success-wishes">Send a real wish</Link><Link href="/success-wishes/open">I have a private card code</Link></div>
    </main>
  </div>
}

'use client'

import Link from 'next/link'
import {useCallback, useEffect, useRef, useState, type CSSProperties} from 'react'
import {useRouter} from 'next/navigation'
import {ArrowRight, Check, Heart, Mail, Search, Sparkles} from 'lucide-react'
import ReceiverAccount from '@/components/success-wishes/ReceiverAccount'
import {useReceiverTheme} from '@/components/success-wishes/ReceiverShell'
import {palette, templates} from '@/components/success-wishes/card-themes'
import {broadcastKeepsakeChange, watchKeepsakeChange, rememberInbox} from '@/lib/success-wishes/receiver-pin-browser'
import styles from './page.module.css'

type Card = {id:string; source:'paid'|'free'|'group'|'legacy'; sender:string|null; opened:boolean; theme?:string; createdAt?:string}
type Inbox = {legacy?:boolean; recipient:{id?:string; name:string; school:string}; cards:Card[]}

export default function MyWishes() {
  const router = useRouter()
  const {setSummary} = useReceiverTheme()
  const [data, setData] = useState<Inbox|null>(null)
  const [login, setLogin] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const [locking, setLocking] = useState(false)
  const [opening, setOpening] = useState<string|null>(null)
  const [filter, setFilter] = useState<'all'|'unopened'>('all')
  const [query, setQuery] = useState('')
  const generation = useRef({value:0})
  const openingLock = useRef(false)
  const sessionGeneration = useRef({value:0})
  const unopened = data?.cards.filter(card => !card.opened).length || 0

  useEffect(() => {
    setSummary(data ? {...data.recipient, count:data.cards.length, unopened} : null)
    return () => setSummary(null)
  }, [data, unopened, setSummary])

  const load = useCallback(async () => {
    const revision = ++generation.current.value
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/success-wishes/receiver/collection', {cache:'no-store'})
      const payload = await response.json()
      if (revision !== generation.current.value) return
      if (response.status === 401) {sessionGeneration.current.value++; openingLock.current=false; setOpening(null); setData(null); setLogin(true); return}
      if (!response.ok) throw Error(payload.error || 'Could not load your wishes.')
      if (payload.recipient.id) rememberInbox(payload.recipient.id, payload.recipient.name)
      setData(payload)
      setLogin(false)
    } catch (reason) {
      if (revision === generation.current.value) setError(reason instanceof Error ? reason.message : 'Could not load your wishes.')
    } finally {
      if (revision === generation.current.value) setBusy(false)
    }
  }, [])

  useEffect(() => {
    const state = generation.current
    const session = sessionGeneration.current
    void load()
    const clear = () => {
      state.value++
      session.value++
      setData(null); setLogin(true); setBusy(false)
      setQuery(''); setFilter('all'); setOpening(null); openingLock.current = false
    }
    const stop = watchKeepsakeChange(clear)
    const visible = () => {if (document.visibilityState === 'visible') void load()}
    document.addEventListener('visibilitychange', visible)
    window.addEventListener('pagehide', clear)
    return () => {
      state.value++; session.value++; stop()
      document.removeEventListener('visibilitychange', visible)
      window.removeEventListener('pagehide', clear)
    }
  }, [load])

  async function openCard(card:Card) {
    if (openingLock.current || locking) return
    openingLock.current = true
    setOpening(card.source + card.id)
    setError('')
    const revision = sessionGeneration.current.value
    try {
      let url = '/success-wishes/gift?source=' + card.source + '&card=' + card.id
      if (card.source === 'legacy') {
        const response = await fetch('/api/success-wishes/receiver/inbox', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({cardId:card.id})})
        const payload = await response.json()
        if (!response.ok) throw Error(payload.error || 'Could not open this wish.')
        url = payload.url
      }
      if (revision === sessionGeneration.current.value) router.push(url)
    } catch (reason) {
      if (revision === sessionGeneration.current.value) {
        setError(reason instanceof Error ? reason.message : 'Could not open this wish.')
        setOpening(null)
        openingLock.current = false
      }
    }
  }

  async function lock() {
    if (locking) return
    setLocking(true)
    sessionGeneration.current.value++
    openingLock.current=false; setOpening(null)
    generation.current.value++
    setData(null); setLogin(true); setQuery(''); setFilter('all')
    broadcastKeepsakeChange()
    try {
      const response = await fetch('/api/success-wishes/receiver/account', {method:'DELETE', headers:{'Content-Type':'application/json'}, body:'{}'})
      if (!response.ok) throw Error()
    } catch {setError('Could not confirm the lock. Reconnect and try again.')}
    finally {
      generation.current.value++
      sessionGeneration.current.value++
      openingLock.current=false; setOpening(null)
      setData(null); setLogin(true); broadcastKeepsakeChange(); setLocking(false)
    }
  }

  const search = query.trim().toLowerCase()
  const cards = data?.cards.filter(card => {
    const design = templates.find(item => item.id === card.theme)
    const visibleSender = card.opened ? card.sender || 'Someone special' : 'A wish for you'
    return (filter === 'all' || !card.opened) && (!search || `${visibleSender} ${design?.name || ''}`.toLowerCase().includes(search))
  }) || []

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>MADE FOR YOU</p><h1>My wishes</h1></div>

    </header>
    {error && <div className={styles.error} role="alert"><p>{error}</p><button onClick={() => {openingLock.current=false; setOpening(null); void load()}}>Try again</button></div>}
    {busy && !data && <div className={styles.loading} role="status"><span className={styles.loadingIcon}><Mail size={24}/></span>Opening your wishes…</div>}
    {login && !busy && <ReceiverAccount onReady={() => void load()}/>}
    {data && <>
      <section className={styles.welcome} aria-label="Your collection">
        <span className={styles.welcomeIcon} aria-hidden="true"><Heart size={22}/></span>
        <div><h2>For {data.recipient.name}</h2><p>{data.cards.length ? 'Someone is cheering you on.' : 'A little encouragement belongs here.'}</p></div>
        <span className={styles.waiting}>{unopened ? `${unopened} waiting` : `${data.cards.length} saved`}</span>
      </section>
      {data.cards.length > 0 && <div className={styles.toolbar}>
        <div className={styles.filters} role="group" aria-label="Filter wishes">
          <button aria-pressed={filter==='all'} onClick={() => setFilter('all')}>All <span>{data.cards.length}</span></button>
          <button aria-pressed={filter==='unopened'} onClick={() => setFilter('unopened')}>Unopened <span>{unopened}</span></button>
        </div>
        <label className={styles.search}><Search size={17} aria-hidden="true"/><input aria-label="Search wishes" placeholder="Find a wish" value={query} onChange={event => setQuery(event.target.value)}/></label>
      </div>}
      {cards.length > 0 ? <section className={styles.grid} aria-label="Your wishes">{cards.map((card, index) => {
        const design = templates.find(item => item.id === card.theme) || templates[0]
        const colors = palette[design.id]
        const selected = opening === card.source + card.id
        const date = card.createdAt && Number.isFinite(Date.parse(card.createdAt)) ? new Date(card.createdAt).toLocaleDateString('en-KE', {day:'numeric', month:'short', year:'numeric'}) : ''
        return <button key={card.source+card.id} className={styles.card} data-theme={design.id} disabled={opening!==null || locking} aria-busy={selected} aria-label={card.opened ? `Read wish from ${card.sender || 'Someone special'}` : `Open wish ${index+1}, ${design.name}`} onClick={() => void openCard(card)}>
          <span className={styles.cover} aria-hidden="true" style={{'--cover-top':colors.top, '--cover-bottom':colors.bottom, '--cover-ink':colors.ink, '--cover-accent':colors.accent} as CSSProperties}>
            <span className={styles.coverFrame}/><span className={styles.coverBrand}>SUCCESS WISHES</span>
            <span className={styles.coverOrnament}>{design.id==='botanical' ? '✿' : design.id==='nightfall' ? '✦' : design.id==='sunrise' ? '☀' : '✧'}</span>
            <span className={styles.coverTitle}>{design.headline}</span>
            <span className={styles.coverName}>For {data.recipient.name}</span>
            <span className={styles.seal}>{card.opened ? <Check size={17}/> : <Heart size={17}/>}</span>
          </span>
          <span className={styles.cardBody}>
            <span className={styles.cardMeta}><span className={card.opened ? styles.opened : styles.unopened}>{!card.opened && <span className={styles.dot}/>} {card.opened ? 'Opened' : 'Unopened'}</span>{date && <span>{date}</span>}</span>
            <strong>{card.opened ? card.sender || 'Someone special' : 'A wish for you'}</strong>
            <span className={styles.cardAction}>{selected ? 'Opening…' : card.opened ? 'Read again' : 'Open your wish'}<ArrowRight size={17}/></span>
          </span>
        </button>
      })}</section> : <section className={styles.empty}><Sparkles size={32} aria-hidden="true"/><h2>{search ? 'No matching wishes' : filter==='unopened' && data.cards.length ? 'All wishes opened' : 'Your first wish awaits'}</h2><p>{search ? 'Try another name or card design.' : data.cards.length ? 'Read your favourite messages again.' : 'Your success cards will appear here when they are delivered to your collection.'}</p>{data.cards.length > 0 && <button onClick={() => {setQuery('');setFilter('all')}}>Show all wishes</button>}</section>}
      {data.legacy && <ReceiverAccount initialMode="create" candidate={data.recipient.name} onReady={() => void load()}/>}
    </>}
  </main>
}

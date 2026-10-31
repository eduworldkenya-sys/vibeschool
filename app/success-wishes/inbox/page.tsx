'use client'

import Link from 'next/link'
import {useCallback, useEffect, useRef, useState} from 'react'
import {useRouter} from 'next/navigation'
import {Gift, Heart, Mail, Search, Sparkles} from 'lucide-react'
import RememberedWishes from '@/components/success-wishes/RememberedWishes'
import ReceiverAccount from '@/components/success-wishes/ReceiverAccount'
import {useReceiverTheme} from '@/components/success-wishes/ReceiverShell'
import {templates} from '@/components/success-wishes/card-themes'
import WishTile from '@/components/success-wishes/WishTile'
import {watchKeepsakeChange, rememberInbox} from '@/lib/success-wishes/receiver-pin-browser'
import styles from './page.module.css'

type Card = {id:string; source:'paid'|'free'|'group'|'legacy'; sender:string|null; opened:boolean; theme?:string; createdAt?:string}
type Inbox = {legacy?:boolean; recipient:{id?:string; name:string; school:string}; cards:Card[]}

export default function MyWishes() {
  const router = useRouter()
  const {setSummary} = useReceiverTheme()
  const [data, setData] = useState<Inbox|null>(null)
  const [login, setLogin] = useState(false)
  const [remembered,setRemembered]=useState<number|null>(null)
  const [showAccount,setShowAccount]=useState(false)
  const giftsLoaded=useCallback((count:number)=>setRemembered(count),[])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
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
    if (openingLock.current) return
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

  const search = query.trim().toLowerCase()
  const cards = data?.cards.filter(card => {
    const design = templates.find(item => item.id === card.theme)
    const visibleSender = card.opened ? card.sender || 'Someone special' : 'A wish for you'
    return (filter === 'all' || !card.opened) && (!search || `${visibleSender} ${design?.name || ''}`.toLowerCase().includes(search))
  }) || []

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>A LITTLE JOY, JUST FOR YOU</p><h1>My wishes</h1></div>
    </header>
    {error && <div className={styles.error} role="alert"><p>{error}</p><button type="button" onClick={() => {openingLock.current=false; setOpening(null); void load()}}>Try again</button></div>}
    {busy && !data && <div className={styles.loading} role="status"><span className={styles.loadingIcon}><Mail size={23}/></span>Finding your wishes…</div>}
    <RememberedWishes onLoaded={giftsLoaded} excludeReceiverId={data?.recipient.id}/>
    {login && !busy && remembered===null && <p role="status" className={styles.helper}>Checking saved wishes on this device…</p>}
    {login && !busy && remembered===0 && !showAccount && <section className={styles.empty} aria-label="Empty inbox">
      <Mail size={28} aria-hidden="true"/>
      <h2>No wishes here yet</h2>
      <p>Received a private Success Card link? Open it from the sender's message. You can read your gift without signing up.</p>
      <div className={styles.emptyActions}>
        <Link href="/success-wishes/request">Request a wish</Link>
        <button type="button" onClick={() => setShowAccount(true)}>I have an inbox</button>
      </div>
    </section>}
    {login && !busy && remembered!==null && showAccount && <ReceiverAccount onReady={() => void load()}/>}
    {login && !busy && remembered!==null && remembered>0 && !showAccount && <div className={styles.pinEntry}>
      <button type="button" onClick={()=>setShowAccount(true)}>Open PIN-protected inbox</button>
    </div>}
    {data && <>
      <section className={styles.welcome} aria-label="Your collection">
        <span className={styles.welcomeIcon} aria-hidden="true"><Heart size={21}/></span>
        <div><h2>For {data.recipient.name}</h2><p>{data.cards.length ? 'Someone is cheering you on.' : 'A little encouragement belongs here.'}</p></div>
        <span className={styles.waiting}>{unopened ? String(unopened)+' surprises' : String(data.cards.length)+' saved'}</span>
      </section>
      {unopened>0 && <div className={styles.celebration} role="status"><span className={styles.celebrationIcon}><Gift size={22}/></span><span><strong>{unopened===1?'A surprise is waiting for you':`${unopened} surprises are waiting for you`}</strong><small>Tap a sealed wish to discover your message.</small></span></div>}
      {data.cards.length>1 && <div className={styles.toolbar}>
        <div className={styles.filters} role="group" aria-label="Filter wishes">
          <button type="button" aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>All <span>{data.cards.length}</span></button>
          <button type="button" aria-pressed={filter==='unopened'} onClick={()=>setFilter('unopened')}>Surprises <span>{unopened}</span></button>
        </div>
        <label className={styles.search}><Search size={17} aria-hidden="true"/><input aria-label="Search wishes" placeholder="Find a wish" value={query} onChange={event=>setQuery(event.target.value)}/></label>
      </div>}
      {cards.length>0 ? <section className={styles.grid} aria-label="Your wishes">{cards.map((card,index)=>{
        const design=templates.find(item=>item.id===card.theme)||templates[0]
        const date=card.createdAt&&Number.isFinite(Date.parse(card.createdAt))?new Date(card.createdAt).toLocaleDateString('en-KE',{day:'numeric',month:'short',year:'numeric'}):''
        const selected=opening===card.source+card.id
        return <WishTile key={card.source+card.id} recipient={data.recipient.name} theme={card.theme} sender={card.sender} opened={card.opened} date={date} busy={selected} disabled={opening!==null} ariaLabel={card.opened?'Read wish from '+(card.sender||'Someone special'):'Open wish '+String(index+1)+', '+design.name} onOpen={()=>void openCard(card)}/>
      })}</section> : <section className={styles.empty}>
        <Sparkles size={28} aria-hidden="true"/>
        <h2>{search?'No matching wishes':filter==='unopened'&&data.cards.length?'All wishes opened':'Your first wish awaits'}</h2>
        <p>{search?'Try another name or card design.':data.cards.length?'Read your favourite messages again.':'When a Success Card is sent to your collection, it will appear here.'}</p>
        {data.cards.length>0?<button type="button" onClick={()=>{setQuery('');setFilter('all')}}>Show all wishes</button>:<Link href="/success-wishes/request">Request a wish</Link>}
      </section>}
      {data.legacy && <ReceiverAccount initialMode="create" candidate={data.recipient.name} onReady={()=>void load()}/>}
    </>}
  </main>
}

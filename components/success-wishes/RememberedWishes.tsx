'use client'
import Link from 'next/link'
import {useCallback,useEffect,useRef,useState,type CSSProperties} from 'react'
import {ArrowRight,Check,Heart} from 'lucide-react'
import styles from '@/app/success-wishes/inbox/page.module.css'
import {watchKeepsakeChange} from '@/lib/success-wishes/receiver-pin-browser'
import type {RememberedGift} from '@/lib/success-wishes/remembered-gifts'
import {palette,templates,type Template} from './card-themes'
/** These tiles describe gifts already opened on this browser, never a phone-number directory. */
export default function RememberedWishes({onLoaded,excludeReceiverId}:{onLoaded:(count:number)=>void;excludeReceiverId?:string}){
 const [cards,setCards]=useState<RememberedGift[]>([]),[error,setError]=useState('')
 const generation=useRef(0)
 const load=useCallback(async()=>{const revision=++generation.current;try{const r=await fetch('/api/success-wishes/receiver/remembered',{cache:'no-store'});const p=await r.json();if(revision!==generation.current)return;if(!r.ok)throw Error(p.error);setCards(p.cards);setError('');onLoaded(p.cards.length)}catch{if(revision===generation.current){setError('Reconnect to load your saved gifts.');onLoaded(0)}}},[onLoaded])
 useEffect(()=>{void load();const clear=()=>{generation.current++;setCards([]);onLoaded(0)};const stop=watchKeepsakeChange(clear);const visible=()=>{if(document.visibilityState==='visible')void load()};document.addEventListener('visibilitychange',visible);window.addEventListener('pagehide',clear);return()=>{generation.current++;stop();document.removeEventListener('visibilitychange',visible);window.removeEventListener('pagehide',clear)}},[load,onLoaded])
 const visible=cards.filter(c=>!excludeReceiverId||c.collectionId!==excludeReceiverId&&c.recipientId!==excludeReceiverId)
 const groups=Array.from(new Set(visible.map(c=>c.recipientId)))
 if(error)return <p role="alert">{error} <button onClick={()=>void load()}>Try again</button></p>
 if(!visible.length)return null
 return <section aria-label="Saved gift collections" style={{display:'grid',gap:18,marginBottom:24}}>
  {groups.map(id=>{const gifts=visible.filter(c=>c.recipientId===id);return <section key={id} aria-label={gifts[0].candidate+' collection'} style={{display:'grid',gap:12}}>
   <h2 style={{fontSize:20,margin:'4px 0',color:'#F3E5AB'}}>For {gifts[0].candidate}</h2>
   <div className={styles.grid} style={gifts.length===1?{gridTemplateColumns:'minmax(0,580px)'}:undefined}>
    {gifts.map(c=>{const theme=palette[c.theme as Template]||palette.heritage;const design=templates.find(t=>t.id===c.theme)||templates[0];return <Link key={c.id} className={styles.card} data-theme={design.id} href={'/success-wishes/gift?source=remembered&card='+encodeURIComponent(c.id)} aria-label={'Read wish for '+c.candidate}>
     <span className={styles.cover} aria-hidden="true" style={{'--cover-top':theme.top,'--cover-bottom':theme.bottom,'--cover-ink':theme.ink,'--cover-accent':theme.accent} as CSSProperties}>
      <span className={styles.coverFrame}/><span className={styles.coverBrand}>SUCCESS WISHES</span><span className={styles.coverOrnament}>✧</span><span className={styles.coverTitle}>{design.headline}</span><span className={styles.coverName}>For {c.candidate}</span><span className={styles.seal}>{c.opened?<Check size={17}/>:<Heart size={17}/>}</span>
     </span>
     <span className={styles.cardBody}><span className={styles.cardMeta}><span className={c.opened?styles.opened:styles.unopened}>{c.opened?'Opened':'Unopened'}</span></span><strong>{c.opened?(c.sender||'Someone special'):'A wish for you'}</strong><span className={styles.cardAction}>Read your wish <ArrowRight size={17}/></span></span>
    </Link>})}
   </div>
  </section>})}
 </section>
}

'use client'
import Link from 'next/link'
import {useCallback,useEffect,useRef,useState} from 'react'
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
 return <section aria-label="Saved gift collections" style={{display:'grid',gap:16,marginBottom:16}}>
  <p style={{margin:0,color:'#c3c7d1'}}>Special wishes, always here.</p>
  {groups.map(id=>{const gifts=visible.filter(c=>c.recipientId===id);return <section key={id} aria-label={gifts[0].candidate+' collection'} style={{display:'grid',gap:10}}>
   <h2 style={{fontSize:20,margin:'4px 0'}}>{gifts[0].candidate}</h2>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,150px),1fr))',gap:12}}>{gifts.map(c=>{const theme=palette[c.theme as Template]||palette.heritage;const design=templates.find(t=>t.id===c.theme)||templates[0];return <Link key={c.id} href={'/success-wishes/gift?source=remembered&card='+c.id} style={{display:'grid',gap:12,minHeight:160,padding:18,border:'1px solid '+theme.accent,borderRadius:12,background:theme.top,color:theme.ink,textDecoration:'none'}}><strong>{design.headline}</strong><span>{c.sender?`From ${c.sender}`:'A wish for you'}</span><span>Read your wish →</span></Link>})}</div>
  </section>})}
 </section>
}

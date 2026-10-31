'use client'
import {useCallback,useEffect,useRef,useState} from 'react'
import {watchKeepsakeChange} from '@/lib/success-wishes/receiver-pin-browser'
import type {RememberedGift} from '@/lib/success-wishes/remembered-gifts'
import WishTile from './WishTile'
import styles from './RememberedWishes.module.css'

/** Read only gifts previously opened on this browser; a shared phone never enumerates accounts. */
export default function RememberedWishes({onLoaded,excludeReceiverId}:{onLoaded:(count:number)=>void;excludeReceiverId?:string}){
 const [cards,setCards]=useState<RememberedGift[]>([])
 const [error,setError]=useState('')
 const generation=useRef(0)
 const load=useCallback(async()=>{
  const revision=++generation.current
  try{
   const r=await fetch('/api/success-wishes/receiver/remembered',{cache:'no-store'})
   const p=await r.json()
   if(revision!==generation.current)return
   if(!r.ok)throw Error(p.error||'Saved wishes unavailable')
   const gifts:Array<RememberedGift>=Array.isArray(p.cards)?p.cards:[]
   setCards(gifts);setError('')
   onLoaded(gifts.filter(c=>!excludeReceiverId||(c.collectionId!==excludeReceiverId&&c.recipientId!==excludeReceiverId)).length)
  }catch{
   if(revision===generation.current){setCards([]);setError('Could not load saved wishes.');onLoaded(0)}
  }
 },[onLoaded,excludeReceiverId])
 useEffect(()=>{
  void load()
  const clear=()=>{generation.current++;setCards([]);onLoaded(0)}
  const stop=watchKeepsakeChange(clear)
  const visible=()=>{if(document.visibilityState==='visible')void load()}
  document.addEventListener('visibilitychange',visible)
  window.addEventListener('pagehide',clear)
  return()=>{generation.current++;stop();document.removeEventListener('visibilitychange',visible);window.removeEventListener('pagehide',clear)}
 },[load,onLoaded])
 const visible=cards.filter(c=>!excludeReceiverId||(c.collectionId!==excludeReceiverId&&c.recipientId!==excludeReceiverId))
 const groups=Array.from(new Set(visible.map(c=>c.recipientId)))
 if(error)return <p role="alert" className={styles.error}>{error} <button type="button" onClick={()=>void load()}>Try again</button></p>
 if(!visible.length)return null
 return <section className={styles.collections} aria-label="Saved gift collections">
  <p className={styles.intro}>Saved on this device</p>
  {groups.map(id=>{
   const gifts=visible.filter(c=>c.recipientId===id)
   return <section className={styles.group} key={id} aria-label={gifts[0].candidate+' collection'}>
    <h2>For {gifts[0].candidate}</h2>
    <div className={styles.grid}>
     {gifts.map(c=><WishTile key={c.id} recipient={c.candidate} theme={c.theme} sender={c.sender} opened={c.opened} ariaLabel={c.sender?'Read wish from '+c.sender:'Open wish for '+c.candidate} href={'/success-wishes/gift?source=remembered&card='+encodeURIComponent(c.id)}/>)}
    </div>
   </section>
  })}
 </section>
}

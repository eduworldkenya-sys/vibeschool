'use client'
import Link from 'next/link'
import styles from './page.module.css'
import {watchKeepsakeChange} from '@/lib/success-wishes/receiver-pin-browser'
import {useReceiverTheme} from '@/components/success-wishes/ReceiverShell'
import KeepWish from '@/components/success-wishes/KeepWish'
import { useEffect, useRef, useState } from 'react'
import ReceiverEnvelope from '@/components/success-wishes/ReceiverEnvelope'
import { playWishRevealSound } from '@/lib/success-wishes/signature-sound'
import type { Template } from '@/components/success-wishes/SuccessCardStudio'
import GiftShareActions from '@/components/success-wishes/GiftShareActions'
import DownloadSuccessCard from '@/components/success-wishes/DownloadSuccessCard'

type Gift = {id:string;source?:string;theme:Template;candidate:string;school:string;examYear:string;sender:string|null;message?:string;remembered?:boolean}
async function fetchGift(token:string,reveal=false):Promise<Gift> {
  const query=new URLSearchParams(window.location.search),id=query.get('card'),source=query.get('source')
  const response=await fetch(id?(source==='remembered'?'/api/success-wishes/receiver/remembered':'/api/success-wishes/receiver/collection'):'/api/success-wishes/gift',{method:id?'POST':reveal?'PUT':'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify(id?{id,source,reveal}:{token}),cache:'no-store'})
  const body=await response.json()
  if(!response.ok)throw Error(body.error||'This private gift is unavailable.')
  return body.card as Gift
}
export default function PrivateGiftPage(){
  const [gift,setGift]=useState<Gift|null>(null)
  const [busy,setBusy]=useState(true)
  const [error,setError]=useState('')
  const {soundEnabled}=useReceiverTheme()
  const [opened,setOpened]=useState(false)
  const sound=useRef<(()=>void)|null>(null)
  const secret=useRef('')
  const generation=useRef({value:0})
  useEffect(()=>{
    let active=true
    const state=generation.current,revision=++state.value
    const value=new URLSearchParams(window.location.hash.slice(1)).get('token')||''
    secret.current=value
    if(!new URLSearchParams(location.search).get('card')&&!/^[a-f0-9]{64}$/.test(value)){setError('Open the private gift link shared by the sender.');setBusy(false);return}
    void fetchGift(value,false).then(card=>{if(active&&revision===state.value){setGift(card);setOpened(false)}})
      .catch(reason=>{if(active&&revision===state.value)setError(reason instanceof Error?reason.message:'Gift unavailable.')})
      .finally(()=>{if(active&&revision===state.value)setBusy(false)})
    const clear=()=>{if(!secret.current){state.value++;setGift(null);setOpened(false);setBusy(false);setError('Your inbox changed. Open My wishes to continue.')}}
    const stop=watchKeepsakeChange(clear)
    const verify=()=>{if(document.visibilityState==='visible'&&!secret.current){const current=state.value;void fetchGift('',false).then(card=>{if(active&&current===state.value){setGift(card);setOpened(true)}}).catch(clear)}}
    window.addEventListener('pagehide',clear);document.addEventListener('visibilitychange',verify)
    return()=>{active=false;state.value++;stop();window.removeEventListener('pagehide',clear);document.removeEventListener('visibilitychange',verify);sound.current?.()}
  },[])
  async function reveal(){
    try{
      const revision=generation.current.value
      const card=await fetchGift(secret.current,true)
      if(revision!==generation.current.value)return false
      setGift(card);setError('')
      return true
    }catch(reason){setError(reason instanceof Error?reason.message:'The gift could not be opened.');return false}
  }
  useEffect(()=>{if(!soundEnabled)sound.current?.()},[soundEnabled])
  function play(){sound.current?.();sound.current=playWishRevealSound()}
  return <main className={styles.page}>
    <div className={styles.layout}>
      <header className={styles.header}>
        <Link href="/success-wishes/inbox" className={styles.back}>My wishes</Link>
        <p className={styles.eyebrow}>SUCCESS WISHES 2026</p>
        <h1>{gift ? opened && gift.sender ? 'From '+gift.sender+' to '+gift.candidate : 'For '+gift.candidate : 'Your Success Card'}</h1>
      </header>
      {busy&&<div role="status" className={styles.loading}>Finding your gift…</div>}
      {error&&<div role="alert" className={styles.error}><p>{error}</p><Link href="/success-wishes/inbox">Back to My wishes</Link></div>}
      {gift&&!busy&&<section aria-label="Your private Success Wish" className={opened ? styles.bookOpened : styles.book}>
        <ReceiverEnvelope receiverView autoOpen template={gift.theme}
          values={{candidate:gift.candidate,school:gift.school,examYear:gift.examYear,sender:gift.sender||'',message:gift.message||''}}
          soundEnabled={soundEnabled} onOpen={play} beforeOpen={reveal} onOpenedChange={setOpened}/>
      </section>}
      {gift&&<div className={styles.after}>
        <p className={styles.note}>{opened?(gift.remembered===false?'Keep the private gift link to read again.':gift.source==='remembered'||gift.remembered===true?'Your wish is saved on this device.':'Your wish remains in your private inbox.'):'You can open the book again whenever you like.'}</p>
        <Link className={styles.return} href="/success-wishes/inbox">Back to My wishes</Link>
        {opened&&gift.message&&gift.message.length>140&&<details className={styles.fullMessage}><summary>Read the full message</summary><p>{gift.message}</p></details>}
        {opened&&<details className={styles.more}>
          <summary>Save, share or send a wish</summary>
          <div className={styles.moreBody}>
            <DownloadSuccessCard gift={gift}/>
            {secret.current&&<KeepWish token={secret.current} candidate={gift.candidate}/>}
            {secret.current&&<GiftShareActions link={'https://vibeschool.co.ke/success-wishes/gift#token='+secret.current} candidate={gift.candidate} sender={gift.sender||undefined}/>}
            <Link className={styles.send} href="/success-wishes">Send a Success Card</Link>
          </div>
        </details>}
      </div>}
    </div>
  </main>
}

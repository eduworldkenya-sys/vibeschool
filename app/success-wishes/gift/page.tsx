'use client'
import Link from 'next/link'
import {watchKeepsakeChange} from '@/lib/success-wishes/receiver-pin-browser'
import {useReceiverTheme} from '@/components/success-wishes/ReceiverShell'
import KeepWish from '@/components/success-wishes/KeepWish'
import { useEffect, useRef, useState } from 'react'
import ReceiverEnvelope from '@/components/success-wishes/ReceiverEnvelope'
import { playWishRevealSound } from '@/lib/success-wishes/signature-sound'
import type { Template } from '@/components/success-wishes/SuccessCardStudio'
import GiftShareActions from '@/components/success-wishes/GiftShareActions'
import DownloadSuccessCard from '@/components/success-wishes/DownloadSuccessCard'

type Gift = {id:string;theme:Template;candidate:string;school:string;examYear:string;sender:string|null;message?:string}
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
    void fetchGift(value,true).then(card=>{if(active&&revision===state.value){setGift(card);setOpened(true)}})
      .catch(reason=>{if(active&&revision===state.value)setError(reason instanceof Error?reason.message:'Gift unavailable.')})
      .finally(()=>{if(active&&revision===state.value)setBusy(false)})
    const clear=()=>{if(!secret.current){state.value++;setGift(null);setOpened(false);setBusy(false);setError('Your inbox changed. Open My wishes to continue.')}}
    const stop=watchKeepsakeChange(clear)
    const verify=()=>{if(document.visibilityState==='visible'&&!secret.current){const current=state.value;void fetchGift('',true).then(card=>{if(active&&current===state.value){setGift(card);setOpened(true)}}).catch(clear)}}
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
  return <main style={{minHeight:'100vh',background:'#0A0D14',padding:'12px 12px 88px',color:'#F3E5AB'}}>
    <div style={{maxWidth:720,margin:'0 auto',display:'grid',gap:12}}>
      <div style={{textAlign:'center'}}>
        <p style={{color:'#D4AF37',fontSize:12,letterSpacing:2}} >SUCCESS WISHES 2026</p>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:24,margin:'4px 0'}} >{gift?.sender ? `From ${gift.sender} to ${gift.candidate}` : gift ? `For ${gift.candidate}` : 'Your Success Card'}</h1>
        <p style={{fontSize:14,color:'#C3C7D1'}}>{!gift && !error ? 'Opening your card…' : ''}</p>
      </div>
      {busy&&<p role="status">Finding your gift…</p>}
      {error&&<div role="alert" style={{color:'#FCA5A5',textAlign:'center'}}><p>{error}</p><Link href="/success-wishes/inbox" style={{color:'#D4AF37'}}>Back to My wishes</Link></div>}
      {gift&&!busy&&<section aria-label="Your private Success Wish">
        <ReceiverEnvelope receiverView initiallyOpen template={gift.theme} values={{candidate:gift.candidate,school:gift.school,examYear:gift.examYear,sender:gift.sender||'',message:gift.message||''}}
          soundEnabled={soundEnabled} onOpen={play} beforeOpen={reveal} onOpenedChange={setOpened}/>
      </section>}
      {gift&&<p style={{fontSize:13,lineHeight:1.6,color:'#C3C7D1',textAlign:'center'}}>
        {opened?'Your wish is saved on this browser.':'Tap the card to read again.'}
        {' '}<Link href="/success-wishes/inbox">My wishes →</Link>
      </p>}
      {gift&&opened&&<DownloadSuccessCard gift={gift}/>}
      {gift&&opened&&<aside aria-label="Share the encouragement" style={{border:"1px solid #8B7440",borderRadius:14,padding:"16px 18px",background:"#121C2D",display:"grid",gap:10,textAlign:"center"}}><strong style={{color:"#F3E5AB",fontSize:16}}>Someone made you smile.</strong><p style={{margin:0,color:"#C3C7D1",fontSize:13}}>Make someone else smile too.</p><Link href="/success-wishes" style={{display:"inline-flex",justifyContent:"center",alignItems:"center",minHeight:44,padding:"10px 16px",borderRadius:9,background:"#E2C572",color:"#17140D",fontWeight:700,fontSize:14}}>Send a Success Card →</Link></aside>}
      {gift&&opened&&secret.current&&<KeepWish token={secret.current} candidate={gift.candidate}/>}
      {gift&&secret.current&&<GiftShareActions link={'https://vibeschool.co.ke/success-wishes/gift#token='+secret.current} candidate={gift.candidate} sender={gift.sender||undefined}/>}

    </div>
  </main>
}

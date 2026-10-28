'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import ReceiverEnvelope from '@/components/success-wishes/ReceiverEnvelope'
import { playWishRevealSound } from '@/lib/success-wishes/signature-sound'
import type { Template } from '@/components/success-wishes/SuccessCardStudio'

type Gift = {id:string;theme:Template;candidate:string;school:string;examYear:string;sender:string|null;message?:string}
async function fetchGift(token:string,reveal=false):Promise<Gift> {
  const response=await fetch('/api/success-wishes/gift',{method:reveal?'PUT':'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({token}),cache:'no-store'})
  const body=await response.json()
  if(!response.ok)throw Error(body.error||'This private gift is unavailable.')
  return body.card as Gift
}
export default function PrivateGiftPage(){
  const [gift,setGift]=useState<Gift|null>(null)
  const [busy,setBusy]=useState(true)
  const [error,setError]=useState('')
  const [soundEnabled,setSoundEnabled]=useState(true)
  const [opened,setOpened]=useState(false)
  const sound=useRef<(()=>void)|null>(null)
  const secret=useRef('')
  useEffect(()=>{
    let active=true
    const value=new URLSearchParams(window.location.hash.slice(1)).get('token')||''
    secret.current=value
    if(!/^[a-f0-9]{64}$/.test(value)){setError('Open the private gift link shared by the sender.');setBusy(false);return}
    void fetchGift(value).then(card=>{if(active)setGift(card)})
      .catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Gift unavailable.')})
      .finally(()=>{if(active)setBusy(false)})
    return()=>{active=false;sound.current?.()}
  },[])
  async function reveal(){
    try{
      const card=await fetchGift(secret.current,true)
      setGift(card);setError('')
      return true
    }catch(reason){setError(reason instanceof Error?reason.message:'The gift could not be opened.');return false}
  }
  function play(){sound.current?.();sound.current=playWishRevealSound()}
  const buttonStyle={background:'#111722',color:'#F3E5AB',border:'1px solid #D4AF37',borderRadius:9,padding:'10px 14px',cursor:'pointer'} as const
  return <main style={{minHeight:'100vh',background:'#0A0D14',padding:'32px 16px',color:'#F3E5AB'}}>
    <div style={{maxWidth:720,margin:'0 auto',display:'grid',gap:24}}>
      <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
        <Link href="/success-wishes" style={{color:'#F3E5AB',fontSize:14}}>VibeSchool · Success Wishes</Link>
        <button type="button" style={buttonStyle} onClick={()=>{setSoundEnabled(value=>!value);sound.current?.()}}
          aria-label={soundEnabled?'Mute card opening sound':'Turn card opening sound on'}
          aria-pressed={soundEnabled}>{soundEnabled?'Sound on':'Sound off'}</button>
      </header>
      <div style={{textAlign:'center'}}>
        <p style={{color:'#D4AF37',fontSize:12,letterSpacing:2}}>A PRIVATE SURPRISE</p>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:30,margin:'8px 0'}}>Someone believes in you.</h1>
        <p style={{fontSize:14,color:'#C3C7D1'}}>{gift?'A special Success Wish for '+gift.candidate:'Your gift is being opened privately.'}</p>
      </div>
      {busy&&<p role="status">Finding your gift…</p>}
      {error&&<p role="alert" style={{color:'#FCA5A5',textAlign:'center'}}>{error}</p>}
      {gift&&!busy&&<section aria-label="Your private Success Wish">
        <ReceiverEnvelope receiverView template={gift.theme} values={{candidate:gift.candidate,school:gift.school,examYear:gift.examYear,sender:gift.sender||'',message:gift.message||''}}
          soundEnabled={soundEnabled} onOpen={play} beforeOpen={reveal} onOpenedChange={setOpened}/>
      </section>}
      {gift&&<p style={{fontSize:13,lineHeight:1.6,color:'#C3C7D1',textAlign:'center'}}>
        {opened?'You can close and reopen your card.':'Tap the sealed card to read your message.'}
        {' '}Keep this private link to revisit your gift. Anyone with the link can open it.
      </p>}
      <nav style={{display:'flex',justifyContent:'center',gap:24,fontSize:14}}>
        <Link href="/success-wishes" style={{color:'#D4AF37'}}>Send a wish</Link>
        <Link href="/legal/privacy" style={{color:'#C3C7D1'}}>Privacy</Link>
      </nav>
    </div>
  </main>
}

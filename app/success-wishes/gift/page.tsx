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
  return <main className="min-h-screen bg-[#0A0D14] px-4 py-8 text-[#F3E5AB]">
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6">
      <header className="flex w-full items-center justify-between gap-3">
        <Link href="/success-wishes" className="text-sm text-[#F3E5AB] underline-offset-4 hover:underline">VibeSchool · Success Wishes</Link>
        <button type="button" onClick={()=>{setSoundEnabled(value=>!value);sound.current?.()}}
          className="rounded-lg border border-[#D4AF37]/40 px-3 py-2 text-xs"
          aria-label={soundEnabled?'Mute card opening sound':'Turn card opening sound on'}
          aria-pressed={soundEnabled}>{soundEnabled?'Sound on':'Sound off'}</button>
      </header>
      <div className="space-y-2 text-center"><p className="text-xs uppercase tracking-[.18em] text-[#D4AF37]">A private surprise</p>
        <h1 className="font-serif text-3xl font-semibold">Someone believes in you.</h1>
        <p className="text-sm text-slate-300">{gift?'A special Success Wish for '+gift.candidate:'Your gift is being opened privately.'}</p>
      </div>
      {busy&&<p role="status" className="text-sm text-slate-300">Finding your gift…</p>}
      {error&&<p role="alert" className="max-w-md text-center text-sm text-red-300">{error}</p>}
      {gift&&!busy&&<section aria-label="Your private Success Wish" className="w-full">
        <ReceiverEnvelope receiverView template={gift.theme} values={{candidate:gift.candidate,school:gift.school,examYear:gift.examYear,sender:gift.sender||'',message:gift.message||''}}
          soundEnabled={soundEnabled} onOpen={play} beforeOpen={reveal} onOpenedChange={setOpened}/>
      </section>}
      {gift&&<p className="max-w-md text-center text-xs leading-6 text-slate-400">
        {opened?'You can close and reopen your card.':'Tap the sealed card to read your message.'}
        {' '}Keep this private link to revisit your gift. Anyone with the link can open it.
      </p>}
      <div className="flex items-center gap-5 text-sm">
        <Link href="/success-wishes" className="text-[#D4AF37] underline-offset-4 hover:underline">Send a wish</Link>
        <Link href="/legal/privacy" className="text-slate-400 underline-offset-4 hover:underline">Privacy</Link>
      </div>
    </div>
  </main>
}

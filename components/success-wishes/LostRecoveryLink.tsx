'use client'
import { useState, type FormEvent } from 'react'
export default function LostRecoveryLink() {
  const [open,setOpen]=useState(false),[name,setName]=useState(''),[phone,setPhone]=useState(''),[year,setYear]=useState('2026')
  const [whatsAppUrl,setWhatsAppUrl]=useState('')
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')
  async function submit(event:FormEvent) {
    event.preventDefault(); if(busy)return
    setBusy(true);setError('');setMessage('');setWhatsAppUrl('')
    try {
      const response=await fetch('/api/success-wishes/receiver/lost-link',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,phone,examYear:year}),cache:'no-store'})
      const result=await response.json()
      if(!response.ok)throw Error(result.error||'Could not record your request.')
      setMessage('Your request has been recorded. Send the request to support on WhatsApp for review.');setWhatsAppUrl('https://wa.me/254728232257?text='+encodeURIComponent('Hello VibeSchool support. I have submitted a Success Wishes PIN recovery review request. Learner: '+name.trim()+'. Exam year: '+year+'. Phone used for wishes: '+phone.trim()+'. Please advise on identity verification.'))
    } catch(e) { setError(e instanceof Error?e.message:'Could not record your request.') }
    finally {setBusy(false)}
  }
  return <section style={{maxWidth:440,margin:'24px auto',padding:20,border:'1px solid #a6a6a6',borderRadius:16}}>
    <h2 style={{fontSize:20,fontWeight:700}}>Lost your recovery link?</h2>
    <p>Ask the original sender to resend your private card link first. If that is not possible, request support review. A name, phone number or PIN cannot unlock cards.</p>
    {!open?<button type="button" onClick={()=>setOpen(true)}>Request recovery review</button>:
    <form onSubmit={submit} style={{display:'grid',gap:12}}>
      <label>Learner name<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>
      <label>Phone used for the wishes<input required type="tel" value={phone} onChange={e=>setPhone(e.target.value)}/></label>
      <label>Exam year<input required pattern="20[0-9]{2}" maxLength={4} value={year} onChange={e=>setYear(e.target.value)}/></label>
      <button disabled={busy} type="submit">{busy?'Sending…':'Send review request'}</button>
    </form>}
    {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}{whatsAppUrl&&<a href={whatsAppUrl} target="_blank" rel="noopener noreferrer" style={{display:'inline-block',padding:'12px 16px',borderRadius:10,background:'#075e54',color:'#fff',fontWeight:600,marginTop:12}}>Request approval on WhatsApp</a>}
    <p>Nothing changes until authorized support independently verifies adult or guardian authority. No SMS required to submit.</p>
  </section>
}

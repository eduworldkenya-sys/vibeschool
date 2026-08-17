'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { TrackedLink } from '@/components/public/TrackedLink'
import { trackPublicEvent } from '@/lib/publicTelemetry'
import styles from './contact.module.css'

const WHATSAPP_NUMBER = '254728232157'
const TIKTOK_URL = 'https://www.tiktok.com/@vibeschoolkenya'
const enquiryTypes = [
  ['general','General question','I have a general question about VibeSchool.'],
  ['school','School / institution','I am contacting VibeSchool on behalf of a school or institution.'],
  ['government','Government / public sector','I would like to discuss VibeSchool from a government or public-sector perspective.'],
  ['partnership','Partnership / funding','I would like to discuss a partnership or funding conversation.'],
  ['career','Careers / talent','I am interested in future opportunities to work with VibeSchool.'],
] as const

export default function ContactPage() {
  const [category,setCategory]=useState('account')
  const [subject,setSubject]=useState('')
  const [message,setMessage]=useState('')
  const [enquiryType,setEnquiryType]=useState<(typeof enquiryTypes)[number][0]>('general')
  const [busy,setBusy]=useState(false)
  const [result,setResult]=useState<string|null>(null)
  const [ticketId,setTicketId]=useState<string|null>(null)

  const whatsappUrl = useMemo(()=>{
    const selected=enquiryTypes.find(([key])=>key===enquiryType) ?? enquiryTypes[0]
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hello VibeSchool. ${selected[2]}\n\nMy question: `)}`
  },[enquiryType])

  async function submit(e:FormEvent){
    e.preventDefault();setResult(null);setTicketId(null);setBusy(true)
    try{
      const{data:{user}}=await supabase.auth.getUser()
      if(!user){setResult('Sign in first for account-specific support. For a general enquiry, use WhatsApp above.');return}
      if(subject.trim().length<3||message.trim().length<10){setResult('Please give us a clear subject and enough detail to understand what happened.');return}
      const{data:caseId,error}=await supabase.rpc('submit_contact_request',{p_category:category,p_subject:subject.trim(),p_message:message.trim()})
      if(error){setResult("We couldn't send your request right now. Please try again.");return}
      trackPublicEvent('public_contact_support_submit','/contact')
      setSubject('');setMessage('');setTicketId(String(caseId));setResult('Received. Your request has been recorded for support follow-up.')
    }finally{setBusy(false)}
  }

  return <div className={styles.page}><PublicHeader product="Contact"/><main id="main-content">
    <section className={styles.hero}><div className={styles.heroInner}><p className={styles.eyebrow}>CONTACT VIBESCHOOL</p><h1>Tell us what you need.</h1><p>Questions do not need technical language. Choose the closest reason for contacting us, then start the conversation.</p><div className={styles.heroActions}><TrackedLink className={styles.whatsapp} href={whatsappUrl} event="public_contact_whatsapp" external target="_blank" rel="noopener noreferrer">Chat on WhatsApp</TrackedLink><span>0728 232 157</span></div></div></section>

    <section className={styles.paths}>
      <article className={styles.pathCard}><span>GENERAL ENQUIRIES</span><h2>No account needed.</h2><p>Choose what best describes you. The WhatsApp message will start with enough context so you do not need to explain VibeSchool’s contact form first.</p><label style={{display:'grid',gap:8,marginTop:16,fontWeight:800,fontSize:13}}>I am contacting VibeSchool about<select value={enquiryType} onChange={e=>setEnquiryType(e.target.value as typeof enquiryType)} style={{minHeight:46,border:'1px solid #d8dbe3',borderRadius:10,padding:'0 12px',background:'#fff'}}>{enquiryTypes.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><TrackedLink href={whatsappUrl} event={enquiryType==='school'||enquiryType==='government'||enquiryType==='partnership'?'public_institution_contact':enquiryType==='career'?'public_careers_interest':'public_contact_whatsapp'} external target="_blank" rel="noopener noreferrer">Open WhatsApp →</TrackedLink></article>
      <article className={styles.pathCard}><span>ACCOUNT SUPPORT</span><h2>Use your signed-in identity.</h2><p>For login, school access, learner access, privacy or technical issues tied to an account, sign in and submit a support request below. This avoids asking you to prove account identity over public WhatsApp.</p><Link href="/login/global">Sign in →</Link></article>
    </section>

    <section className={styles.supportSection}><div className={styles.supportIntro}><p className={styles.eyebrowDark}>ACCOUNT-SPECIFIC SUPPORT</p><h2>Send a support request.</h2><p>Requests are attached to your authenticated VibeSchool identity so support can investigate the correct account without asking you to disclose sensitive credentials.</p><p className={styles.safety}>Never include passwords, one-time codes or payment credentials.</p></div><form className={styles.form} onSubmit={submit}>
      <label>Issue category<select value={category} onChange={e=>setCategory(e.target.value)}><option value="account">Account / login</option><option value="school_access">School access</option><option value="student_access">Student access</option><option value="technical">Technical problem</option><option value="privacy">Privacy</option><option value="legal">Legal</option><option value="safety">Safety / safeguarding</option><option value="other">Something else</option></select></label>
      <label>Subject<input value={subject} onChange={e=>setSubject(e.target.value)} maxLength={160} minLength={3} required placeholder="For example: I cannot access my teacher dashboard"/></label>
      <label>What happened?<textarea value={message} onChange={e=>setMessage(e.target.value)} maxLength={5000} minLength={10} required rows={7} placeholder="What were you trying to do? What did you expect? What happened instead?"/></label>
      <p className={styles.helper}>The page you were on, your role and the exact error message can help us investigate faster. Do not include secrets.</p>
      {result&&<div role="status" aria-live="polite" className={styles.result}>{result}{ticketId&&<div><strong>Reference:</strong> {ticketId}</div>}</div>}
      <button type="submit" disabled={busy}>{busy?'Sending…':'Send support request'}</button>
    </form></section>

    <section className={styles.socialSection}><div><p className={styles.eyebrowDark}>FOLLOW VIBESCHOOL</p><h2>Find us where people already spend time.</h2><p>We only show channels that are active and genuinely belong to VibeSchool.</p></div><div className={styles.socialLinks}><a href={TIKTOK_URL} target="_blank" rel="noopener noreferrer"><strong>TikTok</strong><span>@vibeschoolkenya</span></a><TrackedLink href={whatsappUrl} event="public_contact_whatsapp" external target="_blank" rel="noopener noreferrer"><strong>WhatsApp</strong><span>0728 232 157</span></TrackedLink></div></section>
  </main><PublicFooter/></div>
}

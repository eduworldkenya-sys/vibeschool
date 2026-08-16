"use client"

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [message, setMessage] = useState('')

  async function submit() {
    if (busy || !email.trim()) return
    setBusy(true)
    setMessage('')
    const redirectTo = `${window.location.origin}/auth/callback?intent=recovery`
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
    setBusy(false)
    if (error) {
      setMessage('We could not start password recovery. Please try again.')
      return
    }
    // Same response regardless of whether an account exists.
    setSent(true)
  }

  return <main style={{minHeight:'100dvh',background:'#05050f',color:'#fff',display:'grid',placeItems:'center',padding:24}}>
    <section style={{width:'100%',maxWidth:420}}>
      <Link href="/" style={{color:'#fff',textDecoration:'none',fontSize:28,fontWeight:800}}>Vibe<span style={{color:'#c8a84b'}}>School</span></Link>
      <h1 style={{fontSize:34,margin:'28px 0 10px'}}>Reset your password</h1>
      <p style={{color:'rgba(255,255,255,.6)',lineHeight:1.6}}>Enter your account email. If it is registered, we will send a secure recovery link.</p>
      {sent ? <p role="status" style={{padding:14,borderRadius:9,background:'rgba(80,200,120,.12)'}}>Check your email for the recovery link.</p> : <>
        {message && <p role="alert" style={{padding:14,borderRadius:9,background:'rgba(255,80,80,.1)'}}>{message}</p>}
        <label style={{display:'block',margin:'20px 0 7px',fontSize:12}}>Email</label>
        <input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>{if(e.key==='Enter') void submit()}} style={{width:'100%',boxSizing:'border-box',padding:13,borderRadius:9,border:'1px solid rgba(255,255,255,.16)',background:'#0c0c1d',color:'#fff'}} />
        <button disabled={busy || !email.trim()} onClick={()=>void submit()} style={{width:'100%',marginTop:18,padding:13,border:0,borderRadius:9,background:'#c8a84b',fontWeight:800}}>{busy?'Sending…':'Send recovery link'}</button>
      </>}
      <p style={{marginTop:22,fontSize:12}}><Link href="/login" style={{color:'#c8a84b'}}>Back to sign in</Link></p>
    </section>
  </main>
}

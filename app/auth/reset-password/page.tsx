"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit() {
    if (busy) return
    setMessage('')
    if (password.length < 8) { setMessage('Use at least 8 characters.'); return }
    if (password !== confirm) { setMessage('Passwords do not match.'); return }
    setBusy(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/auth/error?reason=recovery_session_missing')
      return
    }
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setBusy(false)
      setMessage('Your password could not be changed. Start recovery again if the link expired.')
      return
    }
    await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' })
    try { localStorage.removeItem('vs_role') } catch {}
    router.replace('/login?password_reset=success')
  }

  return <main style={{minHeight:'100dvh',background:'#05050f',color:'#fff',display:'grid',placeItems:'center',padding:24}}>
    <section style={{width:'100%',maxWidth:420}}>
      <Link href="/" style={{color:'#fff',textDecoration:'none',fontSize:28,fontWeight:800}}>Vibe<span style={{color:'#c8a84b'}}>School</span></Link>
      <h1 style={{fontSize:34,margin:'28px 0 10px'}}>Choose a new password</h1>
      <p style={{color:'rgba(255,255,255,.6)'}}>This page only works with a valid recovery session.</p>
      {message && <p role="alert" style={{padding:14,borderRadius:9,background:'rgba(255,80,80,.1)'}}>{message}</p>}
      <label style={{display:'block',margin:'18px 0 7px',fontSize:12}}>New password</label>
      <input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} style={{width:'100%',boxSizing:'border-box',padding:13,borderRadius:9,border:'1px solid rgba(255,255,255,.16)',background:'#0c0c1d',color:'#fff'}} />
      <label style={{display:'block',margin:'18px 0 7px',fontSize:12}}>Confirm password</label>
      <input type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} onKeyDown={e=>{if(e.key==='Enter') void submit()}} style={{width:'100%',boxSizing:'border-box',padding:13,borderRadius:9,border:'1px solid rgba(255,255,255,.16)',background:'#0c0c1d',color:'#fff'}} />
      <button disabled={busy} onClick={()=>void submit()} style={{width:'100%',marginTop:20,padding:13,border:0,borderRadius:9,background:'#c8a84b',fontWeight:800}}>{busy?'Updating…':'Update password'}</button>
    </section>
  </main>
}

"use client"
export const dynamic = "force-dynamic"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function AccountResetPasswordPage() {
  const router = useRouter()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [show, setShow] = useState(false)
  const [checking, setChecking] = useState(true)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  const checks = useMemo(() => ({
    length: password.length >= 12,
    letter: /[A-Za-z]/.test(password),
    number: /\d/.test(password),
    match: password.length > 0 && password === confirm,
  }), [password, confirm])
  const valid = checks.length && checks.letter && checks.number && checks.match

  useEffect(() => {
    let alive = true

    async function establish() {
      setChecking(true)
      setError("")
      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get("code")
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) throw exchangeError
          url.searchParams.delete("code")
          url.searchParams.delete("sb_flow_id")
          window.history.replaceState({}, "", `${url.pathname}${url.search}`)
        } else if (window.location.hash) {
          const hash = new URLSearchParams(window.location.hash.slice(1))
          const accessToken = hash.get("access_token")
          const refreshToken = hash.get("refresh_token")
          const type = hash.get("type")
          if (type === "recovery" && accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
            if (sessionError) throw sessionError
            window.history.replaceState({}, "", `${url.pathname}${url.search}`)
          }
        }

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) throw userError ?? new Error("Recovery session unavailable")
        if (alive) setReady(true)
      } catch {
        if (alive) {
          setReady(false)
          setError("This recovery link is invalid, expired, or already used. Request a new password reset email.")
        }
      } finally {
        if (alive) setChecking(false)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (alive && event === "PASSWORD_RECOVERY" && session?.user) {
        setReady(true)
        setChecking(false)
        setError("")
      }
    })

    void establish()
    return () => {
      alive = false
      subscription.unsubscribe()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  async function reset() {
    setError("")
    if (!ready) return setError("A valid recovery session is required.")
    if (!valid) return setError("Use at least 12 characters with letters and a number, and make sure both passwords match.")
    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setLoading(false)
      setError("Password could not be changed. Request a new recovery email and try again.")
      return
    }

    await supabase.auth.signOut()
    document.cookie = "vibe_role=; path=/; max-age=0"
    localStorage.removeItem("vs_role")
    setLoading(false)
    setReady(false)
    setDone(true)
    timer.current = setTimeout(() => router.replace("/?reset=success"), 1200)
  }

  const field: React.CSSProperties = { width:"100%",boxSizing:"border-box",padding:"13px 14px",borderRadius:12,border:"1px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.05)",color:"#fff",fontSize:15,outline:"none" }

  return <main style={{minHeight:"100dvh",display:"grid",placeItems:"center",padding:"24px 16px",background:"radial-gradient(circle at top,#10233d 0,#07111f 48%,#040a12 100%)",color:"#f8fafc",fontFamily:"Inter,system-ui,sans-serif"}}>
    <section style={{width:"100%",maxWidth:440,padding:"clamp(22px,6vw,34px)",borderRadius:24,border:"1px solid rgba(255,255,255,.1)",background:"rgba(7,17,31,.9)"}}>
      <div style={{fontSize:11,fontWeight:900,letterSpacing:".12em",textTransform:"uppercase",color:"#34d399",marginBottom:8}}>VibeSchool Security</div>
      <h1 style={{margin:"0 0 7px",fontSize:"clamp(26px,7vw,33px)",letterSpacing:"-.03em"}}>Set a new password</h1>
      <p style={{margin:"0 0 22px",fontSize:13,lineHeight:1.6,color:"rgba(255,255,255,.52)"}}>This recovery page works for VibeSchool product accounts. Your password is never shown to administrators.</p>

      {checking && <div role="status" style={{padding:12,borderRadius:11,marginBottom:16,background:"rgba(96,165,250,.08)",color:"#bfdbfe"}}>Verifying recovery link…</div>}
      {error && <div role="alert" style={{padding:12,borderRadius:11,marginBottom:16,background:"rgba(239,68,68,.1)",color:"#fecaca",fontSize:12,lineHeight:1.5}}>{error}</div>}
      {done ? <div role="status" style={{padding:14,borderRadius:12,background:"rgba(52,211,153,.08)",color:"#bbf7d0",fontSize:13}}>Password updated. Your recovery session has been closed. Returning to sign in…</div> : <>
        <label htmlFor="account-new-password" style={{fontSize:11,fontWeight:800,color:"rgba(255,255,255,.62)"}}>New password</label>
        <input id="account-new-password" type={show?"text":"password"} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} disabled={!ready||loading} style={{...field,marginTop:7,marginBottom:14}}/>
        <label htmlFor="account-confirm-password" style={{fontSize:11,fontWeight:800,color:"rgba(255,255,255,.62)"}}>Confirm new password</label>
        <input id="account-confirm-password" type={show?"text":"password"} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} disabled={!ready||loading} style={{...field,marginTop:7,marginBottom:12}}/>
        <button type="button" onClick={()=>setShow(v=>!v)} disabled={!ready||loading} style={{border:0,background:"transparent",color:"#93c5fd",fontSize:11,fontWeight:800,padding:"4px 0",marginBottom:15,cursor:"pointer"}}>{show?"Hide passwords":"Show passwords"}</button>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:7,marginBottom:18}}>{[[checks.length,"12+ characters"],[checks.letter,"Contains letters"],[checks.number,"Contains a number"],[checks.match,"Passwords match"]].map(([ok,label])=><div key={String(label)} style={{padding:"8px 9px",borderRadius:9,border:"1px solid rgba(255,255,255,.08)",fontSize:10.5,color:ok?"#a7f3d0":"rgba(255,255,255,.4)"}}>{ok?"✓":"○"} {String(label)}</div>)}</div>
        <button type="button" onClick={()=>void reset()} disabled={!ready||!valid||loading} style={{width:"100%",padding:14,border:0,borderRadius:12,background:!ready||!valid||loading?"rgba(16,185,129,.35)":"#10b981",color:"#03120c",fontWeight:900,cursor:loading?"wait":"pointer"}}>{loading?"Updating password…":"Set new password"}</button>
      </>}
    </section>
  </main>
}

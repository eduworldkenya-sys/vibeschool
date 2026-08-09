"use client"
export const dynamic = "force-dynamic"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { hqSupabase } from "@/lib/hq/supabase"

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  marginTop: 7,
  padding: "13px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.12)",
  background: "rgba(255,255,255,.05)",
  color: "white",
  fontSize: 15,
  outline: "none",
}

export default function HQResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)

  const checks = useMemo(() => ({
    length: password.length >= 12,
    letter: /[A-Za-z]/.test(password),
    number: /\d/.test(password),
    match: password.length > 0 && password === confirmPassword,
  }), [password, confirmPassword])
  const validPassword = checks.length && checks.letter && checks.number && checks.match

  useEffect(() => {
    let mounted = true

    async function establishRecoverySession() {
      setChecking(true)
      setError("")

      try {
        const code = searchParams.get("code")
        if (code) {
          const { error: exchangeError } = await hqSupabase.auth.exchangeCodeForSession(code)
          if (exchangeError) throw exchangeError
          const cleanUrl = new URL(window.location.href)
          cleanUrl.searchParams.delete("code")
          cleanUrl.searchParams.delete("sb_flow_id")
          window.history.replaceState({}, "", `${cleanUrl.pathname}${cleanUrl.search}`)
        } else if (window.location.hash) {
          const hash = new URLSearchParams(window.location.hash.slice(1))
          const accessToken = hash.get("access_token")
          const refreshToken = hash.get("refresh_token")
          const type = hash.get("type")
          if (type === "recovery" && accessToken && refreshToken) {
            const { error: sessionError } = await hqSupabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            if (sessionError) throw sessionError
            const cleanUrl = new URL(window.location.href)
            window.history.replaceState({}, "", `${cleanUrl.pathname}${cleanUrl.search}`)
          }
        }

        const { data, error: userError } = await hqSupabase.auth.getUser()
        if (!mounted) return
        if (userError || !data.user) {
          setReady(false)
          setError("This recovery link is invalid, expired, or already used. Request a new recovery link from HQ login.")
          return
        }

        const { data: access, error: accessError } = await hqSupabase.rpc("hq_check_owner_access", { p_surface: "/hq/reset-password:recovery-session" })
        const allowed = !accessError && Boolean((access as { allowed?: boolean } | null)?.allowed)
        if (!allowed) {
          await hqSupabase.auth.signOut({ scope: "local" })
          setReady(false)
          setError("This recovery session does not belong to an authorized VibeSchool HQ owner.")
          return
        }

        setReady(true)
      } catch {
        if (!mounted) return
        setReady(false)
        setError("The recovery link could not be verified. Request a new recovery email from HQ login.")
      } finally {
        if (mounted) setChecking(false)
      }
    }

    const { data: listener } = hqSupabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === "PASSWORD_RECOVERY" && session?.user) {
        void establishRecoverySession()
      }
    })

    void establishRecoverySession()

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [searchParams])

  async function handleReset() {
    setError("")
    setSuccess("")
    if (!ready) return setError("A valid owner recovery session is required.")
    if (!checks.length) return setError("Use at least 12 characters for the new password.")
    if (!checks.letter || !checks.number) return setError("Use a password containing both letters and numbers.")
    if (!checks.match) return setError("Passwords do not match.")

    setLoading(true)
    try {
      const { data: access, error: accessError } = await hqSupabase.rpc("hq_check_owner_access", { p_surface: "/hq/reset-password:before-password-change" })
      const allowed = !accessError && Boolean((access as { allowed?: boolean } | null)?.allowed)
      if (!allowed) throw new Error("HQ owner authority could not be verified.")

      const { error: updateError } = await hqSupabase.auth.updateUser({ password })
      if (updateError) throw updateError

      await hqSupabase.auth.signOut({ scope: "local" })

      setReady(false)
      setPassword("")
      setConfirmPassword("")
      setSuccess("Password updated successfully. Sign in to HQ with your new password.")
      window.setTimeout(() => router.replace("/hq/login?reset=success"), 900)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Password could not be changed.")
      setLoading(false)
    }
  }

  const disabled = checking || !ready || loading || Boolean(success)

  return <main style={{minHeight:"100dvh",display:"grid",placeItems:"center",background:"radial-gradient(circle at top,#10233d 0,#07111f 46%,#040a12 100%)",color:"#f8fafc",padding:"24px 16px",fontFamily:"Inter,system-ui,sans-serif"}}>
    <section style={{width:"100%",maxWidth:440,border:"1px solid rgba(255,255,255,.1)",borderRadius:24,padding:"clamp(22px,6vw,34px)",background:"rgba(7,17,31,.88)",boxShadow:"0 24px 80px rgba(0,0,0,.28)",backdropFilter:"blur(18px)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:22}}>
        <div aria-hidden="true" style={{width:38,height:38,borderRadius:12,display:"grid",placeItems:"center",background:"rgba(16,185,129,.12)",border:"1px solid rgba(52,211,153,.22)",color:"#6ee7b7",fontWeight:950}}>↺</div>
        <div><div style={{fontSize:10.5,fontWeight:950,letterSpacing:".13em",color:"#34d399",textTransform:"uppercase"}}>Secure recovery</div><div style={{fontSize:12,color:"rgba(255,255,255,.42)",marginTop:2}}>Isolated HQ authentication reset</div></div>
      </div>

      <h1 style={{fontSize:"clamp(27px,7vw,34px)",letterSpacing:"-.03em",margin:"0 0 7px"}}>Create a new password</h1>
      <p style={{fontSize:13,lineHeight:1.6,color:"rgba(255,255,255,.52)",margin:"0 0 23px"}}>The recovery link establishes a temporary HQ-only recovery session. Platform-owner authority is independently verified before the password can change.</p>

      {checking && <div role="status" style={{padding:12,borderRadius:11,marginBottom:16,background:"rgba(96,165,250,.08)",border:"1px solid rgba(96,165,250,.22)",color:"#bfdbfe",fontSize:12}}>Verifying secure recovery link…</div>}
      {error && <div role="alert" aria-live="assertive" style={{padding:12,borderRadius:11,marginBottom:16,background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.25)",color:"#fecaca",fontSize:12,lineHeight:1.55}}>{error}</div>}
      {success && <div role="status" aria-live="polite" style={{padding:12,borderRadius:11,marginBottom:16,background:"rgba(52,211,153,.08)",border:"1px solid rgba(52,211,153,.25)",color:"#bbf7d0",fontSize:12,lineHeight:1.55}}>{success}</div>}

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}><label htmlFor="new-password" style={{fontSize:11,fontWeight:800,color:"rgba(255,255,255,.62)"}}>New password</label><button type="button" onClick={()=>setShowPassword(v=>!v)} disabled={disabled} style={{border:0,background:"transparent",padding:0,color:"#93c5fd",fontSize:10.5,fontWeight:800,cursor:disabled?"default":"pointer"}}>{showPassword?"Hide":"Show"}</button></div>
      <input id="new-password" value={password} onChange={e=>setPassword(e.target.value)} type={showPassword?"text":"password"} autoComplete="new-password" minLength={12} disabled={disabled} style={{...inputStyle,marginBottom:14,opacity:disabled?.58:1}} />

      <label htmlFor="confirm-password" style={{fontSize:11,fontWeight:800,color:"rgba(255,255,255,.62)"}}>Confirm new password</label>
      <input id="confirm-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!disabled&&validPassword) void handleReset()}} type={showPassword?"text":"password"} autoComplete="new-password" minLength={12} disabled={disabled} style={{...inputStyle,marginBottom:14,opacity:disabled?.58:1}} />

      <div aria-label="Password requirements" style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginBottom:21}}>
        {[ [checks.length,"12+ characters"], [checks.letter,"Contains letters"], [checks.number,"Contains a number"], [checks.match,"Passwords match"] ].map(([ok,label])=><div key={String(label)} style={{padding:"8px 9px",borderRadius:9,border:`1px solid ${ok?"rgba(52,211,153,.22)":"rgba(255,255,255,.08)"}`,background:ok?"rgba(52,211,153,.07)":"rgba(255,255,255,.025)",color:ok?"#a7f3d0":"rgba(255,255,255,.4)",fontSize:10.5,fontWeight:750}}>{ok?"✓":"○"} {String(label)}</div>)}</div>

      <button disabled={disabled || !validPassword} onClick={()=>void handleReset()} style={{width:"100%",padding:14,border:"1px solid rgba(16,185,129,.35)",borderRadius:12,background:disabled||!validPassword?"rgba(16,185,129,.32)":"#10b981",color:disabled||!validPassword?"rgba(3,18,12,.55)":"#03120c",fontWeight:950,fontSize:13.5,cursor:loading?"wait":disabled||!validPassword?"not-allowed":"pointer",boxShadow:disabled||!validPassword?"none":"0 12px 30px rgba(16,185,129,.13)"}}>{loading?"Updating password…":"Set new password"}</button>

      <button type="button" onClick={()=>router.replace("/hq/login")} style={{width:"100%",marginTop:10,padding:11,border:0,background:"transparent",color:"rgba(255,255,255,.52)",fontWeight:800,cursor:"pointer"}}>{ready?"Cancel and return to HQ login":"Request a new recovery link"}</button>
      <div style={{marginTop:16,paddingTop:16,borderTop:"1px solid rgba(255,255,255,.07)",fontSize:10.5,lineHeight:1.55,color:"rgba(255,255,255,.35)"}}>Use the newest recovery email. Recovery links are short-lived and single-use.</div>
    </section>
  </main>
}

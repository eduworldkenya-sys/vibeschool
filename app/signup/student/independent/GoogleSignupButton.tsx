'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function GoogleSignupButton() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function start() {
    setBusy(true)
    setError('')
    try {
      const callback = new URL('/auth/callback', window.location.origin)
      callback.searchParams.set('intent', 'signup')
      callback.searchParams.set('role', 'student')
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callback.toString() },
      })
      if (signInError) throw signInError
    } catch {
      setError('Google sign-in could not start. Try again.')
      setBusy(false)
    }
  }

  return <>
    <button type="button" disabled={busy} onClick={() => void start()}>
      {busy ? 'Opening Google…' : 'Continue with Google'}
    </button>
    {error && <p role="alert">{error}</p>}
  </>
}

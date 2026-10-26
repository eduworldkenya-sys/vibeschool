'use client'

import { useState } from 'react'
import { HQPanel, HQ_THEME, hqButtonStyle } from '@/components/hq/HQShell'
import { hqSupabase } from '@/lib/hq/supabase'

type Diagnostic = {
  oauthVerified?: boolean
  providerHttpStatus?: number
  reason?: string
  stkSent?: boolean
  destination?: { shortcode?: string; till?: string; transactionType?: string; environment?: string }
}

export default function SuccessWishesPaymentReadiness() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)

  async function checkConnection() {
    if (busy) return
    setBusy(true)
    setSuccess(false)
    setMessage('')
    try {
      const { data, error } = await hqSupabase.auth.getSession()
      const token = data.session?.access_token
      if (error || !token) throw new Error('Sign in to VibeSchool HQ again to check the connection.')
      const response = await fetch('/api/success-wishes/mpesa-readiness', {
        method: 'GET', cache: 'no-store',
        headers: { Authorization: 'Bearer ' + token },
      })
      const result: Diagnostic = await response.json()
      if (response.status === 403) {
        throw new Error('An active VibeSchool HQ founder account is required.')
      }
      if (response.status === 200 && result.oauthVerified === true && result.stkSent === false) {
        setSuccess(true)
        setMessage('Safaricom production OAuth accepted these credentials. No payment was sent. STK passkey, callback settlement and card delivery are still unverified.')
      } else if (result.reason === 'configuration_incomplete_or_destination_mismatch') {
        throw new Error('One or more production credentials or merchant settings are missing or mismatched. No payment was sent.')
      } else {
        throw new Error('Safaricom OAuth was not verified' +
          (result.providerHttpStatus ? ' (provider HTTP ' + result.providerHttpStatus + ')' : '') +
          '. No payment was sent.')
      }
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'The read-only payment check could not complete.')
    } finally {
      setBusy(false)
    }
  }

  return <HQPanel title="Production M-Pesa connection"
    description="Read-only Safaricom authentication check for Success Wishes. This never sends an STK prompt or enables customer checkout.">
    <button type="button" style={hqButtonStyle} disabled={busy} onClick={() => void checkConnection()}>
      {busy ? 'Checking Safaricom…' : 'Check Daraja connection'}
    </button>
    {message && <p role={success ? 'status' : 'alert'}
      style={{ marginTop: 12, color: success ? HQ_THEME.green : HQ_THEME.amber, fontSize: 14 }}>
      {message}
    </p>}
  </HQPanel>
}

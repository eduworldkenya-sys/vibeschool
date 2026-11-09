import { NextRequest, NextResponse } from 'next/server'
import { emailPilotEnabled } from '../config'
import { finishPilotSignup, pilotClient } from '../server'

export async function GET(request: NextRequest) {
  const destination = new URL('/signup/student/email', request.url)
  let verified = false
  const code = request.nextUrl.searchParams.get('code')
  if (code && emailPilotEnabled()) {
    try {
      const { client, commit } = pilotClient()
      const { data, error } = await client.auth.exchangeCodeForSession(code)
      if (!error && data.session && data.user && await finishPilotSignup(client, data.user)) {
        commit()
        verified = true
      }
    } catch {
      // Return to the recovery form if the link has expired or setup failed.
    }
  }
  if (!verified) destination.searchParams.set('link', 'retry')
  return NextResponse.redirect(destination, { headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } })
}

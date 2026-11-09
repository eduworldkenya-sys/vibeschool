'use server'

import { emailPilotEnabled, pilotEmail } from './config'
import { canUsePilot, finishPilotSignup, hasRestrictedIdentity, pilotClient, pilotAdminClient } from './server'

const unavailable = 'Email signup is unavailable for this address.'
const retry = 'Could not connect. Try again.'

export async function sendLearnerEmail(form: FormData) {
  const email = pilotEmail(form.get('email'))
  if (!email) return { error: unavailable }
  try {
    const { client, commit } = pilotClient()
    const emailRedirectTo = new URL('/signup/student/email/confirm', process.env.NEXT_PUBLIC_SITE_URL || 'https://vibeschool.co.ke').href
    const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo } })
    if (error) return { error: 'Could not send a verification email. Wait a moment and try again.' }
    commit()
    return { email }
  } catch {
    return { error: retry }
  }
}

export async function verifyLearnerEmail(form: FormData) {
  const email = pilotEmail(form.get('email'))
  const token = form.get('code')
  if (!email) return { error: unavailable }
  if (typeof token !== 'string' || !/^\d{6}$/.test(token)) return { error: 'Enter the six-digit code.' }

  try {
    const { client, commit } = pilotClient()
    const { data, error } = await client.auth.verifyOtp({ email, token, type: 'email' })
    if (error || !data.user || !data.session) return { error: 'That code is invalid or expired. Try again or request a new code.' }
    if (pilotEmail(data.user.email) !== email || !await finishPilotSignup(client, data.user)) {
      return { error: 'Could not finish signup. Check the email address and try a new code.' }
    }

    commit()
    return { signedIn: true }
  } catch {
    return { error: retry }
  }
}

export async function checkLearnerEmailSession() {
  if (!emailPilotEnabled()) return false
  try {
    const { client, commit } = pilotClient()
    const { data: { user }, error } = await client.auth.getUser()
    if (error || !user || !await canUsePilot(client, user) || !await hasRestrictedIdentity(user.id)) return false
    commit()
    return true
  } catch {
    return false
  }
}

export async function signOutLearnerEmail() {
  const { client, commit } = pilotClient()
  const { error } = await client.auth.signOut({ scope: 'local' })
  if (error) return { error: 'Could not sign out. Try again.' }
  commit()
  return { signedOut: true }
}

export async function saveIndependentEmailGrade(form: FormData) {
  const grade = form.get('grade')
  if (typeof grade !== 'string' || !/^(Grade (?:[1-9]|1[0-2])|Form [1-4])$/.test(grade)) return { error: 'Choose your grade.' }
  try {
    const { client, commit } = pilotClient()
    const { data: { user }, error } = await client.auth.getUser()
    if (error || !user || !await canUsePilot(client, user) || !await hasRestrictedIdentity(user.id)) {
      return { error: 'Sign in with your verified email first.' }
    }
    const { error: writeError } = await pilotAdminClient().from('independent_learner_identities')
      .update({ grade_label: grade, updated_at: new Date().toISOString() }).eq('user_id', user.id)
    if (writeError) return { error: 'Could not save your grade.' }
    commit()
    return { saved: true }
  } catch {
    return { error: 'Could not save your grade. Try again.' }
  }
}

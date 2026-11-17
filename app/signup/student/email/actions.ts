'use server'

import { emailPilotEnabled, pilotEmail } from './config'
import { resolveRegistrationLearningSelection } from '@/lib/learner/learning-levels'
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
  const selection = resolveRegistrationLearningSelection(form.get('level'), form.get('choice'))
  if (!selection) return { error: 'Choose a valid learning level and programme.' }
  try {
    const { client, commit } = pilotClient()
    const { data: { user }, error } = await client.auth.getUser()
    if (error || !user || !await canUsePilot(client, user) || !await hasRestrictedIdentity(user.id)) {
      return { error: 'Sign in with your verified email first.' }
    }
    const admin = pilotAdminClient()
    const { data: identity, error: identityError } = await admin.from('independent_learner_identities')
      .select('grade_label').eq('user_id', user.id).maybeSingle()
    const { data: existingPath, error: pathError } = await client.from('learner_education_paths')
      .select('education_stage,programme_family,qualification_code').eq('user_id', user.id).maybeSingle()
    if (identityError || !identity || pathError) return { error: 'Could not check your study pathway.' }
    if (existingPath && (!selection.pathway || existingPath.education_stage !== 'post_secondary' ||
      existingPath.programme_family !== selection.pathway.programme_family ||
      existingPath.qualification_code !== selection.pathway.qualification_code)) {
      return { error: 'Your existing study pathway must be changed in your profile.' }
    }
    const restoreGrade = async () => {
      await admin.from('independent_learner_identities')
        .update({ grade_label: identity.grade_label, updated_at: new Date().toISOString() })
        .eq('user_id', user.id).eq('grade_label', selection.gradeLabel)
    }
    const { error: writeError } = await admin.from('independent_learner_identities')
      .update({ grade_label: selection.gradeLabel, updated_at: new Date().toISOString() }).eq('user_id', user.id)
    if (writeError) return { error: 'Could not save your learning level.' }
    const { data: studentId, error: studentError } = await admin.rpc('ensure_independent_learner_student', { p_user_id: user.id })
    if (studentError || !studentId) {
      await restoreGrade()
      return { error: 'Could not prepare your learner profile.' }
    }
    if (selection.pathway && !existingPath) {
      const { error: pathwayError } = await client.from('learner_education_paths').insert({
        user_id:user.id,education_stage:'post_secondary',...selection.pathway,
      })
      if (pathwayError) {
        await restoreGrade()
        return { error: 'Could not save your study pathway.' }
      }
    }
    commit()
    return { saved: true, destination: selection.pathway ? '/student/college' : '/student' }
  } catch {
    return { error: 'Could not save your learning level. Try again.' }
  }
}

import { createHash, randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const CONSENT_VERSION = 'learner-consent-2026-11-v1'
export const CONSENT_PURPOSE = 'personal_learning'

export function consentEnabled(): boolean {
  return process.env.LEARNER_GUARDIAN_CONSENT_ENABLED === 'true'
    && Boolean(process.env.LEARNER_CONSENT_RESEND_API_KEY)
    && Boolean(process.env.LEARNER_CONSENT_EMAIL_FROM)
}

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' },
  })
}

export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Backend authentication unavailable')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export type Admin = ReturnType<typeof adminClient>

export async function actor(req: NextRequest, admin: Admin, required: 'student' | 'parent') {
  const authorization = req.headers.get('authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) return null
  const bearer = authorization.slice(7).trim()
  if (!bearer) return null
  const { data: { user }, error } = await admin.auth.getUser(bearer)
  if (error || !user || (required === 'parent' && !user.email_confirmed_at)) return null
  const { data: profile, error: profileError } = await admin.from('profiles')
    .select('role, account_status, is_anonymized')
    .eq('id', user.id).maybeSingle()
  if (profileError || profile?.role !== required ||
      profile.is_anonymized || profile.account_status === 'restricted') return null
  return user
}

export function validEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const e = value.trim().toLowerCase()
  if (e.length > 254 || e.includes('..') ||
      !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(e)) return null
  return e
}

export function createToken() {
  return randomBytes(32).toString('base64url')
}
export function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
export function readToken(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null
}

export async function recordEvent(admin: Admin, requestId: string, kind: string, method: string, actorId: string | null = null) {
  const { error } = await admin.from('learner_guardian_consent_events').insert({
    request_id: requestId, event_type: kind, method,
    policy_version: CONSENT_VERSION, actor_user_id: actorId,
  })
  if (error) throw new Error('Could not record the consent event')
}

export async function sendConsentEmail(email: string, subject: string, body: string) {
  if (!consentEnabled()) throw new Error('Consent email service is not configured')
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.LEARNER_CONSENT_RESEND_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.LEARNER_CONSENT_EMAIL_FROM,
      to: [email],
      subject,
      text: body,
    }),
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000),
  })
  if (!response.ok) throw new Error('Consent email could not be delivered')
}

export const SITE = 'https://vibeschool.co.ke'

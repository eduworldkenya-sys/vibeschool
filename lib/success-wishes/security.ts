import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
export const SESSION_COOKIE = 'vs_wishes_session'
export const SESSION_SECONDS = 15 * 60
export function token() { return randomBytes(32).toString('hex') }
export function hashSecret(value: string) { return createHash('sha256').update(value).digest('hex') }
export function accessHash(code: string) { return hashSecret('success-wishes:inbox:' + code.trim().toUpperCase()) }
export function equalHash(a: string, b: string) {
  if (!/^[a-f0-9]{64}$/.test(a) || !/^[a-f0-9]{64}$/.test(b)) return false
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
}
export function messageExpiry(retentionDays: number, campaignExpiry: string, now = Date.now()): string {
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 365) throw new Error('Invalid message retention policy.')
  const campaignEnd = Date.parse(campaignExpiry)
  if (!Number.isFinite(campaignEnd) || campaignEnd <= now) throw new Error('The school campaign has ended.')
  return new Date(Math.min(campaignEnd, now + retentionDays * 86400000)).toISOString()
}
export function enabled(env: Record<string, string | undefined> = process.env) {
  return env.SUCCESS_WISHES_ENABLED === 'true' && !!env.NEXT_PUBLIC_SUPABASE_URL && !!env.SUPABASE_SERVICE_ROLE_KEY
}

// Emergency shutoff applies to every new private voice/video playback capability,
// independently of upload reservations and existing paid media. Previously
// issued provider URLs expire separately and require provider-level revocation.
export function mediaPlaybackEnabled(env: Record<string, string | undefined> = process.env) {
  return enabled(env) && env.SUCCESS_WISHES_MEDIA_CERTIFIED === 'true'
}

// Separately commissioned, staff-only preparation never enables public sending.
export function staffReady(env: Record<string, string | undefined> = process.env) {
  return (enabled(env) || env.SUCCESS_WISHES_STAFF_SETUP_ENABLED === 'true')
    && !!env.NEXT_PUBLIC_SUPABASE_URL
    && !!env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    && !!env.SUPABASE_SERVICE_ROLE_KEY
}

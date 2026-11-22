/**
 * Owner-authorized publishing identity for the first VibeSchool Content Studio pilot.
 * This is a public identifier, NOT a password, secret, or a substitute for the
 * authenticated Supabase session and server-side authorization/RLS.
 *
 * Always verify getUser(), the server-backed teacher role, and publication
 * ownership. Never authorize by editable display name or user_metadata.
 */
export const MUMBI2_PUBLISHER_ID = 'c49bf987-357f-46bc-98fb-9a326882e437'

export function isMumbi2Publisher(userId: string | null | undefined, role: string | null | undefined): boolean {
  return userId === MUMBI2_PUBLISHER_ID && role === 'teacher'
}

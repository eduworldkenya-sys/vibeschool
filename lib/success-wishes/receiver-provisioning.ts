import { WishError } from './contracts'
import { senderPhone } from './phone-verification'

type GuardianLink = {
  school_id: string | null
  student_id: string
  relationship: string
  is_primary: boolean
  receives_alerts: boolean
}

/**
 * This initial school-assisted pilot is deliberately limited to minors whose
 * DOB exists in school records and who have an existing primary guardian link.
 * Unknown age and adult recipients need a different, separately verified route.
 */
export function requireSchoolMinor(dateOfBirth: string | null, today = new Date()): void {
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth))
    throw new WishError(409, 'A verified date of birth is required before school-assisted registration.')
  const birth = new Date(dateOfBirth + 'T00:00:00Z')
  if (!Number.isFinite(birth.getTime()) || birth.toISOString().slice(0, 10) !== dateOfBirth)
    throw new WishError(409, 'The student date of birth needs correction.')
  const thisYear = today.getUTCFullYear()
  const eighteenth = new Date(Date.UTC(birth.getUTCFullYear() + 18, birth.getUTCMonth(), birth.getUTCDate()))
  if (birth.getTime() > today.getTime() || thisYear - birth.getUTCFullYear() > 110)
    throw new WishError(409, 'The school record contains an invalid date of birth.')
  if (today.getTime() >= eighteenth.getTime())
    throw new WishError(409, 'Adult recipients require independent adult identity verification.')
}

export function requireGuardianLink(link: GuardianLink, schoolId: string, studentId: string): void {
  if (link.school_id !== schoolId || link.student_id !== studentId ||
    !link.is_primary || !link.receives_alerts ||
    !['mother', 'father', 'parent', 'guardian'].includes(link.relationship))
    throw new WishError(409, 'A primary authorised guardian record must be verified by the school.')
}

/** An ordinary profile phone, or an unconfirmed Auth phone, is never an OTP destination. */
export function confirmedGuardianPhone(user: {
  phone?: string | null
  phone_confirmed_at?: string | null
  deleted_at?: string | null
  banned_until?: string | null
}): string {
  if (user.deleted_at || !user.phone_confirmed_at || !Number.isFinite(Date.parse(user.phone_confirmed_at)))
    throw new WishError(409, 'The linked guardian needs a verified phone account.')
  if (user.banned_until && Date.parse(user.banned_until) > Date.now())
    throw new WishError(409, 'The linked guardian account is unavailable.')
  try { return senderPhone(user.phone) }
  catch { throw new WishError(409, 'The guardian must verify a supported Kenyan mobile number.') }
}

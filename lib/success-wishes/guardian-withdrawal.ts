import { WishError } from './contracts'
import { requireGuardianLink } from './receiver-provisioning'

type Audit = { receiver_id: string; student_id: string; school_id: string; guardian_link_id: string }
type GuardianLink = {
  id: string; parent_id: string; student_id: string; school_id: string | null
  relationship: string; is_primary: boolean; receives_alerts: boolean
}
type Recipient = {
  id: string; student_id: string | null; guardian_phone_e164: string | null
  consent_route: string | null; consent_status: string
}

/** An authenticated guardian is not automatically entitled to another child's inbox.
 * This check independently binds Auth user -> canonical guardian link -> original
 * provisioning audit -> exact receiver -> confirmed phone. Neither the browser
 * nor a bearer-card link can change this trusted chain.
 */
export function requireGuardianWithdrawalAuthority(
  guardianId: string, confirmedPhone: string, receiverId: string,
  audit: Audit | null, link: GuardianLink | null, person: Recipient | null,
) {
  const unavailable = () => new WishError(404, 'This recipient is unavailable to this guardian.')
  if (!audit || !link || !person ||
      audit.receiver_id !== receiverId || person.id !== receiverId ||
      person.student_id !== audit.student_id ||
      audit.guardian_link_id !== link.id ||
      audit.student_id !== link.student_id ||
      link.parent_id !== guardianId)
    throw unavailable()
  try { requireGuardianLink(link, audit.school_id, audit.student_id) }
  catch { throw unavailable() }
  if (person.consent_status !== 'verified' || person.consent_route !== 'guardian' ||
      person.guardian_phone_e164 !== confirmedPhone)
    throw unavailable()
  return { receiverId: person.id, phone: confirmedPhone }
}

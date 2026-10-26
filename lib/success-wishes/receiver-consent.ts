import { WishError } from './contracts'

export type ConsentMode = 'adult' | 'guardian' | 'verified'
export type ConsentPurpose = 'recovery' | 'consent_adult' | 'consent_guardian'
export type ConsentPerson = {
  phone_e164: string
  guardian_phone_e164: string | null
  consent_route: 'adult' | 'guardian' | null
  consent_status: string
}
/** Never choose the consent route or SMS destination from a public request. */
export function registeredConsentRoute(person: ConsentPerson): {
  phone: string; purpose: ConsentPurpose; consentRole: ConsentMode
} {
  if (person.consent_status === 'revoked')
    throw new WishError(404, 'This private recipient is unavailable.')
  if (person.consent_status === 'verified')
    return { phone: person.phone_e164, purpose: 'recovery', consentRole: 'verified' }
  if (person.consent_status !== 'pending')
    throw new WishError(409, 'Receiver eligibility must be verified before access.')
  if (person.consent_route === 'adult')
    return { phone: person.phone_e164, purpose: 'consent_adult', consentRole: 'adult' }
  if (person.consent_route === 'guardian' && person.guardian_phone_e164)
    return { phone: person.guardian_phone_e164, purpose: 'consent_guardian', consentRole: 'guardian' }
  throw new WishError(409, 'A trusted guardian contact or adult identity must be configured before this recipient can open their wish.')
}
export function verifyConsentDeclaration(expected: ConsentMode, suppliedRole: unknown, accepted: unknown) {
  if (suppliedRole !== expected)
    throw new WishError(409, 'Your verification route has changed. Request a new code.')
  if (expected !== 'verified' && accepted !== true)
    throw new WishError(400, 'The recipient or authorised guardian must affirm consent.')
}

/**
 * Withdrawal needs fresh proof from the trusted contact who originally granted consent.
 * A student-facing inbox session must not redirect a guardian challenge to the student's phone.
 */
export function registeredWithdrawalRoute(person: ConsentPerson): {
  phone: string; purpose: 'consent_adult' | 'consent_guardian'; consentRole: 'adult' | 'guardian'
} {
  if (person.consent_status !== 'verified')
    throw new WishError(409, 'Only an active verified recipient can withdraw consent here.')
  if (person.consent_route === 'guardian' && person.guardian_phone_e164)
    return { phone: person.guardian_phone_e164, purpose: 'consent_guardian', consentRole: 'guardian' }
  if (person.consent_route === 'adult')
    return { phone: person.phone_e164, purpose: 'consent_adult', consentRole: 'adult' }
  throw new WishError(409, 'Contact support to review the registered consent authority.')
}

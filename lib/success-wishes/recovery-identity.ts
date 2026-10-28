import { matchesDigest, recoveryDigest } from './receiver-sms'

export type RecoveryIdentity = {
  id: string
  phone_e164: string
  guardian_phone_e164: string | null
  consent_route: 'adult' | 'guardian' | null
  consent_status: string
  recovery_secret_hash: string | null
}

/** A verified minor's student number must never bypass the approved guardian phone. */
export function canRecoverFromPhone(person: RecoveryIdentity, phone: string) {
  if (person.consent_status !== 'verified') return false
  return person.consent_route === 'guardian'
    ? !!person.guardian_phone_e164 && person.guardian_phone_e164 === phone
    : person.phone_e164 === phone
}

/** A shared number alone cannot select a child's inbox. A saved backup secret can. */
export function selectRecoveryIdentity(
  persons: RecoveryIdentity[], phone: string, backupCode?: string | null,
): RecoveryIdentity | null {
  const eligible = persons.filter(person => canRecoverFromPhone(person, phone))
  const matched = backupCode
    ? eligible.filter(person => person.recovery_secret_hash &&
      matchesDigest(person.recovery_secret_hash, recoveryDigest(person.id, backupCode)))
    : eligible
  return matched.length === 1 ? matched[0] : null
}

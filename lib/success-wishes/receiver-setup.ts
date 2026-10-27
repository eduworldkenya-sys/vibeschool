import { WishError } from './contracts'
import { hashSecret } from './security'
import { ConsentPerson } from './receiver-consent'

/** A trusted operator provisions this capability; it never proves phone ownership. */
export function setupDigest(token: unknown): string {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token))
    throw new WishError(404, 'This private setup link has expired or is unavailable.')
  return hashSecret('success-wishes:receiver-setup:' + token)
}
export function requireAdultSetup(person: ConsentPerson & { setup_expires_at: string | null }, now = Date.now()) {
  if (person.consent_route !== 'adult' || !['pending', 'verified'].includes(person.consent_status) ||
      !person.setup_expires_at || !Number.isFinite(Date.parse(person.setup_expires_at)) ||
      Date.parse(person.setup_expires_at) <= now)
    throw new WishError(404, 'This private setup link has expired or is unavailable.')
  return person
}

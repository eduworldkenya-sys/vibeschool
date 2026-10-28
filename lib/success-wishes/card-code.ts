import { createHash } from 'node:crypto'

/** Short codes are never used instead of authenticated recipient verification. */
export const SIX_CARD_CODE = /^(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{6}$/
export const LEGACY_CARD_CODE = /^[0-9A-F]{32}$/

/** Stable code across settlement status retries; the long private link remains the real capability. */
export function sixCardCodeFromOrderKey(key: string) {
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Invalid private order key.')
  const space = 36 ** 6
  for (let counter = 0; counter < 64; counter++) {
    const digest = createHash('sha256').update('vibeschool:gift-code:v1:'+key+':'+counter).digest('hex')
    const value = parseInt(digest.slice(0,12),16) % space
    const code = value.toString(36).toUpperCase().padStart(6,'0')
    if (SIX_CARD_CODE.test(code)) return code
  }
  throw new Error('Unable to generate a card code.')
}

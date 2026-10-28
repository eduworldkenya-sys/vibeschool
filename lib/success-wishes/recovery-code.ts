// Six-character backup codes are paired with an SMS challenge and strict attempt limits.
// Preserve 80-bit and 128-bit previously issued codes without rotation.
import { randomInt } from 'node:crypto'
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const SHORT = /^[0-9A-HJKMNP-TV-Z]{16}$/
const SIX = /^(?=.*[A-HJ-NP-Z])(?=.*[0-9])(?=.*[@!#])[A-HJ-NP-Z0-9@!#]{6}$/
const LEGACY = /^[0-9A-F]{32}$/

export function newSixCharacterRecoveryCode(): string {
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ'
  const digits = '0123456789'
  const symbols = '@!#'
  const chars = [letters[randomInt(letters.length)], letters[randomInt(letters.length)],
    digits[randomInt(digits.length)], digits[randomInt(digits.length)],
    symbols[randomInt(symbols.length)], symbols[randomInt(symbols.length)]]
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

export function newRecoveryCodeFromBytes(bytes: Uint8Array): string {
  if (bytes.length !== 10) throw new Error('Recovery codes require 80 random bits.')
  let buffer = 0
  let bits = 0
  let code = ''
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte
    bits += 8
    while (bits >= 5) {
      bits -= 5
      code += ALPHABET[(buffer >>> bits) & 31]
      buffer &= (1 << bits) - 1
    }
  }
  return code
}

// Normalize only separators; do not silently alter letters in a secret.
export function normalizeRecoveryCode(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 64) return null
  const raw = input.trim().toUpperCase().replace(/[\s-]/g, '')
  return SIX.test(raw) || SHORT.test(raw) || LEGACY.test(raw) ? raw : null
}

export function formatRecoveryCode(raw: string): string {
  if (!SHORT.test(raw)) return raw
  return raw.match(/.{4}/g)!.join('-')
}

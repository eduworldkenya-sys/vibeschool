// A printable 80-bit saved recovery code. Keep legacy 128-bit hex codes valid.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const SHORT = /^[0-9A-HJKMNP-TV-Z]{16}$/
const LEGACY = /^[0-9A-F]{32}$/

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
  return SHORT.test(raw) || LEGACY.test(raw) ? raw : null
}

export function formatRecoveryCode(raw: string): string {
  if (!SHORT.test(raw)) return raw
  return raw.match(/.{4}/g)!.join('-')
}

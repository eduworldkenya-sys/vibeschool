import { randomInt } from 'node:crypto'

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


const forbiddenTokens = [
  '@ts-' + 'ignore',
  '@ts-' + 'nocheck',
  '.' + 'skip' + '(',
  'as ' + 'any',
  'as ' + 'unknown',
  'eslint-' + 'disable',
]

export function findEscapeHatches(text) {
  const findings = []
  for (const token of forbiddenTokens) {
    if (text.includes(token)) findings.push(token)
  }
  return findings
}

export function getEscapeHatchTokens() {
  return [...forbiddenTokens]
}

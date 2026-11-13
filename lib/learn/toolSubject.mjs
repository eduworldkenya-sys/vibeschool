/**
 * Shared subject classification for the Learn presentation and activity layers.
 * No grade-specific UI, certification or permission decisions are made here.
 * @param {string} subject
 * @returns {'math'|'language'|'science'|'creative'|'general'}
 */
export function learnSubjectMode(subject) {
  if (typeof subject !== 'string') return 'general'
  if (/math|mathematics/i.test(subject)) return 'math'
  if (/english|kiswahili|language|literature|french|arabic|german|spanish|sign language|mother tongue|indigenous/i.test(subject)) return 'language'
  if (/science|agriculture|health|biology|chemistry|physics|environment/i.test(subject)) return 'science'
  if (/creative|art|music|performing|design/i.test(subject)) return 'creative'
  return 'general'
}

/**
 * Generates a short, readable school join code.
 * Format: first 3-4 consonant-heavy letters of name + 4 random digits
 * Examples: kwihota → KWI-4821, St Mary's → STM-2934, Arya → ARY-1029
 */
export function generateSchoolCode(name: string): string {
  const clean = name.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const prefix = clean.slice(0, 3).padEnd(3, 'X')
  const digits = Math.floor(1000 + Math.random() * 9000).toString()
  return `${prefix}-${digits}`
}

/**
 * Converts a school code to a URL-safe subdomain.
 * KWI-4821 → kwi-4821
 */
export function codeToSubdomain(code: string): string {
  return code.toLowerCase()
}

/**
 * Formats an existing subdomain for display.
 * kwihota-8365 → KWI-8365 (takes first 3 chars + last 4 digits)
 */
export function formatJoinCode(subdomain: string): string {
  if (!subdomain) return ''
  const parts = subdomain.split('-')
  if (parts.length < 2) return subdomain.toUpperCase()
  const prefix = parts[0].slice(0, 3).toUpperCase()
  const digits = parts[parts.length - 1]
  // Only show digit suffix if it looks like our 4-digit code
  if (/^\d{4}$/.test(digits)) return `${prefix}-${digits}`
  return subdomain.toUpperCase()
}

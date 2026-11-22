/**
 * Shared, browser-safe policy for VibeSchool's existing first-party page-view
 * ledger. No private IDs, search parameters, fragments or tokens are collected.
 */
export type TrafficPeriod = 7 | 30 | 90 | 'all'

export function parseTrafficPeriod(value: string | null): TrafficPeriod {
  return value === '30' ? 30 : value === '90' ? 90 : value === 'all' ? 'all' : 7
}

export function normalizeTrafficPagePath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null
  if (/[?#%\\\s]/.test(value) || !/^\/[a-z0-9/_-]*$/i.test(value)) return null
  if (/^\/(?:api|_next)(?:\/|$)/i.test(value)) return null
  if (value.length > 1000) return null

  const safe = value.split('/').map(segment => {
    // Dynamic identifiers and high-entropy slugs are not meaningful page names.
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) return '_id'
    if (/^\d{5,}$/.test(segment) || /^[0-9a-f]{16,}$/i.test(segment) || /^[a-z0-9_-]{32,}$/i.test(segment)) return '_id'
    return segment
  }).join('/')
  return safe.length <= 160 ? safe : null
}

export function parseTrafficCursor(value: string | null): string | null {
  if (value === null || value === '') return null
  return /^[1-9][0-9]{0,17}$/.test(value) ? value : null
}

export function parseTrafficSearch(value: string | null): string | null {
  if (!value) return ''
  return value.length <= 80 && /^\/[a-z0-9/_-]*$/i.test(value) ? value : null
}

export function kenyaDateKey(value: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value))
  const byType = (type: string) => parts.find(part => part.type === type)?.value ?? ''
  return `${byType('year')}-${byType('month')}-${byType('day')}`
}

export function csvTrafficCell(value: unknown): string {
  let plain = value === null || value === undefined ? '' : String(value)
  // Protect spreadsheets from formula injection, including leading whitespace.
  if (/^[\s]*[=+@\-]/.test(plain) || /^[\t\r]/.test(plain)) plain = "'" + plain
  return '"' + plain.replace(/"/g, '""') + '"'
}

/**
 * Learner-facing copy is based on account identity and saved activity, not sign-in alone.
 * Shared between the verified independent lookup and the protected student UI.
 */
export function learnerDisplayName(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const name = candidate.replace(/\s+/g, ' ').trim()
    if (name && !/^(learner|student|user|unknown|unnamed|n\/a|null|undefined)$/i.test(name)) return name
  }
  return ''
}

export function learnerGreeting(now: Date, firstName: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now)
  const hour = Number(parts.find(part => part.type === 'hour')?.value ?? 12)
  const salutation = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const name = learnerDisplayName(firstName).split(/\s+/)[0]
  return name ? `${salutation}, ${name}` : salutation
}

export function studyDeskHeading(loading: boolean, savedReadingCount: number): string {
  if (loading) return 'Your learning space'
  return savedReadingCount > 0 ? 'Continue where you left off' : 'Start learning'
}

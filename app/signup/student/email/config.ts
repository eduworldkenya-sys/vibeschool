const normalize = (email: string) => email.trim().toLowerCase()

function testEmails() {
  return (process.env.INDEPENDENT_LEARNER_PILOT_EMAILS ?? '').split(',').map(normalize).filter(Boolean)
}

export function emailPilotEnabled() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    (process.env.INDEPENDENT_LEARNER_PUBLIC_EMAIL_ENABLED === 'true' || testEmails().length > 0)
}

export function pilotEmail(value: FormDataEntryValue | string | null | undefined) {
  if (typeof value !== 'string' || value.length > 254 || !emailPilotEnabled()) return null
  const email = normalize(value)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return process.env.INDEPENDENT_LEARNER_PUBLIC_EMAIL_ENABLED === 'true' ||
    testEmails().includes(email) ? email : null
}

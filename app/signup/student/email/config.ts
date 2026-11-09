const normalize = (email: string) => email.trim().toLowerCase()

function testEmails() {
  return (process.env.INDEPENDENT_LEARNER_PILOT_EMAILS ?? '').split(',').map(normalize).filter(Boolean)
}

export function emailPilotEnabled() {
  return testEmails().length > 0 && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export function pilotEmail(value: FormDataEntryValue | string | null | undefined) {
  if (typeof value !== 'string' || value.length > 254 || !emailPilotEnabled()) return null
  const email = normalize(value)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && testEmails().includes(email) ? email : null
}

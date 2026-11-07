/** Keep school provisioning and returning learner login on the same identifier. */
export function schoolLearnerEmail(school: string, admission: string) {
  const prefix = school.toLowerCase().replace(/[^a-z0-9]/g, '') || 'vs'
  return `${prefix}_${admission.trim().toLowerCase().replace(/\s/g, '')}@vs.internal`
}

export function learnerLoginEmail(identifier: string, school = '') {
  const normalized = identifier.trim().toLowerCase().replace(/\s/g, '')
  // Accept the exact issued sign-in ID, including its internal suffix if pasted.
  if (normalized.endsWith('@vs.internal')) return normalized
  if (normalized.includes('@')) return null
  if (!normalized) return null
  return school.trim() ? schoolLearnerEmail(school, normalized) : `${normalized}@vs.internal`
}

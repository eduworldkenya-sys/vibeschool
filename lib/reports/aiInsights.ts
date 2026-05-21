export async function generateInsight(
  reportType: string,
  data: unknown[]
): Promise<string> {
  try {
    const res = await fetch('/api/reports/insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportType, data }),
    })
    if (!res.ok) return 'Unable to generate insight at this time.'
    const result = await res.json()
    return result.insight ?? 'Unable to generate insight at this time.'
  } catch {
    return 'Unable to generate insight at this time.'
  }
}
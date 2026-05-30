// G2: single source of truth for week/day — UTC+3 (Nairobi)
export async function getServerWeek(): Promise<{ weekStart: string; dayOfWeek: number }> {
  const now  = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }))
  const dow  = now.getDay() === 0 ? 7 : now.getDay()
  const diff = now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)
  const monday = new Date(now)
  monday.setDate(diff)
  const weekStart = monday.toISOString().split('T')[0]
  return { weekStart, dayOfWeek: dow }
}

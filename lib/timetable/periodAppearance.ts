/** One quiet, consistent visual key for school-day activities. Scheduling always uses kind, not colour. */
export const periodAppearance = (kind: string) => {
  switch (kind) {
    case 'break':
      return { label: 'Break', background: '#eff6ff', border: '#bfdbfe', text: '#1e40af' }
    case 'lunch':
      return { label: 'Lunch', background: '#fff7ed', border: '#fed7aa', text: '#9a3412' }
    case 'assembly':
      return { label: 'Assembly', background: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6' }
    case 'games':
    case 'club':
      return { label: kind === 'games' ? 'Games' : 'Club', background: '#f0fdf4', border: '#bbf7d0', text: '#166534' }
    case 'examination':
      return { label: 'Examination', background: '#fef2f2', border: '#fecaca', text: '#991b1b' }
    case 'lesson':
      return { label: 'Teaching period', background: '#ffffff', border: '#e2e8f0', text: '#334155' }
    default:
      return { label: kind.replaceAll('_', ' '), background: '#f8fafc', border: '#e2e8f0', text: '#475569' }
  }
}

'use client'

import { useStudent } from '@/lib/student-context'
import SchoolLearnLibrary from '@/components/learn/SchoolLearnLibrary'

/** Students and public visitors share the exact same grade and subject discovery. */
export default function ReadingLibraryPage() {
  const { identity, loading, error } = useStudent()
  if (loading) return <main role="status" style={{ padding: 24 }}>Opening your learning library…</main>
  if (error && !identity) return <main role="alert" style={{ padding: 24 }}>{error}</main>
  return <SchoolLearnLibrary mode="student" learnerGrade={identity?.className} />
}

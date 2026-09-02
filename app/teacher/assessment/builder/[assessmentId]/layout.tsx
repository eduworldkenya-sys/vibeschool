'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function AssessmentBuilderLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ assessmentId: string }>()
  return (
    <>
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '10px 14px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#6b7280' }}>Advanced assessment editing</span>
          <Link href={`/teacher/assessment/review/${params.assessmentId}`} style={{ borderRadius: 10, padding: '10px 14px', background: '#4338ca', color: '#fff', fontWeight: 800, fontSize: 12, textDecoration: 'none' }}>
            Review & Assign
          </Link>
        </div>
      </div>
      {children}
    </>
  )
}

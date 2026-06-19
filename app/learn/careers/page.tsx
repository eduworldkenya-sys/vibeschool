"use client"
export const dynamic = "force-dynamic"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LearnBottomNav } from '@/components/learn/LearnBottomNav'

const BLUE = '#1A1AFF'
const INK = '#0A0A0F'
const MUTED = '#5A5A6A'
const CANVAS = '#F7F7FB'

interface CourseRow {
  slug: string
  domain: string
  status: 'live' | 'coming_soon'
}

interface CareerDef {
  emoji: string
  title: string
  domain: string
  institutionLabel: string
}

const CAREERS: CareerDef[] = [
  { emoji: '👩‍⚕️', title: 'A Nurse',         domain: 'health',    institutionLabel: 'KMTC' },
  { emoji: '👨‍🏫', title: 'A Teacher',       domain: 'education', institutionLabel: 'College' },
  { emoji: '💊',   title: 'A Pharmacist',    domain: 'health',    institutionLabel: 'KMTC' },
  { emoji: '🔌',   title: 'An Electrician',  domain: 'trade',     institutionLabel: 'TVET' },
  { emoji: '💻',   title: 'In Tech',         domain: 'tech',      institutionLabel: 'Various' },
]

export default function CareersPage() {
  const router = useRouter()
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('courses')
        .select('slug, domain, status')

      if (error) {
        console.error('CareersPage courses fetch error:', error)
      } else if (data) {
        setCourses(data as CourseRow[])
      }
      setLoading(false)
    }
    load()
  }, [])

  function liveCourseCountForDomain(domain: string): number {
    return courses.filter(c => c.domain === domain && c.status === 'live').length
  }

  return (
    <div style={{ minHeight: '100vh', background: CANVAS, paddingBottom: 84 }}>
      {/* TOPBAR */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50, background: CANVAS,
        padding: '16px 16px 12px', borderBottom: '1px solid #ecebf3',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div onClick={() => router.push('/learn')} style={{ cursor: 'pointer', fontSize: 18, color: INK }}>←</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>I want to become...</div>
      </div>

      <div style={{ padding: '20px 16px 0' }}>
        {loading ? (
          <div style={{ fontSize: 13, color: MUTED }}>Loading careers...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {CAREERS.map((career) => {
              const liveCount = liveCourseCountForDomain(career.domain)
              const hasLive = liveCount > 0

              return (
                <div
                  key={career.title}
                  onClick={() => router.push('/learn')}
                  style={{
                    background: '#fff', borderRadius: 16, border: '1px solid #ecebf3',
                    padding: 16, textAlign: 'center', cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{career.emoji}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: INK, marginBottom: 4 }}>
                    {career.title}
                  </div>
                  <div style={{ fontSize: 11, color: hasLive ? BLUE : MUTED }}>
                    {hasLive
                      ? `${liveCount} course${liveCount > 1 ? 's' : ''} live · ${career.institutionLabel}`
                      : `Coming soon · ${career.institutionLabel}`}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <LearnBottomNav />
    </div>
  )
}

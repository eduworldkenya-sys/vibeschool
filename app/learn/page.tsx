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
  id: string
  slug: string
  title: string
  institution: string | null
  level: string | null
  duration_label: string | null
  domain: string
  status: 'live' | 'coming_soon'
  badge: string | null
  weeks_count: number | null
  modules_count: number | null
}

const DOMAIN_META: Record<string, { label: string; emoji: string; bg: string }> = {
  health:    { label: 'Health',    emoji: '🩺', bg: '#e6fff5' },
  tech:      { label: 'Tech',      emoji: '⚡', bg: '#eef2ff' },
  education: { label: 'Education', emoji: '✏️', bg: '#fff7ed' },
  trade:     { label: 'Trade',     emoji: '💼', bg: '#fdf2f8' },
}

function CourseCard({ course, onClick }: { course: CourseRow; onClick: () => void }) {
  const domainMeta = DOMAIN_META[course.domain] ?? DOMAIN_META.trade
  const isLive = course.status === 'live'

  return (
    <div
      onClick={isLive ? onClick : undefined}
      style={{
        background: '#fff', borderRadius: 16, border: '1px solid #ecebf3',
        padding: 16, cursor: isLive ? 'pointer' : 'default',
        opacity: isLive ? 1 : 0.7,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, background: domainMeta.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
        }}>
          {domainMeta.emoji}
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
          background: isLive ? '#eef2ff' : '#f3f3f6',
          color: isLive ? BLUE : MUTED,
        }}>
          {isLive ? 'Live' : 'Coming soon'}
        </span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: INK, marginBottom: 4 }}>
        {course.title}
      </div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>
        {[course.institution, course.level, course.duration_label].filter(Boolean).join(' · ')}
      </div>
      <div style={{ fontSize: 12, color: MUTED }}>
        {isLive
          ? `📚 ${course.modules_count ?? '—'} modules`
          : '📚 Curriculum in review'}
      </div>
    </div>
  )
}

export default function LearnPage() {
  const router = useRouter()
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('courses')
        .select('id, slug, title, institution, level, duration_label, domain, status, badge, weeks_count, modules_count')
        .order('status', { ascending: false })

      if (error) {
        console.error('LearnPage courses fetch error:', error)
      } else if (data) {
        setCourses(data as CourseRow[])
      }
      setLoading(false)
    }
    load()
  }, [])

  const liveCourses = courses.filter(c => c.status === 'live')
  const featured = liveCourses[0] ?? null

  const filteredCourses = search.trim()
    ? courses.filter(c => c.title.toLowerCase().includes(search.trim().toLowerCase()))
    : courses

  return (
    <div style={{ minHeight: '100vh', background: CANVAS, paddingBottom: 84 }}>
      {/* TOPBAR */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50, background: CANVAS,
        padding: '16px 16px 8px', borderBottom: '1px solid #ecebf3',
      }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: INK }}>VibeSchool <span style={{ color: BLUE }}>Learn</span></div>
      </div>

      {/* HERO */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: INK, lineHeight: 1.25 }}>
          Kenya&apos;s Learning Platform
        </div>
        <div style={{ fontSize: 13, color: MUTED, marginTop: 6, marginBottom: 16 }}>
          Free, curriculum-aligned study material for KMTC, TVET, and Teachers College learners.
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search courses..."
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 12,
            border: '1px solid #ecebf3', background: '#fff', fontSize: 14,
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* STATS BAR */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
        padding: '16px 16px 0',
      }}>
        {[
          { number: String(liveCourses.length), label: 'Course live' },
          { number: String(featured?.modules_count ?? 0), label: 'Modules & topics' },
          { number: `${Math.max(courses.length - liveCourses.length, 0)}+`, label: 'More coming soon' },
          { number: '100%', label: 'Free forever' },
        ].map((stat) => (
          <div key={stat.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: INK }}>{stat.number}</div>
            <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* DOMAIN GRID */}
      <div style={{ padding: '24px 16px 0' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: INK, marginBottom: 12 }}>Browse by domain</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {Object.entries(DOMAIN_META).map(([key, meta]) => (
            <div key={key} style={{
              background: '#fff', borderRadius: 14, border: '1px solid #ecebf3',
              padding: '14px 8px', textAlign: 'center',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, background: meta.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, margin: '0 auto 6px',
              }}>
                {meta.emoji}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: INK }}>{meta.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURED COURSE */}
      {featured && (
        <div style={{ padding: '24px 16px 0' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: INK, marginBottom: 12 }}>Featured course</div>
          <div
            onClick={() => router.push(`/learn/${featured.slug}`)}
            style={{
              background: INK, borderRadius: 18, padding: 20, cursor: 'pointer',
              color: '#fff',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: BLUE, marginBottom: 8 }}>
              {(featured.institution ?? '').toUpperCase()} · {featured.level}
            </div>
            <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 6 }}>{featured.title}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 16 }}>
              📅 {featured.duration_label} curriculum · 🧠 AI Twin included · 🇰🇪 Kenya context
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: BLUE, color: '#fff', fontSize: 13, fontWeight: 700,
              padding: '10px 18px', borderRadius: 999,
            }}>
              Start learning →
            </div>
          </div>
        </div>
      )}

      {/* ALL COURSES */}
      <div style={{ padding: '24px 16px 0' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: INK, marginBottom: 12 }}>All courses</div>
        {loading ? (
          <div style={{ fontSize: 13, color: MUTED }}>Loading courses...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {filteredCourses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                onClick={() => router.push(`/learn/${course.slug}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* CAREER TEASER */}
      <div style={{ padding: '24px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: INK }}>I want to become...</div>
          <div
            onClick={() => router.push('/learn/careers')}
            style={{ fontSize: 12, fontWeight: 600, color: BLUE, cursor: 'pointer' }}
          >
            All careers →
          </div>
        </div>
      </div>

      <LearnBottomNav />
    </div>
  )
}

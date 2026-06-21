"use client"
export const dynamic = "force-dynamic"

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LearnBottomNav } from '@/components/learn/LearnBottomNav'

/* ---------------------------------------------------------
   TOKENS — VibeSchool brand system. Do not introduce new
   colors here; everything derives from these six values.
--------------------------------------------------------- */
const BG = '#000000'
const SURFACE = '#09090b'
const SURFACE_RAISED = '#121214'
const BORDER = '#1f1f23'
const ACCENT = '#10b981'
const TEXT = '#e4e4e7'
const MUTED = '#71717a'

const FONT_DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif"
const FONT_BODY = "'Plus Jakarta Sans', system-ui, sans-serif"

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

const DOMAIN_META: Record<string, { label: string; emoji: string; tint: string }> = {
  health:    { label: 'Health',    emoji: '🩺', tint: '#10b981' },
  tech:      { label: 'Tech',      emoji: '⚡', tint: '#3b82f6' },
  education: { label: 'Education', emoji: '✏️', tint: '#f59e0b' },
  trade:     { label: 'Trade',     emoji: '💼', tint: '#ec4899' },
}

/* ---------------------------------------------------------
   Institution badge — the signature element. Treated like
   a credential stamp rather than a soft category pill, since
   "is this KMTC-recognized?" is the first thing a Kenyan
   TVET learner checks before reading anything else.
--------------------------------------------------------- */
function InstitutionStamp({ institution, level }: { institution: string | null; level: string | null }) {
  if (!institution && !level) return null
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontFamily: FONT_BODY, fontSize: 10.5, fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      color: ACCENT, border: `1px solid ${ACCENT}33`,
      background: `${ACCENT}14`, borderRadius: 6,
      padding: '4px 8px',
    }}>
      {institution}
      {level && <span style={{ color: MUTED, fontWeight: 600 }}>· {level}</span>}
    </div>
  )
}

function DomainIcon({ domain, size = 40 }: { domain: string; size?: number }) {
  const meta = DOMAIN_META[domain] ?? DOMAIN_META.trade
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.32,
      background: `${meta.tint}1A`, border: `1px solid ${meta.tint}33`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.46, flexShrink: 0,
    }}>
      {meta.emoji}
    </div>
  )
}

function CourseCard({ course, onClick }: { course: CourseRow; onClick: () => void }) {
  const isLive = course.status === 'live'

  return (
    <div
      onClick={isLive ? onClick : undefined}
      style={{
        background: SURFACE, borderRadius: 16, border: `1px solid ${BORDER}`,
        padding: 14, cursor: isLive ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column', gap: 10,
        transition: 'border-color 120ms ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <DomainIcon domain={course.domain} />
        {!isLive && (
          <span style={{
            fontFamily: FONT_BODY, fontSize: 10.5, fontWeight: 700,
            color: MUTED, background: '#1a1a1d', borderRadius: 999,
            padding: '4px 9px', whiteSpace: 'nowrap',
          }}>
            In review
          </span>
        )}
      </div>

      <InstitutionStamp institution={course.institution} level={course.level} />

      <div style={{
        fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 700,
        color: isLive ? TEXT : MUTED, lineHeight: 1.25,
      }}>
        {course.title}
      </div>

      <div style={{
        fontFamily: FONT_BODY, fontSize: 12, color: MUTED,
        display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto',
      }}>
        {isLive ? (
          <>
            <span style={{ color: ACCENT, fontWeight: 700 }}>●</span>
            {course.modules_count ?? '—'} modules · {course.duration_label ?? '—'}
          </>
        ) : (
          'Curriculum in review'
        )}
      </div>
    </div>
  )
}

function CourseCardSkeleton() {
  return (
    <div style={{
      background: SURFACE, borderRadius: 16, border: `1px solid ${BORDER}`,
      padding: 14, height: 168,
    }}>
      <div style={{ width: 40, height: 40, borderRadius: 13, background: SURFACE_RAISED, marginBottom: 14 }} />
      <div style={{ width: '70%', height: 10, borderRadius: 4, background: SURFACE_RAISED, marginBottom: 10 }} />
      <div style={{ width: '90%', height: 14, borderRadius: 4, background: SURFACE_RAISED, marginBottom: 8 }} />
      <div style={{ width: '50%', height: 14, borderRadius: 4, background: SURFACE_RAISED }} />
    </div>
  )
}

export default function LearnPage() {
  const router = useRouter()
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [errored, setErrored] = useState(false)
  const [search, setSearch] = useState('')
  const [activeDomain, setActiveDomain] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('courses')
        .select('id, slug, title, institution, level, duration_label, domain, status, badge, weeks_count, modules_count')
        .order('status', { ascending: false })

      if (error) {
        console.error('LearnPage courses fetch error:', error)
        setErrored(true)
      } else if (data) {
        setCourses(data as CourseRow[])
      }
      setLoading(false)
    }
    load()
  }, [])

  const liveCourses = useMemo(() => courses.filter(c => c.status === 'live'), [courses])
  const comingSoonCount = courses.length - liveCourses.length
  const featured = liveCourses[0] ?? null

  const domainsPresent = useMemo(() => {
    const set = new Set(courses.map(c => c.domain))
    return Object.keys(DOMAIN_META).filter(k => set.has(k))
  }, [courses])

  const totalModules = useMemo(
    () => liveCourses.reduce((sum, c) => sum + (c.modules_count ?? 0), 0),
    [liveCourses]
  )

  const filteredCourses = useMemo(() => {
    let list = courses
    if (activeDomain) list = list.filter(c => c.domain === activeDomain)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(c =>
        c.title.toLowerCase().includes(q) ||
        (c.institution ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [courses, activeDomain, search])

  return (
    <div style={{
      minHeight: '100vh', background: BG, paddingBottom: 96,
      fontFamily: FONT_BODY,
    }}>
      {/* TOPBAR */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50, background: `${BG}f2`,
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        padding: '16px 16px 12px', borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 800, color: TEXT }}>
          VibeSchool <span style={{ color: ACCENT }}>Learn</span>
        </div>
      </div>

      {/* HERO */}
      <div style={{ padding: '24px 16px 0' }}>
        <div style={{
          fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 800,
          color: TEXT, lineHeight: 1.2, letterSpacing: '-0.01em',
        }}>
          Kenya's learning platform
        </div>
        <div style={{ fontSize: 13.5, color: MUTED, marginTop: 8, marginBottom: 18, lineHeight: 1.5 }}>
          Free, curriculum-aligned study material for KMTC, TVET, and Teachers College learners.
        </div>

        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            color: MUTED, fontSize: 14, pointerEvents: 'none',
          }}>
            🔍
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses or institutions..."
            style={{
              width: '100%', padding: '13px 14px 13px 38px', borderRadius: 12,
              border: `1px solid ${BORDER}`, background: SURFACE, color: TEXT,
              fontSize: 14, fontFamily: FONT_BODY, boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* STATS BAR */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
        padding: '20px 16px 0',
      }}>
        {[
          { number: String(liveCourses.length), label: 'Course live' },
          { number: String(totalModules), label: 'Modules & topics' },
          { number: `${Math.max(comingSoonCount, 0)}+`, label: 'More coming soon' },
          { number: '100%', label: 'Free forever' },
        ].map((stat) => (
          <div key={stat.label} style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 19, fontWeight: 800, color: TEXT }}>
              {stat.number}
            </div>
            <div style={{ fontSize: 9.5, color: MUTED, marginTop: 3, lineHeight: 1.3 }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* DOMAIN FILTER — horizontal scroll, doubles as filter chips */}
      <div style={{ padding: '24px 0 0' }}>
        <div style={{
          fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 12,
          padding: '0 16px', fontFamily: FONT_DISPLAY,
        }}>
          Browse by domain
        </div>
        <div style={{
          display: 'flex', gap: 8, overflowX: 'auto', padding: '0 16px 4px',
          scrollbarWidth: 'none',
        }}>
          <button
            onClick={() => setActiveDomain(null)}
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700,
              fontFamily: FONT_BODY, cursor: 'pointer',
              border: `1px solid ${activeDomain === null ? ACCENT : BORDER}`,
              background: activeDomain === null ? `${ACCENT}1A` : SURFACE,
              color: activeDomain === null ? ACCENT : TEXT,
            }}
          >
            All
          </button>
          {Object.entries(DOMAIN_META).map(([key, meta]) => {
            const isActive = activeDomain === key
            const isPresent = domainsPresent.includes(key)
            return (
              <button
                key={key}
                onClick={() => setActiveDomain(isActive ? null : key)}
                disabled={!isPresent}
                style={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700,
                  fontFamily: FONT_BODY, cursor: isPresent ? 'pointer' : 'default',
                  border: `1px solid ${isActive ? meta.tint : BORDER}`,
                  background: isActive ? `${meta.tint}1A` : SURFACE,
                  color: isActive ? meta.tint : (isPresent ? TEXT : MUTED),
                  opacity: isPresent ? 1 : 0.5,
                }}
              >
                <span>{meta.emoji}</span> {meta.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* FEATURED COURSE */}
      {featured && !activeDomain && !search && (
        <div style={{ padding: '28px 16px 0' }}>
          <div style={{
            fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 12,
            fontFamily: FONT_DISPLAY,
          }}>
            Featured course
          </div>
          <div
            onClick={() => router.push(`/learn/${featured.slug}`)}
            style={{
              background: `linear-gradient(155deg, ${SURFACE_RAISED} 0%, ${SURFACE} 100%)`,
              borderRadius: 20, padding: 22, cursor: 'pointer',
              border: `1px solid ${BORDER}`, position: 'relative', overflow: 'hidden',
            }}
          >
            <div style={{
              position: 'absolute', top: -40, right: -40, width: 140, height: 140,
              borderRadius: '50%', background: `${ACCENT}14`, filter: 'blur(20px)',
            }} />
            <div style={{ position: 'relative' }}>
              <InstitutionStamp institution={featured.institution} level={featured.level} />
              <div style={{
                fontFamily: FONT_DISPLAY, fontSize: 21, fontWeight: 800,
                color: TEXT, margin: '12px 0 8px', lineHeight: 1.25,
              }}>
                {featured.title}
              </div>
              <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 18 }}>
                {featured.duration_label ?? '—'} curriculum · {featured.modules_count ?? '—'} modules · AI study twin included
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: ACCENT, color: '#000', fontSize: 13.5, fontWeight: 800,
                padding: '11px 20px', borderRadius: 999, fontFamily: FONT_BODY,
              }}>
                Start learning →
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ALL COURSES */}
      <div style={{ padding: '28px 16px 0' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, fontFamily: FONT_DISPLAY }}>
            {activeDomain ? DOMAIN_META[activeDomain].label : 'All courses'}
          </div>
          {!loading && (
            <div style={{ fontSize: 12, color: MUTED }}>
              {filteredCourses.length} {filteredCourses.length === 1 ? 'course' : 'courses'}
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <CourseCardSkeleton />
            <CourseCardSkeleton />
          </div>
        ) : errored ? (
          <div style={{
            border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24,
            textAlign: 'center', background: SURFACE,
          }}>
            <div style={{ fontSize: 14, color: TEXT, fontWeight: 700, marginBottom: 6 }}>
              Couldn't load courses
            </div>
            <div style={{ fontSize: 12.5, color: MUTED }}>
              Check your connection and reopen this page.
            </div>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div style={{
            border: `1px dashed ${BORDER}`, borderRadius: 16, padding: 28,
            textAlign: 'center', background: SURFACE,
          }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🔎</div>
            <div style={{ fontSize: 14, color: TEXT, fontWeight: 700, marginBottom: 6 }}>
              {search ? `No courses match "${search}"` : 'No courses in this domain yet'}
            </div>
            <div style={{ fontSize: 12.5, color: MUTED }}>
              New curricula are added regularly — check back soon.
            </div>
          </div>
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
      <div style={{ padding: '32px 16px 0' }}>
        <div
          onClick={() => router.push('/learn/careers')}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            border: `1px solid ${BORDER}`, borderRadius: 16, padding: '16px 18px',
            cursor: 'pointer', background: SURFACE,
          }}
        >
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: TEXT, fontFamily: FONT_DISPLAY }}>
              I want to become...
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>
              Explore careers and the courses that get you there
            </div>
          </div>
          <div style={{ fontSize: 18, color: ACCENT }}>→</div>
        </div>
      </div>

      <LearnBottomNav />
    </div>
  )
}

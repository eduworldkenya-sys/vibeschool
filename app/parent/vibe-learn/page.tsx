'use client'

import { useState, useEffect } from 'react'

const dark   = '#1e1b4b'
const accent = '#10b981'
const bg     = '#f0f2f5'

const CATEGORIES = [
  { id: 'all',     label: 'All',           emoji: '⚡' },
  { id: 'maths',   label: 'Maths',         emoji: '📐' },
  { id: 'science', label: 'Science',       emoji: '🔬' },
  { id: 'english', label: 'English',       emoji: '📖' },
  { id: 'social',  label: 'Social Studies',emoji: '🌍' },
  { id: 'coding',  label: 'Coding',        emoji: '💻' },
  { id: 'art',     label: 'Art',           emoji: '🎨' },
  { id: 'kisw',    label: 'Kiswahili',     emoji: '🌐' },
  { id: 'history', label: 'History',       emoji: '📜' },
]

interface MockCourse {
  id: number
  emoji: string
  title: string
  lessons: number
  duration: string
  category: string
  categoryId: string
  difficulty: 'Beginner' | 'Intermediate'
  started: boolean
  completed: boolean
  progress: number
}

const ALL_COURSES: MockCourse[] = [
  {
    id: 1,
    emoji: '📐',
    title: 'Maths Trivia Blitz',
    lessons: 10,
    duration: '20 min',
    category: 'Maths',
    categoryId: 'maths',
    difficulty: 'Beginner',
    started: false,
    completed: false,
    progress: 0,
  },
  {
    id: 2,
    emoji: '🔬',
    title: 'Science Explorer',
    lessons: 8,
    duration: '25 min',
    category: 'Science',
    categoryId: 'science',
    difficulty: 'Beginner',
    started: false,
    completed: false,
    progress: 0,
  },
  {
    id: 3,
    emoji: '📖',
    title: 'English Story Time',
    lessons: 5,
    duration: '15 min',
    category: 'English',
    categoryId: 'english',
    difficulty: 'Beginner',
    started: true,
    completed: true,
    progress: 100,
  },
  {
    id: 4,
    emoji: '🌍',
    title: 'Kenya Geography Quest',
    lessons: 7,
    duration: '30 min',
    category: 'Social Studies',
    categoryId: 'social',
    difficulty: 'Intermediate',
    started: false,
    completed: false,
    progress: 0,
  },
  {
    id: 5,
    emoji: '💻',
    title: 'Intro to Coding',
    lessons: 6,
    duration: '40 min',
    category: 'Coding',
    categoryId: 'coding',
    difficulty: 'Beginner',
    started: false,
    completed: false,
    progress: 0,
  },
  {
    id: 6,
    emoji: '🎨',
    title: 'Art & Creativity',
    lessons: 4,
    duration: '20 min',
    category: 'Art',
    categoryId: 'art',
    difficulty: 'Beginner',
    started: false,
    completed: false,
    progress: 0,
  },
  {
    id: 7,
    emoji: '🌐',
    title: 'Kiswahili Masomo',
    lessons: 8,
    duration: '25 min',
    category: 'Kiswahili',
    categoryId: 'kisw',
    difficulty: 'Beginner',
    started: false,
    completed: false,
    progress: 0,
  },
  {
    id: 8,
    emoji: '📜',
    title: 'Kenya History Deep Dive',
    lessons: 9,
    duration: '35 min',
    category: 'History',
    categoryId: 'history',
    difficulty: 'Intermediate',
    started: false,
    completed: false,
    progress: 0,
  },
]

const FEATURED = {
  title: 'Daily Learning Challenge',
  progress: 45,
  lessonsCompleted: 5,
  lessonsTotal: 11,
  category: 'Maths',
  timeLeft: '~12 min left',
}

const STATS = {
  lessonsCompleted: 3,
  streakDays: 4,
  timeLearnedMinutes: 80,
}

function Skeleton({ h = 56, radius = 12 }: { h?: number; radius?: number }) {
  return (
    <div
      style={{
        height: h,
        borderRadius: radius,
        background: 'linear-gradient(90deg,#e8e8e8 25%,#f0f0f0 50%,#e8e8e8 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite',
      }}
    />
  )
}

function CourseCard({ course }: { course: MockCourse }) {
  const diffColor =
    course.difficulty === 'Beginner'
      ? { bg: '#d1fae5', text: '#065f46' }
      : { bg: '#fef3c7', text: '#92400e' }

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 14,
        padding: 14,
        boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        position: 'relative',
      }}
    >
      {course.completed && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: accent,
            borderRadius: 999,
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            color: '#fff',
          }}
        >
          ✓
        </div>
      )}
      <div style={{ fontSize: 28 }}>{course.emoji}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: dark, lineHeight: 1.3 }}>
        {course.title}
      </div>
      <div style={{ fontSize: 10, color: '#9ca3af' }}>
        {course.lessons} lessons · {course.duration}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <span
          style={{
            background: '#ede9fe',
            color: '#7c3aed',
            fontSize: 9,
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 999,
          }}
        >
          {course.category}
        </span>
        <span
          style={{
            background: diffColor.bg,
            color: diffColor.text,
            fontSize: 9,
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 999,
          }}
        >
          {course.difficulty}
        </span>
      </div>
      <button
        style={{
          marginTop: 4,
          background: course.completed ? '#f3f4f6' : accent,
          color: course.completed ? '#6b7280' : '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '7px 0',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          width: '100%',
        }}
      >
        {course.completed ? 'Revisit' : course.started ? 'Continue' : 'Start'}
      </button>
    </div>
  )
}

function StatPill({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub: string
}) {
  return (
    <div
      style={{
        flex: 1,
        background: '#fff',
        borderRadius: 12,
        padding: '12px 8px',
        textAlign: 'center',
        boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: '#9ca3af',
          marginBottom: 4,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: dark }}>{value}</div>
      <div style={{ fontSize: 10, color: '#9ca3af' }}>{sub}</div>
    </div>
  )
}

export default function VibeLearnPage() {
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab] = useState('all')

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 800)
    return () => clearTimeout(t)
  }, [])

  const filtered =
    activeTab === 'all'
      ? ALL_COURSES
      : ALL_COURSES.filter((c) => c.categoryId === activeTab)

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position:  200% 0 }
          100% { background-position: -200% 0 }
        }
        .cat-scroll::-webkit-scrollbar { display: none }
        .cat-scroll { -ms-overflow-style: none; scrollbar-width: none }
      `}</style>

      <div style={{ background: bg, paddingBottom: 80 }}>

        {/* ── Hero ── */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
            padding: '28px 20px 24px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -40,
              right: -40,
              width: 160,
              height: 160,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: -20,
              left: -20,
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)',
            }}
          />
          <div style={{ fontSize: 36, marginBottom: 8 }}>🎓</div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1.2,
              marginBottom: 6,
            }}
          >
            VibeLearn
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.7)',
              marginBottom: 20,
            }}
          >
            Your child's learning universe
          </div>
          <div style={{ marginBottom: 4 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                color: 'rgba(255,255,255,0.6)',
                marginBottom: 6,
              }}
            >
              <span>3 of 12 lessons completed</span>
              <span>25%</span>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.15)',
              }}
            >
              <div
                style={{
                  width: '25%',
                  height: '100%',
                  borderRadius: 999,
                  background: accent,
                  transition: 'width 0.6s ease',
                }}
              />
            </div>
          </div>
          <div
            style={{
              textAlign: 'right',
              fontSize: 11,
              color: 'rgba(255,255,255,0.4)',
              marginTop: 10,
              fontStyle: 'italic',
            }}
          >
            We grow together
          </div>
        </div>

        <div style={{ padding: '0 16px' }}>

          {/* ── Continue Learning ── */}
          <div style={{ marginTop: 24, marginBottom: 24 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: dark,
                marginBottom: 12,
              }}
            >
              Continue Where You Left Off
            </div>
            {loading ? (
              <Skeleton h={160} />
            ) : (
              <div
                style={{
                  background: '#fff',
                  borderRadius: 16,
                  padding: 18,
                  boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      background: '#ede9fe',
                      color: '#7c3aed',
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: 999,
                    }}
                  >
                    {FEATURED.category}
                  </span>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>
                    {FEATURED.timeLeft}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: dark,
                    marginBottom: 12,
                    lineHeight: 1.3,
                  }}
                >
                  {FEATURED.title}
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      color: '#6b7280',
                      marginBottom: 5,
                    }}
                  >
                    <span>
                      {FEATURED.lessonsCompleted} of {FEATURED.lessonsTotal} lessons
                    </span>
                    <span>{FEATURED.progress}%</span>
                  </div>
                  <div
                    style={{ height: 7, borderRadius: 999, background: '#e5e7eb' }}
                  >
                    <div
                      style={{
                        width: `${FEATURED.progress}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: accent,
                      }}
                    />
                  </div>
                </div>
                <button
                  style={{
                    background: accent,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '10px 20px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  Continue
                </button>
              </div>
            )}
          </div>

          {/* ── Sticky Subject Tabs ── */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 50,
              background: bg,
              paddingTop: 12,
              paddingBottom: 8,
              marginLeft: -16,
              marginRight: -16,
              paddingLeft: 16,
              paddingRight: 16,
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: dark,
                marginBottom: 12,
              }}
            >
              Explore Subjects
            </div>
            <div
              className="cat-scroll"
              style={{
                display: 'flex',
                gap: 8,
                overflowX: 'auto',
                marginLeft: -16,
                marginRight: -16,
                paddingLeft: 16,
                paddingRight: 16,
                paddingBottom: 4,
              }}
            >
              {CATEGORIES.map((cat) => {
                const active = activeTab === cat.id
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveTab(cat.id)}
                    style={{
                      flexShrink: 0,
                      background: active ? dark : '#fff',
                      color: active ? '#fff' : '#374151',
                      border: `1.5px solid ${active ? dark : '#e5e7eb'}`,
                      borderRadius: 999,
                      padding: '7px 14px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {cat.emoji} {cat.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Course Grid ── */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} h={180} radius={14} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 0',
                fontSize: 13,
                color: '#9ca3af',
              }}
            >
              No content in this subject yet
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                marginBottom: 28,
                marginTop: 16,
              }}
            >
              {filtered.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          )}

          {/* ── My Progress ── */}
          {!loading && (
            <div style={{ marginBottom: 8 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: dark,
                  marginBottom: 12,
                }}
              >
                My Progress
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <StatPill
                  label="Lessons"
                  value={String(STATS.lessonsCompleted)}
                  sub="completed"
                />
                <StatPill
                  label="Streak"
                  value={`${STATS.streakDays} 🔥`}
                  sub="days"
                />
                <StatPill label="Time" value="1h 20m" sub="learned" />
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}

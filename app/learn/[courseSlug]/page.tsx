"use client"
export const dynamic = "force-dynamic"

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
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
  status: 'live' | 'coming_soon'
}

interface ModuleRow {
  id: string
  slug: string
  title: string
  sequence_number: number
  weeks_label: string | null
}

interface TopicRow {
  id: string
  module_id: string
  slug: string
  title: string
  sequence_number: number
}

interface ProgressRow {
  topic_id: string
  completed_at: string | null
}

export default function CourseRoadmapPage() {
  const router = useRouter()
  const params = useParams()
  const courseSlug = params.courseSlug as string

  const [course, setCourse] = useState<CourseRow | null>(null)
  const [modules, setModules] = useState<ModuleRow[]>([])
  const [topicsByModule, setTopicsByModule] = useState<Record<string, TopicRow[]>>({})
  const [completedTopicIds, setCompletedTopicIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: courseData, error: courseErr } = await supabase
        .from('courses')
        .select('id, slug, title, institution, level, duration_label, status')
        .eq('slug', courseSlug)
        .single()

      if (courseErr || !courseData) {
        console.error('CourseRoadmapPage course fetch error:', courseErr)
        setNotFound(true)
        setLoading(false)
        return
      }
      setCourse(courseData as CourseRow)

      const { data: { user } } = await supabase.auth.getUser()

      const [modulesResult, progressResult] = await Promise.all([
        supabase
          .from('modules')
          .select('id, slug, title, sequence_number, weeks_label')
          .eq('course_id', courseData.id)
          .order('sequence_number', { ascending: true }),
        user
          ? supabase
              .from('learner_progress')
              .select('topic_id, completed_at')
              .eq('learner_id', user.id)
          : Promise.resolve({ data: [] as ProgressRow[], error: null }),
      ])

      const moduleRows = (modulesResult.data ?? []) as ModuleRow[]
      setModules(moduleRows)

      const completed = new Set(
        ((progressResult.data ?? []) as ProgressRow[])
          .filter(p => p.completed_at)
          .map(p => p.topic_id)
      )
      setCompletedTopicIds(completed)

      if (moduleRows.length > 0) {
        const moduleIds = moduleRows.map(m => m.id)
        const { data: topicData, error: topicErr } = await supabase
          .from('topics')
          .select('id, module_id, slug, title, sequence_number')
          .in('module_id', moduleIds)
          .eq('content_status', 'published')
          .order('sequence_number', { ascending: true })

        if (topicErr) {
          console.error('CourseRoadmapPage topics fetch error:', topicErr)
        } else if (topicData) {
          const grouped: Record<string, TopicRow[]> = {}
          for (const topic of topicData as TopicRow[]) {
            if (!grouped[topic.module_id]) grouped[topic.module_id] = []
            grouped[topic.module_id].push(topic)
          }
          setTopicsByModule(grouped)
        }
      }

      setLoading(false)
    }
    load()
  }, [courseSlug])

  function moduleProgress(moduleId: string): { done: number; total: number } {
    const topics = topicsByModule[moduleId] ?? []
    const done = topics.filter(t => completedTopicIds.has(t.id)).length
    return { done, total: topics.length }
  }

  function moduleStatus(index: number, moduleId: string): 'done' | 'active' | 'locked' {
    const { done, total } = moduleProgress(moduleId)
    if (total > 0 && done === total) return 'done'
    if (index === 0) return 'active'
    const prevModule = modules[index - 1]
    if (!prevModule) return 'active'
    const prev = moduleProgress(prevModule.id)
    if (prev.total > 0 && prev.done === prev.total) return 'active'
    return 'locked'
  }

  const overallDone = Object.values(topicsByModule).flat().filter(t => completedTopicIds.has(t.id)).length
  const overallTotal = Object.values(topicsByModule).flat().length
  const overallPct = overallTotal > 0 ? Math.round((overallDone / overallTotal) * 100) : 0

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: CANVAS, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: MUTED }}>Loading course...</div>
      </div>
    )
  }

  if (notFound || !course) {
    return (
      <div style={{ minHeight: '100vh', background: CANVAS, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: INK, marginBottom: 8 }}>Course not found</div>
          <div onClick={() => router.push('/learn')} style={{ fontSize: 13, color: BLUE, cursor: 'pointer' }}>
            ← Back to Learn
          </div>
        </div>
      </div>
    )
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
        <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>{course.title}</div>
      </div>

      {/* PROGRESS SUMMARY */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>
          {[course.institution, course.level, course.duration_label].filter(Boolean).join(' · ')}
        </div>
        <div style={{
          background: '#fff', borderRadius: 16, border: '1px solid #ecebf3',
          padding: 16, display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <svg width="56" height="56" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" fill="none" stroke="#ecebf3" strokeWidth="6" />
            <circle
              cx="28" cy="28" r="24" fill="none" stroke={BLUE} strokeWidth="6"
              strokeDasharray={`${overallPct * 1.508} 150.8`}
              strokeLinecap="round"
              transform="rotate(-90 28 28)"
            />
          </svg>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: INK }}>{overallPct}% complete</div>
            <div style={{ fontSize: 12, color: MUTED }}>{overallDone} of {overallTotal} topics done</div>
          </div>
        </div>
      </div>

      {/* MODULE LIST */}
      <div style={{ padding: '20px 16px 0' }}>
        {modules.map((module, index) => {
          const status = moduleStatus(index, module.id)
          const { done, total } = moduleProgress(module.id)
          const topics = topicsByModule[module.id] ?? []
          const isLocked = status === 'locked'

          return (
            <div key={module.id} style={{ marginBottom: 14 }}>
              <div style={{
                background: '#fff', borderRadius: 14, border: '1px solid #ecebf3',
                padding: 14, opacity: isLocked ? 0.55 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: status === 'done' ? '#e6fff5' : status === 'active' ? '#eef2ff' : '#f3f3f6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700,
                    color: status === 'done' ? '#00a878' : status === 'active' ? BLUE : MUTED,
                  }}>
                    {status === 'done' ? '✓' : String(index + 1).padStart(2, '0')}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{module.title}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                      {module.weeks_label ?? ''}{total > 0 ? ` · ${done}/${total} topics` : ''}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                    background: status === 'done' ? '#e6fff5' : status === 'active' ? '#eef2ff' : '#f3f3f6',
                    color: status === 'done' ? '#00a878' : status === 'active' ? BLUE : MUTED,
                  }}>
                    {status === 'done' ? 'Done' : status === 'active' ? 'In progress' : 'Locked'}
                  </span>
                </div>

                {!isLocked && topics.length > 0 && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {topics.map((topic) => {
                      const isDone = completedTopicIds.has(topic.id)
                      return (
                        <div
                          key={topic.id}
                          onClick={() => router.push(`/learn/${courseSlug}/${module.slug}/${topic.slug}`)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                            background: CANVAS,
                          }}
                        >
                          <span style={{ fontSize: 13 }}>{isDone ? '✅' : '⬜'}</span>
                          <span style={{ fontSize: 13, color: INK }}>{topic.title}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {modules.length === 0 && (
          <div style={{ fontSize: 13, color: MUTED, textAlign: 'center', padding: '24px 0' }}>
            Module content is being prepared for this course.
          </div>
        )}
      </div>

      <LearnBottomNav />
    </div>
  )
}

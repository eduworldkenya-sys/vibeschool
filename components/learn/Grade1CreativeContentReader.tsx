'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Grade1CreativeActivitiesMap, {
  GRADE1_CREATIVE_STRANDS,
  GRADE1_CREATIVE_UNITS,
} from '@/components/teacher/curriculum/Grade1CreativeActivitiesMap'

type View = 'learn' | 'teach'
type ReleasedResource = {
  id: string
  title: string
  unitId: string
  assetKind: string
  body: string
  lessonOrder: number
}

/**
 * One cross-role reader. Curriculum descriptions reuse the native teacher map;
 * only active, certified learning-resource versions may augment it.
 * No teacher-owned, candidate or unverified editorial payload is exposed.
 */
export default function Grade1CreativeContentReader() {
  const [selectedId, setSelectedId] = useState('1.1')
  const [view, setView] = useState<View>('learn')
  const [released, setReleased] = useState<ReleasedResource[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  const unit = GRADE1_CREATIVE_UNITS.find(item => item.id === selectedId) ?? GRADE1_CREATIVE_UNITS[0]

  // Links from VibeLearn discovery resolve to this single canonical reader.
  useEffect(() => {
    const requestedUnit = new URLSearchParams(window.location.search).get("unit")
    if (requestedUnit && GRADE1_CREATIVE_UNITS.some(item => item.id === requestedUnit)) {
      setSelectedId(requestedUnit)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadCertifiedResources() {
      try {
        // Public learner manuscripts are selected by the database's narrow,
        // certification-guarded read authority. No login or direct version
        // table permissions are needed; teacher and draft versions stay hidden.
        const { data, error } = await supabase.rpc('vs_public_grade1_creative_learner_lessons')
        if (error) throw error
        const next: ReleasedResource[] = []
        for (const item of Array.isArray(data) ? data : []) {
          if (!item || typeof item !== 'object') continue
          const row = item as Record<string, unknown>
          if (typeof row.resource_version_id !== 'string'
            || typeof row.title !== 'string'
            || typeof row.unit_id !== 'string'
            || typeof row.body !== 'string'
            || typeof row.lesson_order !== 'number'
            || !row.body.trim()
            || !GRADE1_CREATIVE_UNITS.some(unit => unit.id === row.unit_id)) continue
          next.push({
            id: row.resource_version_id,
            title: row.title,
            unitId: row.unit_id,
            assetKind: typeof row.asset_kind === 'string' ? row.asset_kind : 'learner_notes',
            body: row.body,
            lessonOrder: row.lesson_order,
          })
        }
        if (!cancelled) setReleased(next)
      } catch {
        if (!cancelled) setLoadError('The published lessons could not be loaded. Please try opening this page again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadCertifiedResources()
    return () => { cancelled = true }
  }, [])

  const lessons = useMemo(() =>
    released.filter(item => item.unitId === unit.id)
      .sort((a, b) => a.lessonOrder - b.lessonOrder || a.title.localeCompare(b.title)),
  [released, unit.id])
  const activeLesson = lessons.find(item => item.id === selectedLessonId) ?? lessons[0] ?? null
  const activeLessonIndex = activeLesson ? lessons.findIndex(item => item.id === activeLesson.id) : -1

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 'clamp(14px,3vw,30px)', color: '#183b2b', fontFamily: 'inherit' }}>
      <header style={{ padding: '0 0 18px' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#176348', letterSpacing: '.08em' }}>
          VIBESCHOOL ORIGINALS · GRADE 1
        </div>
        <h1 style={{ fontSize: 'clamp(25px,4vw,38px)', lineHeight: 1.14, margin: '7px 0 10px' }}>
          Creative Activities
        </h1>
        <p style={{ lineHeight: 1.6, margin: 0, color: '#496456' }}>
          Learn through movement, music and art. This is the shared VibeSchool curriculum activity library
          for learners, families and teachers — no PDF needed.
        </p>
      </header>

      <nav aria-label="Creative Activities topics" style={{ marginBottom: 16 }}>
        <label htmlFor="creative-activities-topic" style={{ display: 'block', fontSize: 13, fontWeight: 750, marginBottom: 7 }}>
          Choose a topic
        </label>
        <select
          id="creative-activities-topic"
          value={unit.id}
          onChange={event => setSelectedId(event.target.value)}
          style={{ display: 'block', boxSizing: 'border-box', width: '100%', minHeight: 48, borderRadius: 10, border: '1px solid #a6bcae', background: '#fff', color: '#183b2b', padding: '10px 12px', fontSize: 15 }}
        >
          {GRADE1_CREATIVE_STRANDS.map(strand => (
            <optgroup key={strand.id} label={strand.title}>
              {GRADE1_CREATIVE_UNITS.filter(item => item.strand === strand.id).map(item => (
                <option key={item.id} value={item.id}>{item.id} {item.title}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </nav>

      <section aria-label="Published VibeSchool lessons" style={{ ...sectionStyle, marginBottom: 18, borderColor: '#b3d7c3', background: '#f7fcf9' }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', color: '#176348' }}>
          VIBESCHOOL ORIGINALS · READY TO READ
        </div>
        <h2 style={{ fontSize: 22, margin: '6px 0 8px' }}>{unit.title} lessons</h2>
        {lessons.length ? (
          <>
            <p style={{ ...paragraphStyle, marginBottom: 12 }}>Choose a lesson, read it, try the activity, then move to the next one.</p>
            <div role="group" aria-label="Choose your lesson" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {lessons.map(lesson => (
                <button
                  key={lesson.id}
                  type="button"
                  aria-pressed={activeLesson?.id === lesson.id}
                  onClick={() => setSelectedLessonId(lesson.id)}
                  style={{
                    minHeight: 44, padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
                    border: '1px solid #9bb7a5', fontSize: 14, fontWeight: 750,
                    color: activeLesson?.id === lesson.id ? '#fff' : '#175b43',
                    background: activeLesson?.id === lesson.id ? '#175b43' : '#fff',
                  }}
                >
                  {lesson.lessonOrder === 0 ? 'Introduction' : 'Lesson ' + lesson.lessonOrder}
                </button>
              ))}
            </div>
            {activeLesson && (
              <article aria-live="polite" style={{ background: '#fff', border: '1px solid #d0e4d7', borderRadius: 12, padding: 18 }}>
                <h3 style={{ fontSize: 20, margin: '0 0 12px', color: '#164e35' }}>{activeLesson.title}</h3>
                <div style={{ fontSize: 16, whiteSpace: 'pre-wrap', lineHeight: 1.85, color: '#183b2b' }}>{activeLesson.body}</div>
                {activeLessonIndex + 1 < lessons.length && (
                  <button type="button" onClick={() => setSelectedLessonId(lessons[activeLessonIndex + 1].id)}
                    style={{ minHeight: 46, marginTop: 16, background: '#175b43', color: '#fff', border: 0, borderRadius: 10, padding: '9px 18px', fontWeight: 750, cursor: 'pointer' }}>
                    Next lesson
                  </button>
                )}
              </article>
            )}
          </>
        ) : (
          <p role="status" style={paragraphStyle}>
            {loading ? 'Loading published learning materials…'
              : loadError || 'No full lessons are published for this topic yet. The curriculum activities below are available.'}
          </p>
        )}
      </section>

      <div role="group" aria-label="Reading mode" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {([{ id: 'learn', label: 'Learn and try' }, { id: 'teach', label: 'Teacher guide' }] as const).map(option => (
          <button
            key={option.id} type="button" aria-pressed={view === option.id}
            onClick={() => setView(option.id)}
            style={{ flex: 1, minHeight: 46, border: '1px solid #9bb7a5', borderRadius: 10, cursor: 'pointer', background: view === option.id ? '#175b43' : '#fff', color: view === option.id ? '#fff' : '#175b43', fontWeight: 750 }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {view === 'teach' ? (
        <Grade1CreativeActivitiesMap key={unit.id} compact selectedUnitId={unit.id} />
      ) : (
        <section aria-label={unit.title + ' learning activities'} style={{ display: 'grid', gap: 14 }}>
          <div style={{ borderRadius: 16, padding: 20, background: '#eaf5ef', border: '1px solid #c8ded1' }}>
            <div style={{ fontSize: 11, fontWeight: 750, letterSpacing: '.08em', color: '#24664a' }}>
              {GRADE1_CREATIVE_STRANDS.find(strand => strand.id === unit.strand)?.title}
            </div>
            <h2 style={{ fontSize: 25, margin: '6px 0 8px' }}>{unit.title}</h2>
            <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              Explore this topic with a teacher, parent or another responsible adult.
            </p>
          </div>

          <article style={sectionStyle}>
            <h3 style={headingStyle}>Let's learn</h3>
            <ul style={listStyle}>
              {unit.outcomes.map((outcome, index) => <li key={index} style={itemStyle}>{outcome}</li>)}
            </ul>
          </article>
          <article style={sectionStyle}>
            <h3 style={headingStyle}>Try these activities</h3>
            <ol style={listStyle}>
              {unit.experiences.map((experience, index) => <li key={index} style={itemStyle}>{experience}</li>)}
            </ol>
          </article>
          <article style={sectionStyle}>
            <h3 style={headingStyle}>Talk about it</h3>
            <ul style={listStyle}>
              {unit.inquiry.map((question, index) => <li key={index} style={itemStyle}>{question}</li>)}
            </ul>
          </article>
          <article style={sectionStyle}>
            <h3 style={headingStyle}>What you need</h3>
            <p style={paragraphStyle}>{unit.resources}</p>
          </article>
          {unit.safety && <aside style={{ ...sectionStyle, background: '#fff8eb' }}>
            <h3 style={headingStyle}>Stay safe</h3>
            <p style={paragraphStyle}>{unit.safety}</p>
          </aside>}
        </section>
      )}

      <p style={{ fontSize: 12, marginTop: 16, lineHeight: 1.5, color: '#65786d' }}>
        VibeSchool-original curriculum guidance · VS-CUR-G01-CA-2026.
        Only certified learner manuscripts are shown. This content is VibeSchool-original, not an official KICD publication.
      </p>
    </main>
  )
}

const sectionStyle = {
  border: '1px solid #e0e8e2',
  borderRadius: 14,
  background: '#fff',
  padding: 18,
} as const
const headingStyle = { fontSize: 17, margin: '0 0 9px' } as const
const paragraphStyle = { fontSize: 14, lineHeight: 1.7, margin: 0 } as const
const listStyle = { paddingLeft: 21, margin: 0 } as const
const itemStyle = { lineHeight: 1.7, paddingBottom: 7, fontSize: 14 } as const

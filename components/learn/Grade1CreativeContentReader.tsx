'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Grade1CreativeActivitiesMap, {
  GRADE1_CREATIVE_STRANDS,
  GRADE1_CREATIVE_UNITS,
} from '@/components/teacher/curriculum/Grade1CreativeActivitiesMap'

type View = 'learn' | 'teach'
type CreativeRoot = {
  id: string
  title: string
  sub_strand_id: string | null
  asset_kind: string | null
  canonical_key: string | null
}

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
  const unit = GRADE1_CREATIVE_UNITS.find(item => item.id === selectedId) ?? GRADE1_CREATIVE_UNITS[0]

  useEffect(() => {
    let cancelled = false

    async function loadCertifiedResources() {
      try {
        // An anonymous visitor can read the public curriculum guidance,
        // but only authenticated, RLS-authorised users can query versions.
        const { data: auth } = await supabase.auth.getUser()
        if (!auth.user) return

        const [{ data: strands, error: strandError }, { data: roots, error: rootError }] = await Promise.all([
          supabase.from('cbc_strands')
            .select('id,source_ref')
            .like('source_ref', 'VS-CUR-G01-CA-2026#%'),
          supabase.from('learning_resources')
            .select('*')
            .eq('grade', 'Grade 1')
            .eq('subject', 'Creative Activities')
            .eq('status', 'active')
            .filter('asset_kind', 'in', '(learner_notes,worksheet)')
            .limit(100),
        ])
        if (strandError || rootError || !roots?.length) return

        const unitByStrand = new Map(
          (strands ?? []).map(row => [row.id, row.source_ref?.split('#')[1] ?? '']),
        )
        // These columns exist in production but are not yet in generated database.types.ts.
        // Keep the typed projection local rather than changing the shared schema contract.
        const eligible = (roots as CreativeRoot[]).filter(root =>
          root.sub_strand_id && unitByStrand.has(root.sub_strand_id)
          && (root.asset_kind === 'learner_notes' || root.asset_kind === 'worksheet'),
        )
        if (!eligible.length) return

        const { data: versions, error: versionsError } = await supabase
          .from('learning_resource_versions')
          .select('id,resource_id,payload,certified_at')
          .in('resource_id', eligible.map(root => root.id))
          .eq('lifecycle_status', 'certified')
          .not('certified_at', 'is', null)
          .order('certified_at', { ascending: false })
        if (versionsError || !versions?.length) return

        const rootsById = new Map(eligible.map(root => [root.id, root]))
        const chosen = new Set<string>()
        const next: ReleasedResource[] = []
        for (const version of versions) {
          if (chosen.has(version.resource_id)) continue
          const root = rootsById.get(version.resource_id)
          if (!root || !root.sub_strand_id) continue
          const payload = version.payload
          if (!payload || typeof payload !== 'object' || Array.isArray(payload)) continue
          const data = payload as Record<string, unknown>
          const body = typeof data.content_text === 'string'
            ? data.content_text
            : typeof data.body === 'string' ? data.body : ''
          if (!body.trim()) continue
          const unitId = unitByStrand.get(root.sub_strand_id) ?? ''
          if (!GRADE1_CREATIVE_UNITS.some(item => item.id === unitId)) continue
          const orderMatch = typeof root.canonical_key === 'string'
            ? /:lesson:(\d+)$/.exec(root.canonical_key) : null
          chosen.add(version.resource_id)
          next.push({
            id: version.id,
            title: root.title,
            unitId,
            assetKind: root.asset_kind ?? 'learner_notes',
            body,
            lessonOrder: orderMatch ? Number(orderMatch[1]) : 999,
          })
        }
        if (!cancelled) setReleased(next)
      } catch {
        // Editorial and access errors must never expose unpublished versions.
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

      <section aria-label="Published learning material" style={{ ...sectionStyle, marginTop: 18 }}>
        <h2 style={{ fontSize: 19, margin: '0 0 9px' }}>Learning materials</h2>
        {lessons.length ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {lessons.map(lesson => (
              <article key={lesson.id} style={{ borderTop: '1px solid #e1e9e2', paddingTop: 12 }}>
                <h3 style={{ fontSize: 16, margin: '0 0 8px' }}>{lesson.title}</h3>
                <p style={{ ...paragraphStyle, whiteSpace: 'pre-wrap' }}>{lesson.body}</p>
              </article>
            ))}
          </div>
        ) : (
          <p style={paragraphStyle}>
            {loading ? 'Checking for published learning materials…'
              : 'There are no certified lesson notes published for this topic yet. The curriculum activities above are available now.'}
          </p>
        )}
      </section>
      <p style={{ fontSize: 12, marginTop: 16, lineHeight: 1.5, color: '#65786d' }}>
        VibeSchool-original curriculum guidance · VS-CUR-G01-CA-2026.
        Official KICD source-to-outcome reconciliation remains pending. Draft manuscripts are not published.
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

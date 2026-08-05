'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { loadBuilderAssessment, type BuilderAssessment } from '@/lib/assessment/builder'
import {
  publishAssessment,
  validateAssessment,
  type AssessmentValidationResult,
} from '@/lib/assessment/authoring'

export default function AssessmentPreviewPage() {
  const params = useParams<{ assessmentId: string }>()
  const router = useRouter()
  const [assessment, setAssessment] = useState<BuilderAssessment | null>(null)
  const [validation, setValidation] = useState<AssessmentValidationResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [builder, checked] = await Promise.all([
        loadBuilderAssessment(params.assessmentId),
        validateAssessment(params.assessmentId),
      ])
      setAssessment(builder)
      setValidation(checked)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load assessment preview.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [params.assessmentId])

  async function publish() {
    if (!validation?.valid || publishing) return
    setPublishing(true)
    setError('')
    try {
      await publishAssessment(params.assessmentId)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Assessment could not be published.')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <main style={shell}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <section style={card}>
          <div style={eyebrow}>Assessment Builder</div>
          <h1 style={{ margin: '6px 0' }}>Preview and Validate</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>Review the learner experience and resolve every publish blocker.</p>
        </section>

        {error && <section style={{ ...card, color: '#b91c1c' }}>{error}</section>}

        {loading ? (
          <section style={card}>Loading preview…</section>
        ) : !assessment || !validation ? null : (
          <>
            <section style={{ ...card, borderColor: validation.valid ? '#a7f3d0' : '#fecaca' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <strong>{validation.valid ? 'Ready to publish' : 'Publish blocked'}</strong>
                  <div style={muted}>{validation.itemCount} questions · {validation.totalMarks} marks</div>
                </div>
                <span style={{ ...pill, background: validation.valid ? '#ecfdf5' : '#fef2f2', color: validation.valid ? '#065f46' : '#b91c1c' }}>
                  {validation.valid ? 'Valid' : `${validation.issues.length} issues`}
                </span>
              </div>

              {validation.issues.length > 0 && (
                <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                  {validation.issues.map(issue => (
                    <div key={issue.code} style={issueBox}>{issue.message}</div>
                  ))}
                </div>
              )}
            </section>

            <section style={paper}>
              <div style={{ textAlign: 'center', borderBottom: '2px solid #111827', paddingBottom: 14, marginBottom: 18 }}>
                <div style={eyebrow}>{assessment.assessmentType.replaceAll('_', ' ')}</div>
                <h2 style={{ margin: '6px 0' }}>{assessment.title}</h2>
                <div style={muted}>{validation.totalMarks} marks{assessment.estimatedMinutes ? ` · ${assessment.estimatedMinutes} minutes` : ''}</div>
              </div>

              {assessment.instructions && (
                <div style={{ ...issueBox, background: '#f8fafc', color: '#374151', marginBottom: 18 }}>
                  <strong>Instructions</strong>
                  <div style={{ marginTop: 4 }}>{assessment.instructions}</div>
                </div>
              )}

              {assessment.sections.map((section, sectionIndex) => (
                <div key={section.id} style={{ marginBottom: 24 }}>
                  <h3 style={{ marginBottom: 4 }}>Section {sectionIndex + 1}: {section.title}</h3>
                  {section.instructions && <p style={{ color: '#4b5563' }}>{section.instructions}</p>}
                  {section.items.map((item, itemIndex) => (
                    <div key={item.id} style={questionBox}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <strong>{itemIndex + 1}. {item.prompt}</strong>
                        <span>[{item.marks}]</span>
                      </div>
                      <div style={{ ...muted, marginTop: 8 }}>{item.questionType.replaceAll('_', ' ')}</div>
                    </div>
                  ))}
                </div>
              ))}

              {assessment.unsectionedItems.length > 0 && (
                <div>
                  <h3>Questions</h3>
                  {assessment.unsectionedItems.map((item, itemIndex) => (
                    <div key={item.id} style={questionBox}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <strong>{itemIndex + 1}. {item.prompt}</strong>
                        <span>[{item.marks}]</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => router.push(`/teacher/assessment/builder/${assessment.id}`)} style={{ ...secondaryButton, flex: 1 }}>Back to Builder</button>
              <button type="button" disabled={!validation.valid || publishing || assessment.status === 'approved'} onClick={() => void publish()} style={{ ...primaryButton, flex: 1, opacity: !validation.valid || assessment.status === 'approved' ? 0.5 : 1 }}>
                {assessment.status === 'approved' ? 'Published' : publishing ? 'Publishing…' : 'Publish Assessment'}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

const shell: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 80px', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827' }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, marginBottom: 12 }
const paper: React.CSSProperties = { background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, padding: 24, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 1 }
const muted: React.CSSProperties = { fontSize: 12, color: '#6b7280', marginTop: 3 }
const pill: React.CSSProperties = { fontSize: 11, fontWeight: 800, borderRadius: 99, padding: '5px 9px' }
const issueBox: React.CSSProperties = { border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 10, padding: 10, lineHeight: 1.5 }
const questionBox: React.CSSProperties = { borderBottom: '1px solid #e5e7eb', padding: '12px 0', lineHeight: 1.55 }
const primaryButton: React.CSSProperties = { border: 'none', borderRadius: 12, padding: '12px 16px', background: '#4338ca', color: '#fff', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }
const secondaryButton: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 12, padding: '12px 16px', background: '#fff', color: '#374151', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }

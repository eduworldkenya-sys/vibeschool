'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  addQuestionBankItemToAssessment,
  approveQuestionBankItem,
  listQuestionBank,
  promoteAssessmentItemToQuestionBank,
  type QuestionBankItem,
} from '@/lib/assessment'
import {
  createBuilderSection,
  deleteBuilderSection,
  loadBuilderAssessment,
  moveBuilderItem,
  reorderBuilderSections,
  updateBuilderSection,
  type BuilderAssessment,
  type BuilderItemSummary,
  type BuilderSection,
} from '@/lib/assessment/builder'

export default function AssessmentBuilderPage() {
  const params = useParams<{ assessmentId: string }>()
  const assessmentId = params.assessmentId
  const [assessment, setAssessment] = useState<BuilderAssessment | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [editing, setEditing] = useState<Record<string, { title: string; instructions: string; minutes: string }>>({})
  const [bankOpen, setBankOpen] = useState(false)
  const [bankSearch, setBankSearch] = useState('')
  const [bankLoading, setBankLoading] = useState(false)
  const [bankItems, setBankItems] = useState<QuestionBankItem[]>([])
  const [bankActionId, setBankActionId] = useState<string | null>(null)
  const [bankMessage, setBankMessage] = useState('')

  const isGrounded = Boolean(assessment && assessment.generationSource !== 'teacher_authored')
  const allItems = useMemo(
    () => assessment
      ? [...assessment.sections.flatMap(section => section.items), ...assessment.unsectionedItems]
      : [],
    [assessment],
  )

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      setAssessment(await loadBuilderAssessment(assessmentId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load Assessment Builder.')
    } finally {
      setLoading(false)
    }
  }

  async function refreshBank(search = bankSearch) {
    setBankLoading(true)
    setBankMessage('')
    try {
      const rows = await listQuestionBank({
        search,
        subjectId: assessment?.subjectId ?? null,
        limit: 50,
      })
      setBankItems(isGrounded ? rows.filter(item => Boolean(item.learningOutcomeId)) : rows)
    } catch (cause) {
      setBankMessage(cause instanceof Error ? cause.message : 'Question Bank could not be loaded.')
    } finally {
      setBankLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [assessmentId])

  async function addSection() {
    if (!newTitle.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      await createBuilderSection({ assessmentId, title: newTitle.trim() })
      setNewTitle('')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Section could not be created.')
    } finally {
      setBusy(false)
    }
  }

  function startEditing(section: BuilderSection) {
    setEditing(current => ({
      ...current,
      [section.id]: {
        title: section.title,
        instructions: section.instructions ?? '',
        minutes: section.estimatedMinutes === null ? '' : String(section.estimatedMinutes),
      },
    }))
  }

  async function saveSection(sectionId: string) {
    const draft = editing[sectionId]
    if (!draft?.title.trim()) return
    setBusy(true)
    setError('')
    try {
      await updateBuilderSection({
        sectionId,
        title: draft.title.trim(),
        instructions: draft.instructions.trim() || null,
        estimatedMinutes: draft.minutes ? Number(draft.minutes) : null,
      })
      setEditing(current => {
        const next = { ...current }
        delete next[sectionId]
        return next
      })
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Section could not be updated.')
    } finally {
      setBusy(false)
    }
  }

  async function moveSection(sectionId: string, direction: -1 | 1) {
    if (!assessment) return
    const ordered = [...assessment.sections].sort((a, b) => a.displayOrder - b.displayOrder)
    const index = ordered.findIndex(section => section.id === sectionId)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return
    ;[ordered[index], ordered[nextIndex]] = [ordered[nextIndex], ordered[index]]
    setBusy(true)
    try {
      await reorderBuilderSections(assessment.id, ordered.map(section => section.id))
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sections could not be reordered.')
    } finally {
      setBusy(false)
    }
  }

  async function removeSection(sectionId: string) {
    if (!confirm('Delete this section? Its questions will become unsectioned.')) return
    setBusy(true)
    try {
      await deleteBuilderSection(sectionId)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Section could not be deleted.')
    } finally {
      setBusy(false)
    }
  }

  async function placeItem(itemId: string, sectionId: string | null) {
    setBusy(true)
    try {
      await moveBuilderItem({ assessmentItemId: itemId, sectionId })
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Question could not be moved.')
    } finally {
      setBusy(false)
    }
  }

  async function saveItemToBank(item: BuilderItemSummary) {
    if (bankActionId) return
    if (isGrounded && item.outcomeCount !== 1) {
      setBankMessage('This grounded question spans multiple or missing outcomes, so it cannot become one reusable Question Bank item without changing its curriculum meaning.')
      return
    }
    setBankActionId(item.id)
    setBankMessage('')
    try {
      const promoted = await promoteAssessmentItemToQuestionBank({ assessmentItemId: item.id })
      await approveQuestionBankItem(promoted.questionId)
      setBankMessage(promoted.created ? 'Question saved and approved in the Question Bank.' : 'Question already exists in the Question Bank.')
      if (bankOpen) await refreshBank()
    } catch (cause) {
      setBankMessage(cause instanceof Error ? cause.message : 'Question could not be saved to the Question Bank.')
    } finally {
      setBankActionId(null)
    }
  }

  async function reuseBankItem(questionId: string) {
    if (!assessment || bankActionId) return
    setBankActionId(questionId)
    setBankMessage('')
    try {
      await addQuestionBankItemToAssessment({
        questionId,
        assessmentId: assessment.id,
        orderNum: allItems.length + 1,
      })
      await refresh()
      await refreshBank()
      setBankMessage('Question added to this assessment draft with its curriculum lineage preserved.')
    } catch (cause) {
      setBankMessage(cause instanceof Error ? cause.message : 'Question could not be added to this assessment.')
    } finally {
      setBankActionId(null)
    }
  }

  function renderQuestionActions(item: BuilderItemSummary) {
    const bankEligible = !isGrounded || item.outcomeCount === 1
    return (
      <button
        type="button"
        disabled={Boolean(bankActionId) || !bankEligible}
        onClick={() => void saveItemToBank(item)}
        title={bankEligible ? 'Save this question for reuse' : 'Grounded Question Bank items must represent exactly one curriculum outcome'}
        style={{ ...bankButton, opacity: bankEligible ? 1 : 0.5, cursor: bankEligible ? 'pointer' : 'not-allowed' }}
      >
        {bankActionId === item.id ? 'Saving…' : bankEligible ? 'Save to Bank' : 'Multi-outcome'}
      </button>
    )
  }

  return (
    <main style={shell}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <section style={card}>
          <div style={eyebrow}>Assessment Builder · Advanced</div>
          <h1 style={{ margin: '6px 0' }}>{assessment?.title ?? 'Assessment'}</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>
            Organize questions and reuse compatible Question Bank items. Curriculum grounding is preserved automatically.
          </p>
          {isGrounded && (
            <div style={{ ...emptyBox, marginTop: 10 }}>
              Grounded assessment: Question Bank results are restricted to this subject and to questions with curriculum outcome lineage.
            </div>
          )}
        </section>

        {error && <section style={{ ...card, color: '#b91c1c' }}>{error}</section>}
        {bankMessage && <section style={{ ...card, color: bankMessage.includes('could not') || bankMessage.includes('cannot') ? '#b91c1c' : '#065f46' }}>{bankMessage}</section>}

        {loading ? (
          <section style={card}>Loading builder…</section>
        ) : !assessment ? null : (
          <>
            <section style={card}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
                <input value={newTitle} onChange={event => setNewTitle(event.target.value)} placeholder="New section title" style={input} />
                <button type="button" disabled={busy || !newTitle.trim()} onClick={() => void addSection()} style={primaryButton}>Add section</button>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !bankOpen
                  setBankOpen(next)
                  if (next && bankItems.length === 0) void refreshBank('')
                }}
                style={{ ...secondaryButton, width: '100%', marginTop: 10 }}
              >
                {bankOpen ? 'Hide Question Bank' : 'Open Question Bank'}
              </button>
            </section>

            {bankOpen && (
              <section style={card}>
                <div style={eyebrow}>Compatible Question Bank</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginTop: 10 }}>
                  <input value={bankSearch} onChange={event => setBankSearch(event.target.value)} placeholder="Search approved questions" style={input} />
                  <button type="button" onClick={() => void refreshBank()} disabled={bankLoading} style={secondaryButton}>{bankLoading ? 'Searching…' : 'Search'}</button>
                </div>
                <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                  {!bankLoading && bankItems.length === 0 ? (
                    <div style={emptyBox}>No compatible approved Question Bank items match this search.</div>
                  ) : bankItems.map(bankItem => (
                    <div key={bankItem.id} style={itemRow}>
                      <div style={{ flex: 1 }}>
                        <strong>{bankItem.questionText}</strong>
                        <div style={muted}>
                          {bankItem.questionType.replaceAll('_', ' ')} · {bankItem.marks} marks
                          {bankItem.difficulty ? ` · ${bankItem.difficulty}` : ''}
                          {bankItem.bloomLevel ? ` · ${bankItem.bloomLevel}` : ''}
                          {bankItem.learningOutcomeId ? ' · outcome-linked' : ''}
                          {` · used ${bankItem.usageCount} times`}
                        </div>
                      </div>
                      <button type="button" disabled={Boolean(bankActionId)} onClick={() => void reuseBankItem(bankItem.id)} style={primaryButton}>
                        {bankActionId === bankItem.id ? 'Adding…' : 'Add'}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {assessment.sections.map((section, index) => {
              const draft = editing[section.id]
              return (
                <section key={section.id} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      {draft ? (
                        <div style={{ display: 'grid', gap: 8 }}>
                          <input value={draft.title} onChange={event => setEditing(current => ({ ...current, [section.id]: { ...draft, title: event.target.value } }))} style={input} />
                          <textarea value={draft.instructions} onChange={event => setEditing(current => ({ ...current, [section.id]: { ...draft, instructions: event.target.value } }))} rows={2} style={{ ...input, resize: 'vertical' }} />
                          <input type="number" min={1} value={draft.minutes} onChange={event => setEditing(current => ({ ...current, [section.id]: { ...draft, minutes: event.target.value } }))} placeholder="Estimated minutes" style={input} />
                          <button type="button" disabled={busy} onClick={() => void saveSection(section.id)} style={primaryButton}>Save section</button>
                        </div>
                      ) : (
                        <>
                          <div style={eyebrow}>Section {index + 1}</div>
                          <h2 style={{ margin: '5px 0' }}>{section.title}</h2>
                          {section.instructions && <p style={{ color: '#6b7280' }}>{section.instructions}</p>}
                          <div style={muted}>{section.items.length} questions · {section.items.reduce((sum, item) => sum + item.marks, 0)} marks{section.estimatedMinutes ? ` · ${section.estimatedMinutes} min` : ''}</div>
                        </>
                      )}
                    </div>
                    {!draft && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button type="button" disabled={busy || index === 0} onClick={() => void moveSection(section.id, -1)} style={smallButton}>↑</button>
                        <button type="button" disabled={busy || index === assessment.sections.length - 1} onClick={() => void moveSection(section.id, 1)} style={smallButton}>↓</button>
                        <button type="button" onClick={() => startEditing(section)} style={smallButton}>Edit</button>
                        <button type="button" onClick={() => void removeSection(section.id)} style={{ ...smallButton, color: '#b91c1c' }}>Delete</button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
                    {section.items.length === 0 ? <div style={emptyBox}>No questions in this section.</div> : section.items.map(item => (
                      <div key={item.id} style={itemRow}>
                        <div style={{ flex: 1 }}><strong>{item.orderNum}. {item.prompt}</strong><div style={muted}>{item.questionType.replaceAll('_', ' ')} · {item.marks} marks · {item.outcomeCount} outcome link{item.outcomeCount === 1 ? '' : 's'}</div></div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {renderQuestionActions(item)}
                          <select disabled={busy} value={section.id} onChange={event => void placeItem(item.id, event.target.value || null)} style={select}>
                            <option value="">Unsectioned</option>
                            {assessment.sections.map(option => <option key={option.id} value={option.id}>{option.title}</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}

            <section style={card}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>Unsectioned questions</h2>
              {assessment.unsectionedItems.length === 0 ? <div style={emptyBox}>All questions are organized into sections.</div> : assessment.unsectionedItems.map(item => (
                <div key={item.id} style={itemRow}>
                  <div style={{ flex: 1 }}><strong>{item.orderNum}. {item.prompt}</strong><div style={muted}>{item.questionType.replaceAll('_', ' ')} · {item.marks} marks · {item.outcomeCount} outcome link{item.outcomeCount === 1 ? '' : 's'}</div></div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {renderQuestionActions(item)}
                    <select disabled={busy} value="" onChange={event => void placeItem(item.id, event.target.value || null)} style={select}>
                      <option value="">Choose section</option>
                      {assessment.sections.map(section => <option key={section.id} value={section.id}>{section.title}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  )
}

const shell: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 80px', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827' }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 1 }
const muted: React.CSSProperties = { fontSize: 12, color: '#6b7280', marginTop: 3 }
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 12px', font: 'inherit' }
const select: React.CSSProperties = { minWidth: 150, border: '1px solid #d1d5db', borderRadius: 9, padding: '8px 10px', background: '#fff', font: 'inherit' }
const primaryButton: React.CSSProperties = { border: 'none', borderRadius: 10, padding: '10px 14px', background: '#4338ca', color: '#fff', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }
const secondaryButton: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 14px', background: '#fff', color: '#374151', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }
const smallButton: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 8, padding: '7px 9px', background: '#fff', fontWeight: 700, cursor: 'pointer' }
const bankButton: React.CSSProperties = { border: '1px solid #0f766e', borderRadius: 8, padding: '7px 9px', background: '#f0fdfa', color: '#0f766e', fontWeight: 800, cursor: 'pointer' }
const itemRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }
const emptyBox: React.CSSProperties = { border: '1px dashed #cbd5e1', borderRadius: 10, padding: 14, color: '#6b7280' }

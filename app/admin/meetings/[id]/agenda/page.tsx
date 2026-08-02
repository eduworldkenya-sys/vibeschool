"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getMeeting, upsertAgendaItem } from '@/lib/meetings'

const C = {
  hero: '#0a1628',
  emerald: '#10b981',
  navy3: '#0f5fa8',
  bg: '#f0f4f8',
  border: '#e2e8f0',
  muted: '#64748b',
  surface: '#ffffff',
  text: '#1e293b',
  red: '#ef4444',
  white: '#ffffff',
}

type AgendaStatus = 'pending' | 'in_progress' | 'done' | 'carried_forward'

interface AgendaItem {
  id: string
  meeting_id: string
  title: string
  description: string | null
  duration_mins: number | null
  order_index: number
  presenter_id: string | null
  status: AgendaStatus
  notes: string | null
  created_at: string
  presenter?: { id: string; full_name: string } | null
}

interface Profile {
  id: string
  full_name: string
}

interface Meeting {
  id: string
  title: string
  duration_mins: number | null
  school_id: string
}

const DURATION_PILLS = [5, 10, 15, 20, 30]

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 16, height: 16,
      border: '2px solid rgba(255,255,255,0.3)',
      borderTopColor: C.white, borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}

function fmtMins(mins: number) {
  if (mins < 60) return `${mins}min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}hr ${m}min` : `${h}hr`
}

export default function AgendaBuilderPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [items, setItems] = useState<AgendaItem[]>([])
  const [attendees, setAttendees] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add form
  const [addTitle, setAddTitle] = useState('')
  const [addDuration, setAddDuration] = useState<number | null>(null)
  const [addDurationCustom, setAddDurationCustom] = useState('')
  const [addDurationMode, setAddDurationMode] = useState<number | 'custom' | null>(null)
  const [addPresenterQuery, setAddPresenterQuery] = useState('')
  const [addPresenterFocused, setAddPresenterFocused] = useState(false)
  const [addPresenter, setAddPresenter] = useState<Profile | null>(null)
  const [addDesc, setAddDesc] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Expand/edit
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editFields, setEditFields] = useState<Partial<AgendaItem>>({})
  const [editPresenterQuery, setEditPresenterQuery] = useState('')
  const [editPresenterFocused, setEditPresenterFocused] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Drag
  const dragIdx = useRef<number | null>(null)
  const dragOverIdx = useRef<number | null>(null)
  const [reordering, setReordering] = useState(false)

  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`
    document.head.appendChild(style)
    return () => { document.head.removeChild(style) }
  }, [])

  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/admin/login'); return }

        const mtg = await getMeeting(id)
        setMeeting(mtg as Meeting)

        await loadItems()

        // Load attendees for this meeting
        const { data: att, error: attErr } = await supabase
          .from('meeting_attendees')
          .select('profile_id, profiles:profile_id(id, full_name)')
          .eq('meeting_id', id)
        if (attErr) throw attErr
        const profiles: Profile[] = (att ?? [])
          .map(a => a.profiles)
          .filter((profile): profile is Profile => profile !== null)
        setAttendees(profiles)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadItems() {
    const { data, error: e } = await supabase
      .from('meeting_agenda_items')
      .select('*, presenter:presenter_id(id, full_name)')
      .eq('meeting_id', id)
      .order('order_index')
    if (e) throw e
    setItems((data ?? []) as AgendaItem[])
  }

  const totalMins = items.reduce((s, i) => s + (i.duration_mins ?? 0), 0)
  const plannedMins = meeting?.duration_mins ?? 0
  const overLimit = plannedMins > 0 && totalMins > plannedMins
  const progressPct = plannedMins > 0 ? Math.min((totalMins / plannedMins) * 100, 100) : 0

  const filteredAddPresenters = attendees.filter(p =>
    p.full_name.toLowerCase().includes(addPresenterQuery.toLowerCase())
  )
  const filteredEditPresenters = attendees.filter(p =>
    p.full_name.toLowerCase().includes(editPresenterQuery.toLowerCase())
  )

  async function handleAdd() {
    if (!addTitle.trim()) { setAddError('Title is required'); return }
    const dur = addDurationMode === 'custom'
      ? (parseInt(addDurationCustom) || null)
      : (addDurationMode ?? null)
    setAdding(true); setAddError(null)
    try {
      const nextOrder = items.length > 0 ? Math.max(...items.map(i => i.order_index)) + 1 : 1
      await upsertAgendaItem({
        meeting_id: id,
        title: addTitle.trim(),
        description: addDesc.trim() || null,
        duration_mins: dur,
        order_index: nextOrder,
        presenter_id: addPresenter?.id ?? null,
        status: 'pending',
      })
      setAddTitle(''); setAddDesc(''); setAddDurationMode(null)
      setAddDuration(null); setAddDurationCustom('')
      setAddPresenter(null); setAddPresenterQuery('')
      await loadItems()
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : 'Failed to add')
    } finally {
      setAdding(false)
    }
  }

  function openEdit(item: AgendaItem) {
    setExpandedId(item.id)
    setEditFields({
      title: item.title,
      description: item.description,
      duration_mins: item.duration_mins,
      presenter_id: item.presenter_id,
      notes: item.notes,
    })
    setEditPresenterQuery(item.presenter?.full_name ?? '')
  }

  async function saveEdit(item: AgendaItem) {
    setSaving(item.id)
    try {
      await upsertAgendaItem({ id: item.id, meeting_id: id, ...editFields })
      await loadItems()
      setExpandedId(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(null)
    }
  }

  async function handleDelete(itemId: string) {
    setDeleting(true)
    try {
      const { error: e } = await supabase
        .from('meeting_agenda_items')
        .delete()
        .eq('id', itemId)
      if (e) throw e
      setDeleteId(null)
      await loadItems()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  function onDragStart(idx: number) { dragIdx.current = idx }
  function onDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); dragOverIdx.current = idx }

  async function onDrop() {
    const from = dragIdx.current
    const to = dragOverIdx.current
    if (from === null || to === null || from === to) { dragIdx.current = null; dragOverIdx.current = null; return }
    const reordered = [...items]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    const updated = reordered.map((item, idx) => ({ ...item, order_index: idx + 1 }))
    setItems(updated)
    dragIdx.current = null; dragOverIdx.current = null
    setReordering(true)
    try {
      for (const item of updated) {
        const { error: e } = await supabase
          .from('meeting_agenda_items')
          .update({ order_index: item.order_index })
          .eq('id', item.id)
        if (e) throw e
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Reorder failed')
      await loadItems()
    } finally {
      setReordering(false)
    }
  }

  const statusColor: Record<AgendaStatus, { color: string; bg: string }> = {
    pending: { color: C.muted, bg: '#f1f5f9' },
    in_progress: { color: C.navy3, bg: '#eff6ff' },
    done: { color: C.emerald, bg: '#f0fdf4' },
    carried_forward: { color: '#f59e0b', bg: '#fffbeb' },
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner />
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: 24 }}>
      <div style={{ background: '#fef2f2', border: `1px solid #fecaca`, borderRadius: 12, padding: 16, color: C.red }}>{error}</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingBottom: 100 }}>

      {/* Sticky Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: C.hero, padding: '0 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        height: 56, boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}>
        <button
          onClick={() => router.push(`/admin/meetings/${id}`)}
          style={{ background: 'none', border: 'none', color: C.white, cursor: 'pointer', padding: 4, fontSize: 20, lineHeight: 1 }}
        >←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: C.white, fontWeight: 700, fontSize: 16 }}>Agenda</div>
          {meeting && (
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {meeting.title}
            </div>
          )}
        </div>
        {reordering && <Spinner />}
      </div>

      <div style={{ padding: '16px 16px 0' }}>

        {/* Total time bar */}
        <div style={{ background: C.surface, borderRadius: 12, padding: 14, marginBottom: 16, border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Time</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: overLimit ? C.red : C.text }}>
              {fmtMins(totalMins)}{plannedMins > 0 ? ` of ${fmtMins(plannedMins)} planned` : ''}
            </span>
          </div>
          {plannedMins > 0 && (
            <div style={{ height: 6, background: C.border, borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 99,
                width: `${progressPct}%`,
                background: overLimit ? C.red : C.emerald,
                transition: 'width 0.3s ease',
              }} />
            </div>
          )}
          {overLimit && (
            <div style={{ fontSize: 11, color: C.red, marginTop: 6 }}>
              ⚠ Agenda exceeds planned duration by {fmtMins(totalMins - plannedMins)}
            </div>
          )}
        </div>

        {/* Agenda items */}
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.muted, fontSize: 14, padding: '32px 0' }}>No agenda items yet</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {items.map((item, idx) => {
              const sc = statusColor[item.status]
              const isExpanded = expandedId === item.id
              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => onDragStart(idx)}
                  onDragOver={e => onDragOver(e, idx)}
                  onDrop={onDrop}
                  style={{
                    background: C.surface, borderRadius: 12,
                    border: `1px solid ${C.border}`,
                    overflow: 'hidden',
                  }}
                >
                  {/* Card header */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px 12px 10px', cursor: 'pointer' }}
                    onClick={() => isExpanded ? setExpandedId(null) : openEdit(item)}
                  >
                    {/* Drag handle */}
                    <span style={{ color: C.muted, fontSize: 18, cursor: 'grab', userSelect: 'none', flexShrink: 0 }}>⠿</span>
                    {/* Order badge */}
                    <div style={{
                      width: 22, height: 22, borderRadius: 99,
                      background: C.hero, color: C.white,
                      fontSize: 11, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>{idx + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center', flexWrap: 'wrap' }}>
                        {item.duration_mins && (
                          <span style={{ fontSize: 11, background: '#eff6ff', color: C.navy3, borderRadius: 99, padding: '1px 7px', fontWeight: 600 }}>
                            {fmtMins(item.duration_mins)}
                          </span>
                        )}
                        <span style={{ fontSize: 11, background: sc.bg, color: sc.color, borderRadius: 99, padding: '1px 7px', fontWeight: 600 }}>
                          {item.status.replace('_', ' ')}
                        </span>
                        {item.presenter && (
                          <span style={{ fontSize: 11, color: C.muted }}>{item.presenter.full_name}</span>
                        )}
                      </div>
                    </div>
                    {/* Delete */}
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteId(item.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: C.muted, padding: 4, flexShrink: 0 }}
                    >🗑</button>
                  </div>

                  {/* Inline edit */}
                  {isExpanded && (
                    <div style={{ borderTop: `1px solid ${C.border}`, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Title</div>
                        <input
                          value={editFields.title ?? ''}
                          onChange={e => setEditFields(f => ({ ...f, title: e.target.value }))}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, outline: 'none', color: C.text }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Duration (mins)</div>
                        <input
                          type="number"
                          value={editFields.duration_mins ?? ''}
                          onChange={e => setEditFields(f => ({ ...f, duration_mins: parseInt(e.target.value) || null }))}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, outline: 'none', color: C.text }}
                        />
                      </div>
                      {/* Presenter */}
                      <div style={{ position: 'relative' }}>
                        <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Presenter</div>
                        <input
                          value={editPresenterQuery}
                          onChange={e => setEditPresenterQuery(e.target.value)}
                          onFocus={() => setEditPresenterFocused(true)}
                          onBlur={() => setTimeout(() => setEditPresenterFocused(false), 150)}
                          placeholder="Search attendees…"
                          style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, outline: 'none', color: C.text }}
                        />
                        {editPresenterFocused && filteredEditPresenters.length > 0 && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, zIndex: 99, maxHeight: 160, overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
                            {filteredEditPresenters.map(p => (
                              <div key={p.id}
                                onMouseDown={() => { setEditFields(f => ({ ...f, presenter_id: p.id })); setEditPresenterQuery(p.full_name) }}
                                style={{ padding: '10px 14px', fontSize: 14, cursor: 'pointer', color: C.text }}
                              >{p.full_name}</div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Notes</div>
                        <textarea
                          value={editFields.notes ?? ''}
                          onChange={e => setEditFields(f => ({ ...f, notes: e.target.value }))}
                          rows={3}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, outline: 'none', color: C.text, resize: 'vertical', fontFamily: 'inherit' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => setExpandedId(null)}
                          style={{ flex: 1, padding: '10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, cursor: 'pointer', color: C.muted }}
                        >Cancel</button>
                        <button
                          onClick={() => saveEdit(item)}
                          disabled={saving === item.id}
                          style={{ flex: 1, padding: '10px', background: C.emerald, border: 'none', borderRadius: 10, fontSize: 14, cursor: 'pointer', color: C.white, fontWeight: 700 }}
                        >{saving === item.id ? <Spinner /> : 'Save'}</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Add item form */}
        <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Add Agenda Item</div>

          {addError && (
            <div style={{ background: '#fef2f2', border: `1px solid #fecaca`, borderRadius: 8, padding: '8px 12px', color: C.red, fontSize: 13, marginBottom: 10 }}>{addError}</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Title */}
            <div>
              <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Title *</div>
              <input
                value={addTitle}
                onChange={e => setAddTitle(e.target.value)}
                placeholder="Agenda item title"
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, outline: 'none', color: C.text }}
              />
            </div>

            {/* Duration pills */}
            <div>
              <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Duration</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {DURATION_PILLS.map(d => (
                  <button key={d}
                    onClick={() => { setAddDurationMode(d); setAddDuration(d) }}
                    style={{
                      padding: '6px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: `1.5px solid ${addDurationMode === d ? C.emerald : C.border}`,
                      background: addDurationMode === d ? '#f0fdf4' : C.bg,
                      color: addDurationMode === d ? C.emerald : C.muted,
                    }}
                  >{d}min</button>
                ))}
                <button
                  onClick={() => setAddDurationMode('custom')}
                  style={{
                    padding: '6px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: `1.5px solid ${addDurationMode === 'custom' ? C.emerald : C.border}`,
                    background: addDurationMode === 'custom' ? '#f0fdf4' : C.bg,
                    color: addDurationMode === 'custom' ? C.emerald : C.muted,
                  }}
                >Custom</button>
              </div>
              {addDurationMode === 'custom' && (
                <input
                  type="number"
                  value={addDurationCustom}
                  onChange={e => setAddDurationCustom(e.target.value)}
                  placeholder="Minutes"
                  style={{ marginTop: 8, width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, outline: 'none', color: C.text }}
                />
              )}
            </div>

            {/* Presenter */}
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Presenter</div>
              <input
                value={addPresenterQuery}
                onChange={e => { setAddPresenterQuery(e.target.value); if (!e.target.value) setAddPresenter(null) }}
                onFocus={() => setAddPresenterFocused(true)}
                onBlur={() => setTimeout(() => setAddPresenterFocused(false), 150)}
                placeholder="Search attendees…"
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, outline: 'none', color: C.text }}
              />
              {addPresenter && (
                <div style={{ fontSize: 11, color: C.emerald, marginTop: 3 }}>✓ {addPresenter.full_name}</div>
              )}
              {addPresenterFocused && filteredAddPresenters.length > 0 && (
                <div style={{ position: 'absolute', top: 'calc(100% - 2px)', left: 0, right: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, zIndex: 99, maxHeight: 160, overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
                  {filteredAddPresenters.map(p => (
                    <div key={p.id}
                      onMouseDown={() => { setAddPresenter(p); setAddPresenterQuery(p.full_name) }}
                      style={{ padding: '10px 14px', fontSize: 14, cursor: 'pointer', color: C.text }}
                    >{p.full_name}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Description (optional)</div>
              <textarea
                value={addDesc}
                onChange={e => setAddDesc(e.target.value)}
                placeholder="Brief description…"
                rows={3}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, outline: 'none', color: C.text, resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            <button
              onClick={handleAdd}
              disabled={adding}
              style={{
                width: '100%', padding: '13px', background: C.hero,
                border: 'none', borderRadius: 12, color: C.white,
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {adding ? <Spinner /> : '+ Add to Agenda'}
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteId && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'flex-end', zIndex: 200,
        }}>
          <div style={{ background: C.surface, borderRadius: '20px 20px 0 0', padding: 24, width: '100%', boxSizing: 'border-box' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 8 }}>Delete Item?</div>
            <div style={{ color: C.muted, fontSize: 14, marginBottom: 20 }}>This agenda item will be permanently removed.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setDeleteId(null)}
                style={{ flex: 1, padding: 13, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, fontSize: 15, cursor: 'pointer', color: C.muted }}
              >Cancel</button>
              <button
                onClick={() => handleDelete(deleteId)}
                disabled={deleting}
                style={{ flex: 1, padding: 13, background: C.red, border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', color: C.white }}
              >{deleting ? <Spinner /> : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

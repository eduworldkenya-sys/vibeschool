'use client'

import { useMemo, useState } from 'react'
import {
  filterTeachingLibrarySlots,
  teachingLibrarySlotForResource,
  TEACHING_LIBRARY_CATEGORIES,
  TEACHING_LIBRARY_SLOTS,
} from '@/lib/teaching/libraryStructure'
import type { TeachingLibraryCategoryId } from '@/lib/teaching/libraryStructure'

type SavedResource = { id: string; title: string; type: string }

export type CanonicalTeachingLibraryItem = {
  id: string
  title: string
  description: string | null
  assetKind: string | null
  materialVariant: string | null
  purpose: string | null
  resourceRole: string | null
  href: string | null
  schemeHref: string
  classLabel: string
  subjectLabel: string
}

/**
 * A read-only view of actual Scheme-linked canonical learning resources plus
 * existing teacher-saved notes/quizzes. Empty optional slots are always usable.
 * Selection changes neither resource identity nor lesson readiness.
 */
export default function TeachingLibraryStructure({
  savedResources,
  linkedResources,
  onAddPersonalResource,
}: {
  savedResources: SavedResource[]
  linkedResources: CanonicalTeachingLibraryItem[]
  onAddPersonalResource: (type: 'notes' | 'quiz') => void
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<TeachingLibraryCategoryId | 'all'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const linkedBySlot = useMemo(() => {
    const result = new Map<string, CanonicalTeachingLibraryItem[]>()
    const seen = new Set<string>()
    for (const item of linkedResources) {
      const slotId = teachingLibrarySlotForResource(item)
      if (!slotId) continue
      // A canonical resource may be used in several lessons; show one entry
      // per class/subject context, never a duplicate copy per Scheme week.
      const identity = [slotId, item.id, item.classLabel, item.subjectLabel].join(':')
      if (seen.has(identity)) continue
      seen.add(identity)
      result.set(slotId, [...(result.get(slotId) ?? []), item])
    }
    return result
  }, [linkedResources])

  const visible = useMemo(() => {
    const typed = filterTeachingLibrarySlots('', category)
    const search = query.trim().toLocaleLowerCase()
    if (!search) return typed
    return typed.filter(slot => {
      const group = TEACHING_LIBRARY_CATEGORIES.find(item => item.id === slot.categoryId)
      const matchingLabels = [slot.label, slot.purpose, group?.label ?? '']
      const matchingResources = (linkedBySlot.get(slot.id) ?? []).flatMap(item => [
        item.title, item.description ?? '', item.classLabel, item.subjectLabel,
      ])
      return [...matchingLabels, ...matchingResources]
        .some(value => value.toLocaleLowerCase().includes(search))
    })
  }, [query, category, linkedBySlot])

  const selected = TEACHING_LIBRARY_SLOTS.find(item => item.id === selectedId)
  const matchingSaved = selected?.existingPersonalResourceType
    ? savedResources.filter(item => item.type === selected.existingPersonalResourceType)
    : []
  const matchingCanonical = selected ? linkedBySlot.get(selected.id) ?? [] : []

  return (
    <section aria-labelledby="teaching-library-title" id="teaching-library" style={{ marginBottom: 26 }}>
      <div style={{ marginBottom: 14 }}>
        <h2 id="teaching-library-title" style={{ fontSize: 20, margin: '0 0 5px' }}>Teaching Library</h2>
        <p style={{ color: '#5d6b68', fontSize: 13, margin: 0 }}>
          Choose only the resources useful for your lesson. All 15 types are optional:
          available materials open from their existing links, and missing types stay empty without blocking planning or teaching.
        </p>
      </div>
      <label htmlFor="teaching-library-search" style={{ display: 'block', fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
        Find teaching materials
      </label>
      <input
        id="teaching-library-search"
        type="search"
        value={query}
        onChange={event => { setQuery(event.target.value); setSelectedId(null) }}
        placeholder="Search by resource type, topic or title"
        style={{ display: 'block', width: '100%', minHeight: 44, border: '1px solid #cbd5d1', borderRadius: 10, padding: '10px 12px', marginBottom: 12, boxSizing: 'border-box', fontSize: 14, background: '#fff' }}
      />
      <div role="group" aria-label="Resource categories" style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 15 }}>
        {([{ id: 'all' as const, label: 'All categories' }, ...TEACHING_LIBRARY_CATEGORIES]).map(item => (
          <button
            key={item.id}
            type="button"
            aria-pressed={category === item.id}
            onClick={() => { setCategory(item.id); setSelectedId(null) }}
            style={{ border: '1px solid ' + (category === item.id ? '#1a654b' : '#d1dcd6'), background: category === item.id ? '#e8f6ef' : '#fff', color: '#193b31', borderRadius: 999, padding: '9px 11px', minHeight: 40, fontWeight: 650, fontSize: 12 }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {visible.length === 0 && (
        <p role="status" style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px dashed #cbd5d1' }}>
          No matching resources or types. Try another keyword or choose All categories.
        </p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: 10 }}>
        {visible.map(slot => {
          const group = TEACHING_LIBRARY_CATEGORIES.find(item => item.id === slot.categoryId)
          const savedCount = slot.existingPersonalResourceType
            ? savedResources.filter(item => item.type === slot.existingPersonalResourceType).length
            : 0
          const itemCount = savedCount + (linkedBySlot.get(slot.id)?.length ?? 0)
          const active = selectedId === slot.id
          return (
            <button
              key={slot.id}
              type="button"
              aria-expanded={active}
              aria-controls="teaching-library-selection"
              onClick={() => setSelectedId(active ? null : slot.id)}
              style={{ display: 'block', minHeight: 126, padding: 14, textAlign: 'left', cursor: 'pointer', background: active ? '#edf8f2' : '#fff', border: '1px solid ' + (active ? '#16734f' : '#e1e7e3'), borderRadius: 13, color: '#213b32' }}
            >
              <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#567165', marginBottom: 6 }}>{group?.label}</span>
              <strong style={{ display: 'block', marginBottom: 5, fontSize: 14 }}>{slot.label}</strong>
              <span style={{ display: 'block', fontSize: 12, color: '#63716c', lineHeight: 1.5 }}>{slot.purpose}</span>
              <span style={{ display: 'block', fontSize: 11, color: itemCount ? '#176748' : '#7b8580', marginTop: 8 }}>
                {itemCount ? itemCount + ' available ' + (itemCount === 1 ? 'item' : 'items') : 'No linked items · optional'} · {active ? 'Close' : 'View'}
              </span>
            </button>
          )
        })}
      </div>
      <div id="teaching-library-selection" aria-live="polite">
        {selected && (
          <div style={{ background: '#fff', border: '1px solid #cbd5d1', borderRadius: 13, padding: 16, marginTop: 12 }}>
            <h3 style={{ fontSize: 16, margin: '0 0 5px' }}>{selected.label}</h3>
            {matchingCanonical.length > 0 && (
              <>
                <p style={{ fontSize: 12, color: '#566b61', margin: '0 0 8px' }}>Existing VibeSchool resources linked to your Scheme of Work:</p>
                <ul style={{ margin: '0 0 12px', paddingLeft: 18 }}>
                  {matchingCanonical.map(item => (
                    <li key={item.id + ':' + item.classLabel + ':' + item.subjectLabel} style={{ marginBottom: 9, fontSize: 13 }}>
                      <strong>{item.title}</strong>
                      <span style={{ display: 'block', fontSize: 12, color: '#66776e' }}>{item.classLabel} · {item.subjectLabel}</span>
                      {item.description && <span style={{ display: 'block', color: '#63716c', fontSize: 12 }}>{item.description}</span>}
                      <a href={item.href ?? item.schemeHref} style={{ color: '#075985', display: 'inline-block', marginTop: 3 }}>
                        {item.href ? 'Read resource' : 'View linked Scheme'}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {matchingSaved.length > 0 && (
              <>
                <p style={{ fontSize: 12, color: '#566b61', margin: '0 0 8px' }}>Your saved class materials:</p>
                <ul style={{ margin: '0 0 12px', paddingLeft: 18 }}>
                  {matchingSaved.map(resource => (
                    <li key={resource.id} style={{ marginBottom: 5, fontSize: 13 }}>
                      <a href={'#saved-resource-' + resource.id} style={{ color: '#075985' }}>{resource.title}</a>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {matchingCanonical.length + matchingSaved.length === 0 && (
              <p style={{ fontSize: 13, color: '#66776e', margin: '0 0 10px' }}>
                Nothing is linked to this optional component yet. Continue preparing your lesson normally, or add this kind of content later.
              </p>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
              {selected.existingPersonalResourceType && (
                <button type="button" onClick={() => onAddPersonalResource(selected.existingPersonalResourceType!)} style={{ border: '1px solid #19694b', borderRadius: 9, padding: '9px 12px', background: '#176748', color: '#fff', fontWeight: 700 }}>
                  Add {selected.label.toLowerCase()}
                </button>
              )}
              <a href="#scheme-linked-resources" style={{ fontSize: 13, color: '#075985' }}>Browse Scheme-linked resources</a>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

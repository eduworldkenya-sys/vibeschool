'use client'

import { useMemo, useState } from 'react'
import {
  filterTeachingLibrarySlots,
  TEACHING_LIBRARY_CATEGORIES,
  TEACHING_LIBRARY_SLOTS,
} from '@/lib/teaching/libraryStructure'
import type { TeachingLibraryCategoryId } from '@/lib/teaching/libraryStructure'

type SavedResource = { id: string; title: string; type: string }

/**
 * Discoverable placeholders only. Personal notes/quizzes can be located using
 * their existing resource identity. Other categories remain empty until the
 * canonical content system provides explicit category links.
 */
export default function TeachingLibraryStructure({
  savedResources,
  onAddPersonalResource,
}: {
  savedResources: SavedResource[]
  onAddPersonalResource: (type: 'notes' | 'quiz') => void
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<TeachingLibraryCategoryId | 'all'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const visible = useMemo(() => filterTeachingLibrarySlots(query, category), [query, category])
  const selected = TEACHING_LIBRARY_SLOTS.find(item => item.id === selectedId)
  const matchingSaved = selected?.existingPersonalResourceType
    ? savedResources.filter(item => item.type === selected.existingPersonalResourceType)
    : []

  return (
    <section aria-labelledby="teaching-library-title" id="teaching-library" style={{ marginBottom: 26 }}>
      <div style={{ marginBottom: 14 }}>
        <h2 id="teaching-library-title" style={{ fontSize: 20, margin: '0 0 5px' }}>Teaching Library</h2>
        <p style={{ color: '#5d6b68', fontSize: 13, margin: 0 }}>
          Search 15 teaching resource types in five categories. Empty slots are ready for content to be linked later.
          No sample lessons or unpublished materials are shown as ready.
        </p>
      </div>
      <label htmlFor="teaching-library-search" style={{ display: 'block', fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
        Find a teaching resource type
      </label>
      <input
        id="teaching-library-search"
        type="search"
        value={query}
        onChange={event => { setQuery(event.target.value); setSelectedId(null) }}
        placeholder="e.g. lesson notes, revision, experiments"
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
          No resource types match your search. Try another keyword or choose All categories.
        </p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: 10 }}>
        {visible.map(slot => {
          const group = TEACHING_LIBRARY_CATEGORIES.find(item => item.id === slot.categoryId)
          const savedCount = slot.existingPersonalResourceType
            ? savedResources.filter(item => item.type === slot.existingPersonalResourceType).length
            : 0
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
              <span style={{ display: 'block', fontSize: 11, color: savedCount ? '#176748' : '#7b8580', marginTop: 8 }}>
                {savedCount ? savedCount + ' saved ' + (savedCount === 1 ? 'resource' : 'resources') : 'No linked items yet'} · {active ? 'Close' : 'View'}
              </span>
            </button>
          )
        })}
      </div>
      <div id="teaching-library-selection" aria-live="polite">
        {selected && (
          <div style={{ background: '#fff', border: '1px solid #cbd5d1', borderRadius: 13, padding: 16, marginTop: 12 }}>
            <h3 style={{ fontSize: 16, margin: '0 0 5px' }}>{selected.label}</h3>
            {matchingSaved.length ? (
              <>
                <p style={{ fontSize: 12, color: '#566b61', margin: '0 0 8px' }}>Saved materials in your existing class library:</p>
                <ul style={{ margin: '0 0 10px', paddingLeft: 18 }}>
                  {matchingSaved.map(resource => (
                    <li key={resource.id} style={{ marginBottom: 5, fontSize: 13 }}>
                      <a href={'#saved-resource-' + resource.id} style={{ color: '#075985' }}>{resource.title}</a>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p style={{ fontSize: 13, color: '#66776e', margin: '0 0 10px' }}>
                This resource type has no explicitly linked items yet. You can still use existing Scheme-linked materials below.
              </p>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
              {selected.existingPersonalResourceType && (
                <button type="button" onClick={() => onAddPersonalResource(selected.existingPersonalResourceType!)} style={{ border: '1px solid #19694b', borderRadius: 9, padding: '9px 12px', background: '#176748', color: '#fff', fontWeight: 700 }}>
                  Add {selected.label.toLowerCase()}
                </button>
              )}
              <a href="#scheme-linked-resources" style={{ fontSize: 13, color: '#075985' }}>View Scheme-linked resources</a>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

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
  topicLabel: string
}

/** Read-only projection; does not own resources, mandatory checklists or certification. */
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
  const [expandedCategory, setExpandedCategory] = useState<TeachingLibraryCategoryId | null>('teach-explain')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const linkedBySlot = useMemo(() => {
    const grouped = new Map<string, CanonicalTeachingLibraryItem[]>()
    const seen = new Set<string>()
    for (const item of linkedResources) {
      const slot = teachingLibrarySlotForResource(item)
      if (!slot || !item.href) continue // only certified, readable version links are selectable
      const identity = [slot, item.id, item.classLabel, item.subjectLabel].join(':')
      if (seen.has(identity)) continue
      seen.add(identity)
      grouped.set(slot, [...(grouped.get(slot) ?? []), item])
    }
    return grouped
  }, [linkedResources])

  const filtered = useMemo(() => {
    const allowed = filterTeachingLibrarySlots('', category)
    const search = query.trim().toLocaleLowerCase()
    if (!search) return allowed
    return allowed.filter(slot => {
      const group = TEACHING_LIBRARY_CATEGORIES.find(item => item.id === slot.categoryId)
      const labels = [slot.label, slot.purpose, group?.label ?? '']
      const resourceLabels = (linkedBySlot.get(slot.id) ?? []).flatMap(item =>
        [item.title, item.description ?? '', item.topicLabel, item.classLabel, item.subjectLabel])
      return [...labels, ...resourceLabels].some(label => label.toLocaleLowerCase().includes(search))
    })
  }, [category, linkedBySlot, query])

  const savedFor = (id: string) => {
    const slot = TEACHING_LIBRARY_SLOTS.find(item => item.id === id)
    return slot?.existingPersonalResourceType
      ? savedResources.filter(item => item.type === slot.existingPersonalResourceType) : []
  }
  const countFor = (id: string) => (linkedBySlot.get(id)?.length ?? 0) + savedFor(id).length
  const searching = query.trim().length > 0

  return (
    <section aria-label="Resource types" id="teaching-library" style={{ margin: '16px 0 24px' }}>
      <p style={{ fontSize: 13, color: '#5e6f66', margin: '0 0 12px' }}>
        Choose the materials useful for your lesson. Every type is optional; missing materials do not stop teaching.
      </p>
      <label htmlFor="teaching-library-search" style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Search materials</label>
      <input
        id="teaching-library-search"
        type="search"
        value={query}
        onChange={value => { setQuery(value.target.value); setSelectedId(null) }}
        placeholder="Topic, resource title or type"
        style={{ display: 'block', boxSizing: 'border-box', width: '100%', minHeight: 44, padding: '10px 12px', border: '1px solid #cddbd3', borderRadius: 10, background: '#fff', fontSize: 14, marginBottom: 12 }}
      />
      <div role="group" aria-label="Resource categories" style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 13 }}>
        {([{ id: 'all' as const, label: 'All categories' }, ...TEACHING_LIBRARY_CATEGORIES]).map(item => (
          <button key={item.id} type="button" aria-pressed={category === item.id} onClick={() => { setCategory(item.id); setSelectedId(null); if (item.id !== 'all') setExpandedCategory(item.id) }}
            style={{ padding: '8px 11px', minHeight: 40, borderRadius: 999, fontSize: 12, background: category === item.id ? '#e8f6ef' : '#fff', border: '1px solid ' + (category === item.id ? '#1a654b' : '#d0dcd4'), color: '#1c4737', cursor: 'pointer' }}>
            {item.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && <p role="status" style={{ padding: 15, border: '1px dashed #cbd5d1', borderRadius: 12 }}>No matching resources. Try a different keyword or category.</p>}
      <div style={{ display: 'grid', gap: 9 }}>
        {TEACHING_LIBRARY_CATEGORIES.map(group => {
          const items = filtered.filter(item => item.categoryId === group.id)
          if (!items.length) return null
          const expanded = searching || category === group.id || expandedCategory === group.id
          const count = items.reduce((sum, item) => sum + countFor(item.id), 0)
          return (
            <section key={group.id} style={{ border: '1px solid #dfe7e1', borderRadius: 13, background: '#fff', overflow: 'hidden' }}>
              <button type="button" aria-expanded={expanded} onClick={() => { setExpandedCategory(expanded ? null : group.id); setCategory('all'); setSelectedId(null) }}
                style={{ width: '100%', border: 0, padding: '14px 16px', background: '#fff', cursor: 'pointer', textAlign: 'left', display: 'flex', gap: 9, justifyContent: 'space-between', alignItems: 'center' }}>
                <span><strong style={{ color: '#193c2c', display: 'block', fontSize: 14 }}>{group.label}</strong><span style={{ fontSize: 12, color: '#738076' }}>{items.length} resource types · {count ? count + ' linked items' : 'nothing linked yet'}</span></span>
                <span aria-hidden="true" style={{ color: '#486859' }}>{expanded ? '−' : '+'}</span>
              </button>
              {expanded && <div style={{ borderTop: '1px solid #e7ece9', padding: '5px 12px 12px' }}>
                {items.map(slot => {
                  const active = selectedId === slot.id
                  const saved = savedFor(slot.id)
                  const linked = linkedBySlot.get(slot.id) ?? []
                  const count = saved.length + linked.length
                  return (
                    <div key={slot.id} style={{ borderBottom: '1px solid #eff2ef', padding: '3px 0' }}>
                      <button type="button" aria-expanded={active} onClick={() => setSelectedId(active ? null : slot.id)}
                        style={{ width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', textAlign: 'left', justifyContent: 'space-between', gap: 10, border: 0, background: 'transparent', padding: '8px 4px', cursor: 'pointer' }}>
                        <span style={{ fontSize: 13, color: '#243b30', fontWeight: 650 }}>{slot.label}</span>
                        <span style={{ fontSize: 12, color: count ? '#146b47' : '#738076', flexShrink: 0 }}>{count ? count + ' available' : 'Not linked · optional'} {active ? '▴' : '▾'}</span>
                      </button>
                      {active && <div style={{ padding: '6px 8px 13px', background: '#f7faf8', borderRadius: 9 }}>
                        {linked.length > 0 && <ul style={{ paddingLeft: 17, margin: '0 0 8px' }}>
                          {linked.map(item => (
                            <li key={[item.id, item.classLabel, item.subjectLabel].join(':')} style={{ margin: '9px 0', fontSize: 13 }}>
                              <strong style={{ color: '#22372d' }}>{item.title}</strong>
                              <span style={{ display: 'block', color: '#63746a', fontSize: 11 }}>{item.classLabel} · {item.subjectLabel} · {item.topicLabel}</span>
                              {item.description && <span style={{ display: 'block', color: '#63746a', fontSize: 11 }}>{item.description}</span>}
                              <a href={item.href ?? item.schemeHref} style={{ display: 'inline-block', color: '#126747', fontWeight: 700, marginTop: 4 }}>Read certified resource</a>
                            </li>
                          ))}
                        </ul>}
                        {saved.length > 0 && <ul style={{ paddingLeft: 17, margin: '4px 0' }}>
                          {saved.map(item => <li key={item.id} style={{ margin: '6px 0', fontSize: 13 }}><a href={'#saved-resource-' + item.id} style={{ color: '#126747' }}>{item.title} · My saved materials</a></li>)}
                        </ul>}
                        {!count && <p style={{ margin: '0 0 8px', fontSize: 12, color: '#65766b' }}>Nothing is linked to this optional component yet. Continue preparing your lesson normally, or add content later.</p>}
                        {slot.existingPersonalResourceType && <button type="button" onClick={() => onAddPersonalResource(slot.existingPersonalResourceType!)}
                          style={{ border: '1px solid #c5d7cc', background: '#fff', color: '#135b40', borderRadius: 8, padding: '8px 11px', fontSize: 12, fontWeight: 650 }}>Add {slot.label.toLowerCase()}</button>}
                      </div>}
                    </div>
                  )
                })}
              </div>}
            </section>
          )
        })}
      </div>
    </section>
  )
}

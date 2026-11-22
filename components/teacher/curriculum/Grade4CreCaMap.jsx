// Grade 4 CRE / Creative Arts teacher curriculum reference.
// Reads the existing canonical sub-strands and active outcomes. A curriculum
// reference is not a scheduled Scheme lesson or a KICD certification.
'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { resolveGlobalSubjectId } from '@/lib/curriculum/globalSubjects'

const SOURCES = {
  cre: {
    id: '8165d513-035b-4019-9fdb-5b86a27335a1',
    label: 'Christian Religious Education',
    source: 'owner-approved:grade4-cre:2026-11-22',
    outcomeSource: 'publisher',
  },
  arts: {
    id: '6d68b57c-565d-4a04-879d-c77f588d6404',
    label: 'Creative Arts',
    source: 'owner-paraphrase-2026-11-22',
    outcomeSource: 'generated',
  },
}

function belongsToSource(row, source, kind) {
  return kind === 'cre'
    ? row.source_ref === source
    : typeof row.source_ref === 'string' && row.source_ref.includes(source)
}

export default function Grade4CreCaMap({
  kind,
  subjectId,
  selectedUnitId,
  mode = 'curriculum',
  onOpenScheme,
  onOpenCurriculum,
  onSaveLesson,
  saving = false,
  canSave = false,
}) {
  const source = SOURCES[kind]
  const [units, setUnits] = useState([])
  const [outcomes, setOutcomes] = useState([])
  const [selectedId, setSelectedId] = useState(selectedUnitId || '')
  const [selectedOutcomes, setSelectedOutcomes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setUnits([])
    setOutcomes([])
    setSelectedId(selectedUnitId || '')
    setSelectedOutcomes([])
    setError('')
    setLoading(true)

    ;(async () => {
      try {
        if (!source || !subjectId) throw new Error('Select an assigned Grade 4 subject.')
        const globalId = await resolveGlobalSubjectId(subjectId)
        if (globalId !== source.id) {
          throw new Error('This subject is not connected to the canonical Grade 4 curriculum.')
        }
        const unitResponse = await supabase.from('cbc_strands')
          .select('id,subject_id,grade,name,sub_strand,strand_order,sub_strand_order,source_ref')
          .eq('subject_id', source.id)
          .eq('grade', 'Grade 4')
          .order('strand_order', { ascending: true })
          .order('sub_strand_order', { ascending: true })
        if (unitResponse.error) throw unitResponse.error

        const validUnits = (unitResponse.data || []).filter(row =>
          belongsToSource(row, source.source, kind))
        const ids = validUnits.map(unit => unit.id)
        let validOutcomes = []
        if (ids.length) {
          const outcomeResponse = await supabase.from('curriculum_learning_outcomes')
            .select('id,sub_strand_id,outcome_text,outcome_code,status,source_type')
            .in('sub_strand_id', ids)
            .eq('status', 'active')
            .eq('source_type', source.outcomeSource)
            .order('outcome_code', { ascending: true })
          if (outcomeResponse.error) throw outcomeResponse.error
          validOutcomes = outcomeResponse.data || []
        }
        if (active) {
          setUnits(validUnits)
          setOutcomes(validOutcomes)
          setSelectedId(old => validUnits.some(unit => unit.id === old) ? old : (validUnits[0]?.id || ''))
        }
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Curriculum could not be loaded.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [kind, subjectId, source, selectedUnitId])

  const strands = useMemo(() =>
    [...new Set(units.map(unit => unit.name))], [units])
  const selected = units.find(unit => unit.id === selectedId) || units[0] || null
  const unitOutcomes = outcomes.filter(outcome => outcome.sub_strand_id === selected?.id)
  const activeSelection = selectedOutcomes.filter(id => unitOutcomes.some(outcome => outcome.id === id))
  const isArtsAlternative = kind === 'arts' && /^(2\.6|2\.5)\s+(Swimming|Indigenous Kenyan Games)$/i.test(selected?.sub_strand || '')

  return (
    <section aria-label={'Grade 4 ' + source.label + ' curriculum reference'}
      style={{ background: '#fff', color: '#173f32', border: '1px solid #d7e7dd', padding: 16, borderRadius: 14, marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: '#547060', fontWeight: 700 }}>
        Grade 4 · {source.label} · Curriculum Map
      </div>
      <h2 style={{ fontSize: 18, margin: '6px 0' }}>{mode === 'scheme' ? 'Choose a curriculum reference' : source.label}</h2>
      <p style={{ fontSize: 12, margin: '4px 0 12px', color: '#547060' }}>
        {mode === 'scheme'
          ? 'Browse the source-linked objectives while preparing your Scheme of Work. This selection does not create or schedule a lesson.'
          : 'Existing VibeSchool curriculum records. Formal KICD outcome verification is still pending.'}
      </p>
      {kind === 'arts' && <p style={{ fontSize: 12, color: '#547060' }}>
        Swimming and Indigenous Kenyan Games are alternatives, not two compulsory units.
      </p>}
      {loading && <p role="status">Loading curriculum…</p>}
      {error && <p role="alert" style={{ color: '#9f1b27' }}>{error}</p>}
      {!loading && !error && units.length === 0 && <p role="status">No matching curriculum records are available for this subject.</p>}
      {!loading && !error && selected && (
        <>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 5 }} htmlFor={'g4-map-strand-' + kind}>Strand</label>
          <select id={'g4-map-strand-' + kind} value={selected.name}
            onChange={event => setSelectedId(units.find(unit => unit.name === event.target.value)?.id || '')}
            style={{ display: 'block', width: '100%', minHeight: 44, marginBottom: 10, borderRadius: 8, padding: 8, border: '1px solid #b4c8ba', background: '#fff', color: '#173f32' }}>
            {strands.map(strand => <option key={strand} value={strand}>{strand}</option>)}
          </select>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 5 }} htmlFor={'g4-map-unit-' + kind}>Sub-strand</label>
          <select id={'g4-map-unit-' + kind} value={selected.id} onChange={event => setSelectedId(event.target.value)}
            style={{ display: 'block', width: '100%', minHeight: 44, marginBottom: 10, borderRadius: 8, padding: 8, border: '1px solid #b4c8ba', background: '#fff', color: '#173f32' }}>
            {units.filter(unit => unit.name === selected.name).map(unit =>
              <option key={unit.id} value={unit.id}>{unit.sub_strand}</option>)}
          </select>
          <h3 style={{ fontSize: 16, margin: '12px 0 8px' }}>{selected.sub_strand}</h3>
          {isArtsAlternative && <p style={{ fontSize: 12, color: '#835d15' }}>Optional alternative activity</p>}
          <strong style={{ fontSize: 13 }}>Specific learning outcomes ({unitOutcomes.length})</strong>
          {unitOutcomes.length
            ? mode === 'scheme'
              ? <fieldset style={{ border: 0, padding: 0, margin: '8px 0' }}>
                <legend style={{ fontSize: 12, color: '#547060' }}>Choose outcomes for one planned lesson</legend>
                {unitOutcomes.map(outcome => (
                  <label key={outcome.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', fontSize: 14 }}>
                    <input type="checkbox" checked={activeSelection.includes(outcome.id)} disabled={saving}
                      onChange={event => setSelectedOutcomes(old => event.target.checked
                        ? [...new Set([...old, outcome.id])]
                        : old.filter(id => id !== outcome.id))} />
                    <span>{outcome.outcome_text}</span>
                  </label>
                ))}
              </fieldset>
              : <ol style={{ paddingLeft: 23, fontSize: 14, lineHeight: 1.6, marginTop: 8 }}>
                {unitOutcomes.map(outcome => <li key={outcome.id}>{outcome.outcome_text}</li>)}
              </ol>
            : <p role="status">No active outcomes are linked to this sub-strand.</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 12 }}>
            {mode === 'curriculum' && onOpenScheme && (
              <button type="button" onClick={() => onOpenScheme(selected.id)}
                style={{ background: '#175b43', color: '#fff', border: 0, borderRadius: 9, minHeight: 44, padding: '10px 15px', fontWeight: 750 }}>
                Open Scheme of Work
              </button>
            )}
            {mode === 'scheme' && onSaveLesson && (
              <button type="button" disabled={saving || !canSave || activeSelection.length === 0 || activeSelection.length > 12}
                onClick={() => onSaveLesson(selected.id, activeSelection)}
                style={{ background: '#175b43', color: '#fff', border: 0, borderRadius: 9, minHeight: 44, padding: '10px 15px', fontWeight: 750, opacity: saving || !canSave || activeSelection.length === 0 ? 0.5 : 1 }}>
                {saving ? 'Saving…' : 'Add to Scheme'}
              </button>
            )}
            {mode === 'scheme' && !canSave && <p style={{ fontSize: 12, color: '#825b25', width: '100%' }}>Select a term and instructional week to save a lesson.</p>}
            {mode === 'scheme' && onOpenCurriculum && (
              <button type="button" onClick={() => onOpenCurriculum(selected.id)}
                style={{ background: '#175b43', color: '#fff', border: 0, borderRadius: 9, minHeight: 44, padding: '10px 15px', fontWeight: 750 }}>
                View Curriculum Map
              </button>
            )}
          </div>
        </>
      )}
    </section>
  )
}

"use client"

import React, { useMemo, useState } from 'react'
import type { ContentBlock } from '@/lib/publishTypes'

const TEXT = '#ffffff'
const MUTED = 'rgba(255,255,255,0.58)'
const ACCENT = '#CCFF00'
const CARD = '#111827'
const BORDER = 'rgba(255,255,255,0.09)'

type BiologyInteractiveKind =
  | 'punnett_square'
  | 'meiosis_sequence'
  | 'variation_lab'
  | 'reflex_arc'

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function InteractiveShell({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <section style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 16 }}>
      <div style={{ color: ACCENT, fontSize: 10, fontWeight: 900, letterSpacing: '0.12em', marginBottom: 5 }}>
        {eyebrow}
      </div>
      <h3 style={{ color: TEXT, fontSize: 18, margin: '0 0 12px', lineHeight: 1.35 }}>{title}</h3>
      {children}
    </section>
  )
}

function PunnettSquare({ block }: { block: ContentBlock }) {
  const [parentA, setParentA] = useState('Tt')
  const [parentB, setParentB] = useState('Tt')
  const alleles = asStringArray(block.meta?.alleles)
  const dominant = alleles[0] || 'T'
  const recessive = alleles[1] || dominant.toLowerCase()
  const options = useMemo(() => [`${dominant}${dominant}`, `${dominant}${recessive}`, `${recessive}${recessive}`], [dominant, recessive])
  const gametes = (genotype: string) => [genotype.charAt(0), genotype.charAt(1)]
  const combine = (a: string, b: string) => {
    const pair = [a, b].sort((x, y) => (x === dominant ? -1 : y === dominant ? 1 : x.localeCompare(y)))
    return pair.join('')
  }
  const offspring = gametes(parentA).flatMap(a => gametes(parentB).map(b => combine(a, b)))
  const counts = offspring.reduce<Record<string, number>>((acc, genotype) => {
    acc[genotype] = (acc[genotype] || 0) + 1
    return acc
  }, {})
  return (
    <InteractiveShell eyebrow="INTERACTIVE GENETICS" title={block.content || 'Build a monohybrid cross'}>
      <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.6, margin: '0 0 12px' }}>
        Change either parent. The offspring grid and genotype probabilities update immediately.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        {[['Parent A', parentA, setParentA], ['Parent B', parentB, setParentB]].map(([label, value, setter]) => (
          <label key={String(label)} style={{ color: MUTED, fontSize: 11, fontWeight: 800 }}>
            {String(label)}
            <select value={String(value)} onChange={e => (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)} style={{ width: '100%', marginTop: 5, padding: 10, borderRadius: 10, background: '#0b1220', color: TEXT, border: `1px solid ${BORDER}` }}>
              {options.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr', gap: 6, alignItems: 'stretch' }}>
        <div />
        {gametes(parentB).map((g, i) => <div key={`b-${i}`} style={{ textAlign: 'center', color: ACCENT, fontWeight: 900, padding: 8 }}>{g}</div>)}
        {gametes(parentA).map((gA, row) => (
          <React.Fragment key={`a-${row}`}>
            <div style={{ display: 'grid', placeItems: 'center', color: ACCENT, fontWeight: 900 }}>{gA}</div>
            {gametes(parentB).map((gB, col) => <div key={`${row}-${col}`} style={{ border: `1px solid ${BORDER}`, borderRadius: 9, padding: 13, textAlign: 'center', color: TEXT, fontWeight: 900 }}>{combine(gA, gB)}</div>)}
          </React.Fragment>
        ))}
      </div>
      <div style={{ marginTop: 12, color: TEXT, fontSize: 12, lineHeight: 1.7 }}>
        {Object.entries(counts).map(([genotype, count]) => <span key={genotype} style={{ display: 'inline-block', marginRight: 12 }}>{genotype}: <strong>{count * 25}%</strong></span>)}
      </div>
    </InteractiveShell>
  )
}

function MeiosisSequence({ block }: { block: ContentBlock }) {
  const stages = asStringArray(block.meta?.stages).length > 0
    ? asStringArray(block.meta?.stages)
    : ['Diploid parent cell', 'DNA replicated', 'Homologous chromosomes separate', 'Sister chromatids separate', 'Four haploid cells']
  const [stage, setStage] = useState(0)
  return (
    <InteractiveShell eyebrow="INTERACTIVE PROCESS" title={block.content || 'Trace meiosis'}>
      <div style={{ background: '#0b1220', borderRadius: 14, padding: 18, minHeight: 130, display: 'grid', placeItems: 'center', textAlign: 'center', border: `1px solid ${BORDER}` }}>
        <div>
          <div style={{ color: ACCENT, fontSize: 11, fontWeight: 900, marginBottom: 8 }}>STAGE {stage + 1} OF {stages.length}</div>
          <div style={{ color: TEXT, fontSize: 18, fontWeight: 850 }}>{stages[stage]}</div>
          <div style={{ marginTop: 14, color: MUTED, fontSize: 12 }}>{stage === stages.length - 1 ? 'Chromosome number has been reduced and genetic combinations differ.' : 'Move forward and predict what changes next.'}</div>
        </div>
      </div>
      <input aria-label="Meiosis stage" type="range" min={0} max={stages.length - 1} value={stage} onChange={e => setStage(Number(e.target.value))} style={{ width: '100%', marginTop: 14 }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" disabled={stage === 0} onClick={() => setStage(s => Math.max(0, s - 1))} style={{ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${BORDER}`, background: '#0b1220', color: TEXT }}>← Previous</button>
        <button type="button" disabled={stage === stages.length - 1} onClick={() => setStage(s => Math.min(stages.length - 1, s + 1))} style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: ACCENT, color: '#090D16', fontWeight: 900 }}>Next →</button>
      </div>
    </InteractiveShell>
  )
}

function VariationLab({ block }: { block: ContentBlock }) {
  const [values, setValues] = useState('151,156,160,164,169,175,162,158,171,166')
  const numbers = values.split(',').map(v => Number(v.trim())).filter(Number.isFinite)
  const min = numbers.length ? Math.min(...numbers) : 0
  const max = numbers.length ? Math.max(...numbers) : 0
  const bins = useMemo(() => {
    if (!numbers.length) return [] as { label: string; count: number }[]
    const start = Math.floor(min / 5) * 5
    const end = Math.ceil(max / 5) * 5
    const result: { label: string; count: number }[] = []
    for (let lower = start; lower <= end; lower += 5) {
      const upper = lower + 4
      result.push({ label: `${lower}-${upper}`, count: numbers.filter(n => n >= lower && n <= upper).length })
    }
    return result
  }, [numbers, min, max])
  const peak = Math.max(1, ...bins.map(bin => bin.count))
  return (
    <InteractiveShell eyebrow="VIBE LAB" title={block.content || 'Explore continuous variation'}>
      <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.6 }}>Enter comma-separated measurements, for example learner heights in centimetres. The frequency distribution changes live.</p>
      <textarea value={values} onChange={e => setValues(e.target.value)} rows={3} style={{ width: '100%', boxSizing: 'border-box', background: '#0b1220', color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 10, fontFamily: 'inherit' }} />
      <div style={{ display: 'flex', alignItems: 'end', gap: 6, minHeight: 150, marginTop: 16, overflowX: 'auto' }}>
        {bins.map(bin => <div key={bin.label} style={{ minWidth: 46, flex: 1, textAlign: 'center' }}>
          <div style={{ height: `${Math.max(8, (bin.count / peak) * 110)}px`, background: 'rgba(204,255,0,0.72)', borderRadius: '6px 6px 2px 2px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', color: '#090D16', fontWeight: 900, paddingTop: 4 }}>{bin.count}</div>
          <div style={{ color: MUTED, fontSize: 9, marginTop: 5 }}>{bin.label}</div>
        </div>)}
      </div>
      <div style={{ color: TEXT, fontSize: 12, marginTop: 12 }}>Range: <strong>{numbers.length ? `${min}–${max}` : '—'}</strong> · Measurements: <strong>{numbers.length}</strong></div>
    </InteractiveShell>
  )
}

function ReflexArc({ block }: { block: ContentBlock }) {
  const correct = ['Stimulus', 'Receptor', 'Sensory neurone', 'CNS / relay neurone', 'Motor neurone', 'Effector', 'Response']
  const [revealed, setRevealed] = useState(1)
  return (
    <InteractiveShell eyebrow="TRACE THE PATHWAY" title={block.content || 'Build a reflex arc'}>
      <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.6 }}>Predict the next component before revealing it.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        {correct.slice(0, revealed).map((item, index) => <React.Fragment key={item}>
          <span style={{ background: '#0b1220', border: `1px solid ${BORDER}`, borderRadius: 999, padding: '8px 11px', color: TEXT, fontSize: 12, fontWeight: 800 }}>{item}</span>
          {index < revealed - 1 && <span style={{ color: ACCENT }}>→</span>}
        </React.Fragment>)}
      </div>
      <button type="button" onClick={() => setRevealed(r => r >= correct.length ? 1 : r + 1)} style={{ marginTop: 14, width: '100%', border: 'none', borderRadius: 10, padding: 11, background: ACCENT, color: '#090D16', fontWeight: 900 }}>
        {revealed >= correct.length ? 'Reset pathway' : 'Reveal next component'}
      </button>
    </InteractiveShell>
  )
}

export function BiologyInteractiveBlock({ block }: { block: ContentBlock }) {
  const kind = asString(block.meta?.interactiveType) as BiologyInteractiveKind
  switch (kind) {
    case 'punnett_square': return <PunnettSquare block={block} />
    case 'meiosis_sequence': return <MeiosisSequence block={block} />
    case 'variation_lab': return <VariationLab block={block} />
    case 'reflex_arc': return <ReflexArc block={block} />
    default:
      return <InteractiveShell eyebrow="INTERACTIVE" title={block.content || 'Interactive learning block'}><p style={{ color: MUTED, margin: 0, fontSize: 13 }}>This interaction is not available yet.</p></InteractiveShell>
  }
}

"use client"

import React, { useMemo, useState } from 'react'
import type { ContentBlock } from '@/lib/publishTypes'
import { InteractiveLab } from './InteractiveLab'

const TEXT = '#ffffff'
const MUTED = 'rgba(255,255,255,0.58)'
const ACCENT = '#CCFF00'
const CARD = '#111827'
const BORDER = 'rgba(255,255,255,0.09)'

type BiologyInteractiveKind =
  | 'punnett_square'
  | 'meiosis_sequence'
  | 'variation_lab'
  | 'turgor_lab'
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
      <div style={{ color: ACCENT, fontSize: 10, fontWeight: 900, letterSpacing: '0.12em', marginBottom: 5 }}>{eyebrow}</div>
      <h3 style={{ color: TEXT, fontSize: 18, margin: '0 0 12px', lineHeight: 1.35 }}>{title}</h3>
      {children}
    </section>
  )
}

function PunnettSquare({ block }: { block: ContentBlock }) {
  const alleles = asStringArray(block.meta?.alleles)
  const dominant = alleles[0] || 'T'
  const recessive = alleles[1] || dominant.toLowerCase()
  const options = useMemo(() => [`${dominant}${dominant}`, `${dominant}${recessive}`, `${recessive}${recessive}`], [dominant, recessive])
  const [parentA, setParentA] = useState(`${dominant}${recessive}`)
  const [parentB, setParentB] = useState(`${dominant}${recessive}`)
  const gametes = (genotype: string) => [genotype.charAt(0), genotype.charAt(1)]
  const combine = (a: string, b: string) => [a, b].sort((x, y) => (x === dominant ? -1 : y === dominant ? 1 : x.localeCompare(y))).join('')
  const offspring = gametes(parentA).flatMap(a => gametes(parentB).map(b => combine(a, b)))
  const counts = offspring.reduce<Record<string, number>>((acc, genotype) => ({ ...acc, [genotype]: (acc[genotype] || 0) + 1 }), {})

  return (
    <InteractiveShell eyebrow="INTERACTIVE GENETICS" title={block.content || 'Build a monohybrid cross'}>
      <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.6, margin: '0 0 12px' }}>Change either parent. The offspring grid and genotype probabilities update immediately.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <label style={{ color: MUTED, fontSize: 11, fontWeight: 800 }}>Parent A<select value={parentA} onChange={e => setParentA(e.target.value)} style={{ width: '100%', marginTop: 5, padding: 10, borderRadius: 10, background: '#0b1220', color: TEXT, border: `1px solid ${BORDER}` }}>{options.map(option => <option key={option}>{option}</option>)}</select></label>
        <label style={{ color: MUTED, fontSize: 11, fontWeight: 800 }}>Parent B<select value={parentB} onChange={e => setParentB(e.target.value)} style={{ width: '100%', marginTop: 5, padding: 10, borderRadius: 10, background: '#0b1220', color: TEXT, border: `1px solid ${BORDER}` }}>{options.map(option => <option key={option}>{option}</option>)}</select></label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr', gap: 6 }}>
        <div />
        {gametes(parentB).map((g, i) => <div key={`b-${i}`} style={{ textAlign: 'center', color: ACCENT, fontWeight: 900, padding: 8 }}>{g}</div>)}
        {gametes(parentA).map((gA, row) => <React.Fragment key={`a-${row}`}><div style={{ display: 'grid', placeItems: 'center', color: ACCENT, fontWeight: 900 }}>{gA}</div>{gametes(parentB).map((gB, col) => <div key={`${row}-${col}`} style={{ border: `1px solid ${BORDER}`, borderRadius: 9, padding: 13, textAlign: 'center', color: TEXT, fontWeight: 900 }}>{combine(gA, gB)}</div>)}</React.Fragment>)}
      </div>
      <div style={{ marginTop: 12, color: TEXT, fontSize: 12 }}>{Object.entries(counts).map(([genotype, count]) => <span key={genotype} style={{ display: 'inline-block', marginRight: 12 }}>{genotype}: <strong>{count * 25}%</strong></span>)}</div>
    </InteractiveShell>
  )
}

function MeiosisSequence({ block }: { block: ContentBlock }) {
  const configured = asStringArray(block.meta?.stages)
  const stages = configured.length > 0 ? configured : ['Diploid parent cell', 'DNA replicated', 'Homologous chromosomes separate', 'Sister chromatids separate', 'Four haploid cells']
  const [stage, setStage] = useState(0)
  return (
    <InteractiveShell eyebrow="INTERACTIVE PROCESS" title={block.content || 'Trace meiosis'}>
      <div style={{ background: '#0b1220', borderRadius: 14, padding: 18, minHeight: 130, display: 'grid', placeItems: 'center', textAlign: 'center', border: `1px solid ${BORDER}` }}>
        <div><div style={{ color: ACCENT, fontSize: 11, fontWeight: 900, marginBottom: 8 }}>STAGE {stage + 1} OF {stages.length}</div><div style={{ color: TEXT, fontSize: 18, fontWeight: 850 }}>{stages[stage]}</div></div>
      </div>
      <input aria-label="Meiosis stage" type="range" min={0} max={stages.length - 1} value={stage} onChange={e => setStage(Number(e.target.value))} style={{ width: '100%', marginTop: 14 }} />
    </InteractiveShell>
  )
}

function VariationLab({ block }: { block: ContentBlock }) {
  return <InteractiveLab config={{
    title: block.content || 'Explore continuous variation',
    question: 'How are measurements distributed within a population, and what does the pattern tell you about continuous variation?',
    instructions: 'Measure one quantitative characteristic consistently in a suitable sample. Enter the measurements below as comma-separated values, then interpret the generated distribution.',
    sampleValues: '151,156,160,164,169,175,162,158,171,166',
    unit: 'cm',
    binSize: 5,
    interpretationPrompt: 'What does the distribution show about variation in this sample?',
    conclusionHint: 'Continuous variation usually forms a range with intermediate values. Use the spread and frequency pattern as evidence rather than simply naming the type of variation.',
  }} />
}

function TurgorLab({ block }: { block: ContentBlock }) {
  return <InteractiveLab config={{
    title: block.content || 'Investigate water, turgor and plant support',
    question: 'How does water availability affect the firmness and support of herbaceous plant tissue?',
    instructions: 'Using safe teacher-approved plant material, compare equivalent samples under different water conditions. Enter a numerical firmness or bending score for repeated observations, then compare the pattern.',
    sampleValues: '8,9,8,7,9,4,3,4,2,3',
    unit: 'firmness score',
    binSize: 1,
    interpretationPrompt: 'Relate your observations to osmosis, turgor pressure and mechanical support.',
    conclusionHint: 'A strong conclusion links water entry into cells to increased turgor pressure and explains why loss of water reduces support in non-woody tissues.',
  }} />
}

function ReflexArc({ block }: { block: ContentBlock }) {
  const correct = ['Stimulus', 'Receptor', 'Sensory neurone', 'CNS / relay neurone', 'Motor neurone', 'Effector', 'Response']
  const [revealed, setRevealed] = useState(1)
  return (
    <InteractiveShell eyebrow="TRACE THE PATHWAY" title={block.content || 'Build a reflex arc'}>
      <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.6 }}>Predict the next component before revealing it.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>{correct.slice(0, revealed).map((item, index) => <React.Fragment key={item}><span style={{ background: '#0b1220', border: `1px solid ${BORDER}`, borderRadius: 999, padding: '8px 11px', color: TEXT, fontSize: 12, fontWeight: 800 }}>{item}</span>{index < revealed - 1 && <span style={{ color: ACCENT }}>→</span>}</React.Fragment>)}</div>
      <button type="button" onClick={() => setRevealed(value => value >= correct.length ? 1 : value + 1)} style={{ marginTop: 14, width: '100%', border: 'none', borderRadius: 10, padding: 11, background: ACCENT, color: '#090D16', fontWeight: 900 }}>{revealed >= correct.length ? 'Reset pathway' : 'Reveal next component'}</button>
    </InteractiveShell>
  )
}

export function BiologyInteractiveBlock({ block }: { block: ContentBlock }) {
  const kind = asString(block.meta?.interactiveType) as BiologyInteractiveKind
  switch (kind) {
    case 'punnett_square': return <PunnettSquare block={block} />
    case 'meiosis_sequence': return <MeiosisSequence block={block} />
    case 'variation_lab': return <VariationLab block={block} />
    case 'turgor_lab': return <TurgorLab block={block} />
    case 'reflex_arc': return <ReflexArc block={block} />
    default: return <InteractiveShell eyebrow="INTERACTIVE" title={block.content || 'Interactive learning block'}><p style={{ color: MUTED, margin: 0, fontSize: 13 }}>This interaction is not available yet.</p></InteractiveShell>
  }
}

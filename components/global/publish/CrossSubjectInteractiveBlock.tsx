"use client"

import React from 'react'
import type { ContentBlock } from '@/lib/publishTypes'
import { InteractiveLab, type InteractiveLabConfig } from './InteractiveLab'

const TEXT = '#ffffff'
const MUTED = 'rgba(255,255,255,0.58)'
const CARD = '#111827'
const BORDER = 'rgba(255,255,255,0.09)'

export const CROSS_SUBJECT_LAB_TYPES = [
  'chemistry_titration_lab',
  'chemistry_rate_lab',
  'chemistry_solubility_lab',
  'physics_motion_lab',
  'physics_electricity_lab',
  'physics_moments_lab',
  'mathematics_statistics_lab',
  'mathematics_probability_lab',
  'agriculture_germination_lab',
  'agriculture_soil_lab',
] as const

export type CrossSubjectLabType = typeof CROSS_SUBJECT_LAB_TYPES[number]

const PRESETS: Record<CrossSubjectLabType, InteractiveLabConfig> = {
  chemistry_titration_lab: {
    title: 'Titration data lab',
    question: 'How consistent are repeated titre values, and which results should be used to calculate the mean titre?',
    instructions: 'Record concordant titre values in cm³ as comma-separated measurements. Exclude an obvious rough value only when your practical procedure justifies doing so, then interpret precision and consistency.',
    sampleValues: '24.80,24.70,24.75,24.70',
    unit: 'cm³',
    binSize: 1,
    interpretationPrompt: 'Which results are concordant, what is the mean titre, and what does the spread suggest about precision?',
    conclusionHint: 'A good practical conclusion distinguishes accuracy from precision and explains why close repeated titres strengthen confidence in the measurement.',
  },
  chemistry_rate_lab: {
    title: 'Rate of reaction lab',
    question: 'How does changing a condition affect reaction time and therefore reaction rate?',
    instructions: 'Enter repeated reaction times in seconds for comparable trials. Smaller reaction time generally indicates a faster reaction when the same endpoint is used.',
    sampleValues: '82,78,80,46,44,48,25,27,24',
    unit: 's',
    binSize: 10,
    interpretationPrompt: 'Describe the pattern and connect it to collision frequency or particle energy.',
    conclusionHint: 'Use evidence from the measured times and state which variable changed while other important variables were controlled.',
  },
  chemistry_solubility_lab: {
    title: 'Solubility investigation',
    question: 'How does temperature affect the mass of solute that dissolves in a fixed amount of solvent?',
    instructions: 'Enter solubility measurements collected at comparable temperatures or repeated trials. Use the pattern to discuss how solubility changes under the tested conditions.',
    sampleValues: '32,36,41,47,54,62,71',
    unit: 'g per 100 g water',
    binSize: 10,
    interpretationPrompt: 'Describe the trend and identify any anomalous observation that may need repeating.',
    conclusionHint: 'A scientific conclusion refers to the observed trend and avoids claiming behaviour outside the measured range without evidence.',
  },
  physics_motion_lab: {
    title: 'Motion and speed lab',
    question: 'What do repeated time measurements reveal about the motion of an object over a fixed distance?',
    instructions: 'Time an object travelling the same measured distance several times. Enter the times in seconds, calculate a representative value, then use distance ÷ time to reason about speed.',
    sampleValues: '2.4,2.3,2.5,2.4,2.2',
    unit: 's',
    binSize: 1,
    interpretationPrompt: 'How consistent are the trials, and what sources of uncertainty could affect the calculated speed?',
    conclusionHint: 'Connect measurement spread to experimental uncertainty and distinguish an average result from an exact value.',
  },
  physics_electricity_lab: {
    title: 'Electrical measurements lab',
    question: 'How consistent are current or potential-difference readings in a circuit under controlled conditions?',
    instructions: 'Enter repeated meter readings for one circuit condition. Use the mean and range to discuss reliability before comparing with another condition.',
    sampleValues: '0.42,0.41,0.43,0.42,0.42',
    unit: 'A',
    binSize: 1,
    interpretationPrompt: 'What does the spread show about reliability, and which circuit variable would you change next to test a relationship?',
    conclusionHint: 'Reliable readings are repeatable; a relationship requires a planned change of one independent variable and measurement of the response.',
  },
  physics_moments_lab: {
    title: 'Moments and balance lab',
    question: 'How do repeated balancing measurements support the principle of moments?',
    instructions: 'Enter measured distances or calculated moment values from repeated balance trials. Compare the spread and identify whether clockwise and anticlockwise effects agree within practical uncertainty.',
    sampleValues: '1.98,2.02,2.01,1.99,2.00',
    unit: 'N m',
    binSize: 1,
    interpretationPrompt: 'Does the evidence support rotational equilibrium? Explain using moments rather than force alone.',
    conclusionHint: 'For equilibrium, total clockwise moment and total anticlockwise moment about the same pivot should be equal within experimental uncertainty.',
  },
  mathematics_statistics_lab: {
    title: 'Statistics data lab',
    question: 'What can a dataset tell us about centre, spread and distribution?',
    instructions: 'Enter any numerical dataset as comma-separated values. Compare mean, range and the generated frequency distribution before making a conclusion.',
    sampleValues: '12,14,15,15,16,17,18,18,19,21,24,25',
    unit: 'value',
    binSize: 5,
    interpretationPrompt: 'Describe the centre and spread. Which summary would best communicate this dataset and why?',
    conclusionHint: 'A useful statistical interpretation combines a measure of centre with evidence about spread and unusual values.',
  },
  mathematics_probability_lab: {
    title: 'Experimental probability lab',
    question: 'How does repeated experimentation help estimate probability?',
    instructions: 'Record the number of target outcomes in repeated equal-sized trials, or enter frequencies from several groups. Compare the variation between trials and the overall pattern.',
    sampleValues: '48,52,50,47,53,51,49,50',
    unit: 'successes per 100 trials',
    binSize: 5,
    interpretationPrompt: 'How close are the experimental results to the expected long-run probability, and why do individual trials vary?',
    conclusionHint: 'Experimental probability can fluctuate in small samples; larger numbers of trials often produce a more stable estimate of long-run probability.',
  },
  agriculture_germination_lab: {
    title: 'Seed germination investigation',
    question: 'How does an environmental condition affect germination success?',
    instructions: 'Record germination percentages or counts from repeated containers under one condition. Compare with another condition only when seed number, variety and observation period are controlled.',
    sampleValues: '88,92,90,86,91,89',
    unit: '% germinated',
    binSize: 5,
    interpretationPrompt: 'What does the evidence suggest about germination, and what variables must be controlled for a fair comparison?',
    conclusionHint: 'Distinguish conditions required for germination from factors that influence later seedling growth, and base the claim on observed evidence.',
  },
  agriculture_soil_lab: {
    title: 'Soil investigation lab',
    question: 'What do repeated measurements reveal about a soil sample and its suitability for crop production?',
    instructions: 'Enter repeated measurements such as pH, infiltration time or water-holding values from comparable samples. Interpret the result in relation to the specific measurement you chose.',
    sampleValues: '6.2,6.4,6.3,6.5,6.3',
    unit: 'pH',
    binSize: 1,
    interpretationPrompt: 'How consistent are the measurements and what management decision could reasonably follow from this evidence?',
    conclusionHint: 'A soil-management recommendation should match the measured property; avoid generalising one measurement to every aspect of soil fertility.',
  },
}

export function isCrossSubjectLabType(value: unknown): value is CrossSubjectLabType {
  return typeof value === 'string' && (CROSS_SUBJECT_LAB_TYPES as readonly string[]).includes(value)
}

export function CrossSubjectInteractiveBlock({ block }: { block: ContentBlock }) {
  const kind = block.meta?.interactiveType

  if (!isCrossSubjectLabType(kind)) {
    return (
      <section style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 16 }}>
        <div style={{ color: TEXT, fontSize: 15, fontWeight: 850 }}>{block.content || 'Interactive learning block'}</div>
        <p style={{ color: MUTED, fontSize: 13, marginBottom: 0 }}>This interaction type is not available yet.</p>
      </section>
    )
  }

  const preset = PRESETS[kind]
  return <InteractiveLab config={{ ...preset, title: block.content || preset.title }} />
}

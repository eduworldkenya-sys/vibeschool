import type { Json } from '@/lib/database.types'
import {
  type LearningGeneratedAssetType,
  type LearningTransformation,
  upsertLearningGeneratedAsset,
} from '@/lib/student/learningTransform'

export interface RichLearningAssetDraft {
  assetType: LearningGeneratedAssetType
  payload: Json
  quality: Json
}

function clean(value: string | undefined | null): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function truncate(value: string | undefined | null, max = 180): string {
  const normalized = clean(value)
  return normalized.length > max ? `${normalized.slice(0, max - 1).trim()}…` : normalized
}

export function buildDeterministicRichAssets(item: LearningTransformation): RichLearningAssetDraft[] {
  const payload = item.payload
  const title = clean(payload.title) || 'Learning concept'
  const visualSteps = (payload.visualSteps ?? []).filter(step => clean(step.label) || clean(step.description))
  const sections = (payload.sections ?? []).filter(section => clean(section.heading) || clean(section.body))
  const nodes = (payload.nodes ?? []).filter(node => clean(node.label))
  const worked = (payload.workedExamples ?? []).filter(example => clean(example.problem))
  const script = (payload.script ?? []).filter(line => clean(line.text))
  const takeaways = (payload.takeaways ?? []).map(clean).filter(Boolean)

  const diagramSteps = visualSteps.length
    ? visualSteps.slice(0, 8).map((step, index) => ({ id: index + 1, label: truncate(step.label || `Step ${index + 1}`, 70), detail: truncate(step.description, 170) }))
    : sections.slice(0, 8).map((section, index) => ({ id: index + 1, label: truncate(section.heading || `Idea ${index + 1}`, 70), detail: truncate(section.body, 170) }))
  const nodeLabels = nodes.slice(0, 8).map(node => truncate(node.label, 80))
  const flowLabels = diagramSteps.length ? diagramSteps.map(step => step.label) : nodeLabels

  const assets: RichLearningAssetDraft[] = []
  if (flowLabels.length >= 2) {
    assets.push({
      assetType: 'diagram',
      payload: {
        title,
        kind: 'concept_flow',
        nodes: diagramSteps.length ? diagramSteps : flowLabels.map((label, index) => ({ id: index + 1, label, detail: '' })),
        edges: flowLabels.slice(0, -1).map((_, index) => ({ from: index + 1, to: index + 2 })),
        source_grounded: true,
      },
      quality: { deterministic: true, source_grounded: true, invented_facts: false },
    })
  }

  const timelineSource = visualSteps.length ? visualSteps : sections
  if (timelineSource.length >= 2) {
    assets.push({
      assetType: 'timeline',
      payload: {
        title,
        items: timelineSource.slice(0, 8).map((entry, index) => ({
          order: index + 1,
          label: truncate('label' in entry ? entry.label : entry.heading || `Stage ${index + 1}`, 80),
          detail: truncate('description' in entry ? entry.description : entry.body, 180),
        })),
        source_grounded: true,
      },
      quality: { deterministic: true, source_grounded: true, sequence_is_presentation_order: true },
    })
  }

  if (worked.length > 0 || visualSteps.length >= 2) {
    const source = worked[0]
    assets.push({
      assetType: 'simulation',
      payload: {
        title,
        kind: source ? 'step_through_example' : 'step_through_process',
        prompt: truncate(source?.problem || payload.intro || title, 220),
        steps: source
          ? source.steps.slice(0, 10).map((step, index) => ({ step: index + 1, text: truncate(step, 220) }))
          : visualSteps.slice(0, 10).map((step, index) => ({ step: index + 1, text: truncate(`${step.label}: ${step.description}`, 220) })),
        answer: source ? truncate(source.answer, 220) : null,
        learner_controlled: true,
        source_grounded: true,
      },
      quality: { deterministic: true, source_grounded: true, interactive: true },
    })
  }

  const formulaCandidate = [...takeaways, ...worked.flatMap(example => [example.problem, example.answer])]
    .find(value => /[=+\-×÷*/%<>]|\b(per|ratio|rate|area|volume|fraction|percent|equation)\b/i.test(value))
  if (formulaCandidate) {
    assets.push({
      assetType: 'formula_visual',
      payload: {
        title,
        expression: truncate(formulaCandidate, 180),
        explanation: truncate(payload.intro || sections[0]?.body || 'Use this relationship together with the source explanation.', 220),
        source_grounded: true,
      },
      quality: { deterministic: true, source_grounded: true, semantic_not_symbolic_parser: true },
    })
  }

  const narration = script.length
    ? script.slice(0, 24).map(line => ({ speaker: truncate(line.speaker, 40), text: truncate(line.text, 320) }))
    : sections.slice(0, 12).map(section => ({ speaker: 'Twin', text: truncate(`${section.heading ? `${section.heading}. ` : ''}${section.body ?? ''}`, 320) })).filter(line => line.text)
  if (narration.length > 0) {
    assets.push({
      assetType: 'audio',
      payload: {
        title,
        narration,
        playback: 'browser_speech_synthesis',
        external_audio_generated: false,
        source_grounded: true,
      },
      quality: { deterministic: true, source_grounded: true, degraded_media_mode: true },
    })
  }

  return assets
}

export async function persistDeterministicRichAssets(item: LearningTransformation): Promise<RichLearningAssetDraft[]> {
  const assets = buildDeterministicRichAssets(item)
  await Promise.all(assets.map(asset => upsertLearningGeneratedAsset(item.id, asset.assetType, asset.payload, {
    generator: 'deterministic_rich_media_v1',
    status: asset.assetType === 'audio' ? 'degraded' : 'ready',
    quality: asset.quality,
  })))
  return assets
}

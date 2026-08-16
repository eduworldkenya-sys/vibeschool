export type PathwayKey = 'stem' | 'social' | 'arts'
export type QuickCheckScores = Record<PathwayKey, number>

type QuickCheckChoice = {
  label: string
  hint?: string
  scores: Partial<QuickCheckScores>
}

type QuickCheckQuestion = {
  id: string
  prompt: string
  choices: QuickCheckChoice[]
}

export const QUICK_CHECK_RULE_VERSION = 'pathways-quick-v1'
export const QUICK_CHECK_STORAGE_KEY = 'vs_pathways_quick_check_v1'

export const QUICK_CHECK_PATHWAYS: Record<PathwayKey, { name: string; summary: string; href: string; canonicalSlug: string }> = {
  stem: { name: 'STEM', summary: 'Science, technology, engineering and mathematics.', href: '/pathways#stem', canonicalSlug: 'stem' },
  social: { name: 'Social Sciences', summary: 'People, society, languages, humanities and business-related exploration.', href: '/pathways#social-sciences', canonicalSlug: 'social-sciences' },
  arts: { name: 'Arts & Sports Science', summary: 'Creative, performance, visual arts and sports-related exploration.', href: '/pathways#arts-and-sports-science', canonicalSlug: 'arts-and-sports-science' },
}

export const QUICK_CHECK_QUESTIONS: QuickCheckQuestion[] = [
  { id: 'activity', prompt: 'Which activity sounds most interesting to you?', choices: [
    { label: 'Build, test or figure out how something works', scores: { stem: 3 } },
    { label: 'Understand people, communities or how decisions are made', scores: { social: 3 } },
    { label: 'Create, perform, design or compete physically', scores: { arts: 3 } },
    { label: 'I am not sure yet', scores: {} },
  ]},
  { id: 'problem', prompt: 'If you had a free afternoon, what would you rather try?', choices: [
    { label: 'An experiment, coding, building or technical challenge', scores: { stem: 3 } },
    { label: 'A debate, business idea, writing or community project', scores: { social: 3 } },
    { label: 'Music, film, drawing, performance or sport', scores: { arts: 3 } },
    { label: 'More than one of these', scores: { stem: 1, social: 1, arts: 1 } },
  ]},
  { id: 'strength', prompt: 'Which kind of school work usually feels most natural?', choices: [
    { label: 'Numbers, science, practical or technical work', scores: { stem: 2 } },
    { label: 'Languages, people, history, geography or business', scores: { social: 2 } },
    { label: 'Creative, performance, visual or physical activities', scores: { arts: 2 } },
    { label: 'I do not know yet', scores: {} },
  ]},
  { id: 'future', prompt: 'Which future sounds most exciting right now?', choices: [
    { label: 'Solving scientific, health, technology or engineering problems', scores: { stem: 3 } },
    { label: 'Working with people, organizations, society or enterprise', scores: { social: 3 } },
    { label: 'Creating, performing, designing or developing sport', scores: { arts: 3 } },
    { label: 'I have not decided', scores: {} },
  ]},
  { id: 'style', prompt: 'When learning something new, what do you enjoy most?', choices: [
    { label: 'Testing ideas and solving structured problems', scores: { stem: 2 } },
    { label: 'Discussing ideas, explaining and understanding viewpoints', scores: { social: 2 } },
    { label: 'Expressing ideas through making, movement or performance', scores: { arts: 2 } },
    { label: 'It depends on the topic', scores: { stem: 1, social: 1, arts: 1 } },
  ]},
  { id: 'choice', prompt: 'What would you like VibeSchool to help you do next?', choices: [
    { label: 'See subjects and schools connected to my direction', scores: {} },
    { label: 'Explore careers before I decide', scores: {} },
    { label: 'Understand the three pathways better', scores: {} },
    { label: 'I just want an early indication', scores: {} },
  ]},
]

export function calculateQuickCheck(answers: Record<string, number>): QuickCheckScores {
  const scores: QuickCheckScores = { stem: 0, social: 0, arts: 0 }
  for (const question of QUICK_CHECK_QUESTIONS) {
    const answer = answers[question.id]
    if (answer == null) continue
    const choice = question.choices[answer]
    if (!choice) continue
    for (const key of Object.keys(choice.scores) as PathwayKey[]) scores[key] += choice.scores[key] ?? 0
  }
  return scores
}

export function rankQuickCheck(scores: QuickCheckScores): PathwayKey[] {
  return (Object.keys(scores) as PathwayKey[]).sort((a, b) => scores[b] - scores[a])
}

export type MiniExample = {
  id: string
  title: string
  subject: string
  creator: string
  minutes: number
  summary: string
  paragraphs: string[]
  cover: 'history' | 'agriculture' | 'physics' | 'literature'
  question: string
  choices: string[]
  correct: number
}

export const MINI_EXAMPLES: MiniExample[] = [
  {
    id: 'kenya-independence',
    title: 'How Kenya gained independence',
    subject: 'History',
    creator: 'Example History teacher',
    minutes: 2,
    summary: 'How Kenya reached the historic moment of 12 December 1963.',
    paragraphs: [
      'For many years, Kenya was under British colonial rule. Kenyans campaigned for self-government through political movements, resistance and negotiations.',
      'On 12 December 1963, Kenya gained independence from Britain. Jomo Kenyatta became the first Prime Minister of independent Kenya.',
      'On 12 December 1964, Kenya became a republic, with Jomo Kenyatta as its first President. Jamhuri Day commemorates these milestones.',
    ],
    cover: 'history',
    question: 'When did Kenya gain independence?',
    choices: ['12 December 1963', '12 December 1964', '12 December 1960'],
    correct: 0,
  },
  {
    id: 'yellow-maize',
    title: 'Why maize leaves turn yellow',
    subject: 'Agriculture',
    creator: 'Example Agriculture teacher',
    minutes: 3,
    summary: 'Learn what yellowing leaves can tell us about crop health.',
    paragraphs: [
      'Yellow maize leaves can be a sign of plant stress. However, yellowing alone does not identify the cause.',
      'Possible causes include nutrient deficiencies, water stress, pests and diseases. The pattern and location of yellowing can help narrow down the possibilities.',
      'Before choosing treatment, examine the plant, soil moisture and growing conditions. A good farmer investigates before acting.',
    ],
    cover: 'agriculture',
    question: 'What is the best first step?',
    choices: ['Apply fertiliser immediately', 'Investigate the symptoms', 'Spray insecticide immediately'],
    correct: 1,
  },
  {
    id: 'electric-circuit',
    title: 'How an electric circuit works',
    subject: 'Physics',
    creator: 'Example Physics teacher',
    minutes: 3,
    summary: 'Understand a simple circuit, its switch and its bulb.',
    paragraphs: [
      'An electric circuit has a conducting path through which electric current can flow. A battery supplies energy to the circuit.',
      'When the switch closes, the circuit is complete and a connected bulb can light up. When the switch opens, the path is broken and current stops.',
      'A switch controls the current by making or breaking the conducting path.',
    ],
    cover: 'physics',
    question: 'What happens when the switch opens?',
    choices: ['The path is completed', 'The path is broken', 'The battery becomes stronger'],
    correct: 1,
  },
  {
    id: 'literary-suspense',
    title: 'How writers create suspense',
    subject: 'Literature',
    creator: 'Example Literature teacher',
    minutes: 3,
    summary: 'Discover how silence and uncertainty keep a reader curious.',
    paragraphs: [
      '“The footsteps stopped outside the door. Nia held her breath. The room was silent except for the ticking clock.”',
      'Suspense is the feeling of uncertainty about what might happen next. Writers can use pacing, silence, atmosphere and delayed information to create it.',
      'In this original example, the sudden silence makes us wonder who is outside and what might happen next.',
    ],
    cover: 'literature',
    question: 'Which detail creates suspense?',
    choices: ['The sudden silence', 'The character’s name', 'The length of the passage'],
    correct: 0,
  },
]

/**
 * KICD Grade 4 English revised 2024: published annual theme index.
 * This is a curriculum REFERENCE, not a substitute for canonical curriculum
 * rows, verified specific learning outcomes, or school term allocations.
 * Source: KICD Grade 4 English revised 2024, curriculum pp. 1–91.
 */
export const GRADE4_ENGLISH_SOURCE =
  'https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.4.ENGLISH.LANGUAGE.pdf'

export const GRADE4_ENGLISH_THEMES = [
  {
    "number": 1,
    "name": "The Family",
    "sourcePage": 1
  },
  {
    "number": 2,
    "name": "Family Celebrations",
    "sourcePage": 8
  },
  {
    "number": 3,
    "name": "Etiquette",
    "sourcePage": 15
  },
  {
    "number": 4,
    "name": "Accidents: First Aid",
    "sourcePage": 22
  },
  {
    "number": 5,
    "name": "Nutrition: Balanced Diet",
    "sourcePage": 30
  },
  {
    "number": 6,
    "name": "Internet: Email",
    "sourcePage": 37
  },
  {
    "number": 7,
    "name": "Technology: Cyber Safety",
    "sourcePage": 44
  },
  {
    "number": 8,
    "name": "The Farm",
    "sourcePage": 50
  },
  {
    "number": 9,
    "name": "HIV and AIDS",
    "sourcePage": 56
  },
  {
    "number": 10,
    "name": "Hygiene and Sanitation",
    "sourcePage": 62
  },
  {
    "number": 11,
    "name": "Sports: My Favourite Game",
    "sourcePage": 69
  },
  {
    "number": 12,
    "name": "Clean Environment",
    "sourcePage": 75
  },
  {
    "number": 13,
    "name": "Money",
    "sourcePage": 81
  }
] as const

export const GRADE4_ENGLISH_STRANDS = [
  'Listening and Speaking', 'Reading', 'Grammar in Use', 'Writing'
] as const

// A local teaching plan may put themes 1–5 in Term 1, 6–9 in Term 2
// and 10–13 in Term 3. KICD does not prescribe these term boundaries.
export function suggestedTermForTheme(themeNumber: number): 1 | 2 | 3 {
  return themeNumber <= 5 ? 1 : themeNumber <= 9 ? 2 : 3
}

/**
 * Sub-strand heading summaries from the KICD 2024 theme tables.
 * Four headings for each theme; content and SLOs remain unpublished/unverified
 * until reconciled with canonical curriculum records and reviewed.
 */
export const GRADE4_ENGLISH_SUBSTRANDS: Readonly<Record<number, readonly string[]>> = {
  "1": [
    "Pronunciation and Vocabulary — Listening Comprehension",
    "Extensive Reading — Reference Materials",
    "Grammar in Use — Definite and Indefinite Articles",
    "Functional Writing — Completing Forms"
  ],
  "2": [
    "Pronunciation and Vocabulary — Target Sounds",
    "Intensive Reading — Poems and Stories",
    "Grammar in Use — Regular and Irregular Nouns",
    "Creative Writing — Open-ended Composition"
  ],
  "3": [
    "Pronunciation and Vocabulary — Polite Words and Sounds",
    "Intensive Reading — Comprehension",
    "Grammar in Use — Enough to / A lot of",
    "Mechanics of Writing — Handwriting and Spelling"
  ],
  "4": [
    "Pronunciation and Vocabulary — Word Stress",
    "Intensive Reading — Visual Information",
    "Grammar in Use — Personal and Possessive Pronouns",
    "Functional Writing — Friendly Letters and SMS"
  ],
  "5": [
    "Pronunciation and Vocabulary — Listening Comprehension",
    "Extensive Reading — Independent Reading",
    "Grammar in Use — Adjectives",
    "Creative Writing — Narrative Composition"
  ],
  "6": [
    "Pronunciation and Vocabulary — Stress and Intonation",
    "Intensive Reading — Dialogues",
    "Grammar in Use — Quantifiers",
    "Creative Writing — Pictorial Compositions"
  ],
  "7": [
    "Pronunciation and Vocabulary — Interactive Listening",
    "Extensive Reading — Independent Reading",
    "Grammar in Use — Progressive Verb Aspect",
    "Mechanics of Writing — Full Stops and Capital Letters"
  ],
  "8": [
    "Pronunciation and Vocabulary — Articulating Sounds",
    "Reading — Fluency",
    "Grammar in Use — Contracted Verbs and Positive/Negative Statements",
    "Creative Writing — Narrative Composition"
  ],
  "9": [
    "Pronunciation and Vocabulary — Speaking Fluency",
    "Intensive Reading — Narratives",
    "Grammar in Use — Adverbs",
    "Mechanics of Writing — Commas and Question Marks"
  ],
  "10": [
    "Pronunciation and Vocabulary — Speaking and Polite Interruptions",
    "Intensive Reading — Factual Texts",
    "Grammar in Use — Coordinating Conjunctions",
    "Creative Writing — Descriptive Compositions"
  ],
  "11": [
    "Pronunciation and Vocabulary — Speaking Skills",
    "Intensive Reading — Digital Texts",
    "Grammar in Use — Interrogatives",
    "Mechanics of Writing — Commonly Misspelt Words"
  ],
  "12": [
    "Pronunciation and Vocabulary — Speaking",
    "Intensive Reading — Poems, Songs and Passages",
    "Grammar in Use — Present and Past Perfect Aspects",
    "Guided Composition — Diary"
  ],
  "13": [
    "Pronunciation and Vocabulary — Language Patterns",
    "Extensive Reading — Newspapers and Magazines",
    "Grammar in Use — Prepositions",
    "Mechanics of Writing — Double Consonants"
  ]
}

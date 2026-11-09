/**
 * KICD Grade 4 English revised 2024: published annual theme index.
 * This is a curriculum REFERENCE, not a substitute for canonical curriculum
 * rows, verified specific learning outcomes, or school term allocations.
 * Source: KICD English Grade 4 (2024), pp. 1–104.
 */
export const GRADE4_ENGLISH_SOURCE =
  'https://www.teacherspalace.co.ke/public/uploads/documents/english-grade-4-updated-revised-sept-unlocked-2024-12-25-ACtnqR8fEw.pdf'

export const GRADE4_ENGLISH_THEMES = [
  {
    "number": 1,
    "name": "The Family",
    "sourcePage": 1
  },
  {
    "number": 2,
    "name": "Family Celebrations",
    "sourcePage": 9
  },
  {
    "number": 3,
    "name": "Etiquette",
    "sourcePage": 17
  },
  {
    "number": 4,
    "name": "Accidents: First Aid",
    "sourcePage": 25
  },
  {
    "number": 5,
    "name": "Nutrition: Balanced Diet",
    "sourcePage": 33
  },
  {
    "number": 6,
    "name": "Internet: Email",
    "sourcePage": 41
  },
  {
    "number": 7,
    "name": "Technology: Cyber Safety",
    "sourcePage": 49
  },
  {
    "number": 8,
    "name": "The Farm",
    "sourcePage": 57
  },
  {
    "number": 9,
    "name": "HIV and AIDS",
    "sourcePage": 65
  },
  {
    "number": 10,
    "name": "Hygiene and Sanitation",
    "sourcePage": 73
  },
  {
    "number": 11,
    "name": "Sports: My Favourite Game",
    "sourcePage": 81
  },
  {
    "number": 12,
    "name": "Clean Environment",
    "sourcePage": 89
  },
  {
    "number": 13,
    "name": "Money",
    "sourcePage": 97
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
 * The first five themes have their four sub-strand headings identified from
 * the KICD source. These headings are descriptive reference metadata only;
 * no specific learning outcome is represented as verified or published.
 */
export const GRADE4_ENGLISH_INITIAL_SUBSTRANDS: Readonly<Record<number, readonly string[]>> = {
  1: ['Pronunciation and Vocabulary — Listening Comprehension', 'Extensive Reading — Reference Materials', 'Grammar in Use — Articles', 'Functional Writing — Forms'],
  2: ['Pronunciation and Vocabulary — Target Sounds', 'Intensive Reading — Poems and Stories', 'Grammar in Use — Regular and Irregular Nouns', 'Creative Writing — Open-ended Composition'],
  3: ['Pronunciation and Vocabulary — Polite Words and Sounds', 'Intensive Reading — Comprehension', 'Grammar in Use — Enough to / A lot of', 'Mechanics of Writing — Handwriting and Spelling'],
  4: ['Pronunciation and Vocabulary — Word Stress', 'Intensive Reading — Visual Information', 'Grammar in Use — Personal and Possessive Pronouns', 'Functional Writing — Friendly Letters and SMS'],
  5: ['Pronunciation and Vocabulary — Listening Comprehension', 'Extensive Reading — Independent Reading', 'Grammar in Use — Adjectives', 'Creative Writing — Narrative Composition'],
}

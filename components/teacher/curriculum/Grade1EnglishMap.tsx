'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'

/**
 * Read-only curriculum reference drawn from the independent VibeSchool
 * Grade 1 English edition (VS-CUR-G01-EN-2026).
 *
 * Do not promote these VibeSchool-authored descriptions to "KICD verified".
 * This annual reference is distinct from the canonical, dated curriculum
 * records and the teacher-owned Scheme of Work. No PDF rendering required.
 */
export const GRADE1_ENGLISH_SOURCE = 'https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-1-3-English-Activities-Revised-Sept.pdf'

type CurriculumUnit = {
  id: string
  title: string
  strand: 1 | 2 | 3 | 4
  lessons: number
  outcomes: readonly string[]
  experiences: readonly string[]
  inquiry: readonly string[]
  resources: string
  assessment: string
  competencies: string
  safety?: string
}

export const GRADE1_ENGLISH_STRANDS = [
  { id: 1, title: 'Listening and Speaking' },
  { id: 2, title: 'Reading' },
  { id: 3, title: 'Language Use' },
  { id: 4, title: 'Writing' },
] as const

/** The 13 recurring English skill sub-strands, 58 original descriptions, 15 themes, and source lesson allocations. */
export const GRADE1_ENGLISH_THEMES = [
  {
    "id": 1,
    "title": "Greetings",
    "words": "hello, good morning, welcome, thank you, goodbye",
    "context": "Role-play short conversations using appropriate greetings at different times of day."
  },
  {
    "id": 2,
    "title": "School",
    "words": "school, teacher, learner, classroom, desk, book",
    "context": "Describe familiar classroom objects and follow brief school-related directions."
  },
  {
    "id": 3,
    "title": "Family",
    "words": "family, sister, brother, parent, home, help",
    "context": "Talk about family and care using simple respectful sentences."
  },
  {
    "id": 4,
    "title": "Home",
    "words": "house, room, door, window, table, clean",
    "context": "Identify home objects and tell a short story about a safe home routine."
  },
  {
    "id": 5,
    "title": "Time",
    "words": "day, morning, afternoon, evening, today, yesterday",
    "context": "Sequence familiar daily activities using words that show when they happen."
  },
  {
    "id": 6,
    "title": "Weather and Our Environment",
    "words": "sun, rain, wind, tree, cloud, garden",
    "context": "Observe the weather and describe safe activities for different conditions."
  },
  {
    "id": 7,
    "title": "Hygiene",
    "words": "water, wash, soap, hands, teeth, clean",
    "context": "Give or follow simple instructions about washing hands and caring for personal hygiene."
  },
  {
    "id": 8,
    "title": "Parts of the Body",
    "words": "head, hand, eye, ear, foot, knee",
    "context": "Name body parts and participate in a safe movement rhyme."
  },
  {
    "id": 9,
    "title": "My Friends",
    "words": "friend, kind, share, play, help, together",
    "context": "Use short conversations to describe friendship and cooperative play."
  },
  {
    "id": 10,
    "title": "Safety",
    "words": "safe, danger, stop, road, help, careful",
    "context": "Discuss safe decisions through pictures and practise asking a trusted adult for help."
  },
  {
    "id": 11,
    "title": "Community Leaders",
    "words": "leader, teacher, nurse, chief, help, community",
    "context": "Talk about trusted helpers in the community using pictures and short descriptions."
  },
  {
    "id": 12,
    "title": "Living Together",
    "words": "respect, share, listen, together, neighbour, care",
    "context": "Role-play taking turns, listening and using polite language when people work together."
  },
  {
    "id": 13,
    "title": "Technology",
    "words": "phone, radio, screen, computer, call, message",
    "context": "Identify familiar technology and describe age-appropriate safe ways it can help us communicate."
  },
  {
    "id": 14,
    "title": "Numbers",
    "words": "one, two, three, four, five, count",
    "context": "Count familiar objects aloud and read simple sentences containing number words."
  },
  {
    "id": 15,
    "title": "Conserving Resources",
    "words": "water, save, reuse, switch off, clean, protect",
    "context": "Discuss everyday ways to avoid wasting water or materials using simple sentences."
  }
] as const

/** Reader index IDs group recurring theme-based KICD sub-strands; IDs are VibeSchool navigation labels, not KICD codes. */
export const GRADE1_ENGLISH_UNITS: readonly CurriculumUnit[] = [
  {
    "id": "1.1",
    "title": "Pronunciation and Vocabulary",
    "strand": 1,
    "lessons": 60,
    "outcomes": [
      "Listen closely and identify a target sound in familiar spoken words.",
      "Match taught letter shapes to the corresponding sounds in age-appropriate words.",
      "Say target sounds and short words clearly after listening to a reliable model.",
      "Use new words from familiar themes in short meaningful conversations.",
      "Follow and respond to simple oral instructions and questions.",
      "Use polite greetings and suitable non-verbal signals while interacting with others.",
      "Speak in short age-appropriate sentences with growing confidence."
    ],
    "experiences": [
      "Use a picture and a short oral text to hear, identify and repeat a selected sound.",
      "Take turns matching letter cards with words or pictures, then practise speaking the words.",
      "Role-play a short exchange about a chosen everyday theme, including listening and responding to a partner."
    ],
    "inquiry": [
      "How does listening help us say a new word accurately?",
      "How can we use new words to share our ideas with someone?"
    ],
    "resources": "Picture and letter cards, locally familiar objects, teacher read-alouds, simple songs, optional clear audio recordings.",
    "assessment": "Listen for sound recognition, accurate attempts at pronunciation, appropriate word choice, response to questions and respectful turn-taking.",
    "competencies": "Communication and collaboration, self-efficacy and learning to learn. Values: respect and unity. PCIs: social skills and safe communication.",
    "safety": "Use encouraging feedback; allow extra response time and visual cues for speech or hearing differences."
  },
  {
    "id": "2.1",
    "title": "Pre-reading",
    "strand": 2,
    "lessons": 6,
    "outcomes": [
      "Choose a comfortable posture for reading and hold a book safely.",
      "Identify where a page begins and track print from left to right.",
      "Match selected printed letters with sounds already practised orally.",
      "Recognise basic features of a book, including its cover and pages."
    ],
    "experiences": [
      "Model safe book handling, page turning and careful placement of reading material.",
      "Trace a line of print while a teacher reads and then try with short familiar words.",
      "Match large letter cards to oral sounds and picture prompts."
    ],
    "inquiry": [
      "What helps us prepare to read a book?",
      "How do our eyes follow the words on a page?"
    ],
    "resources": "Large-print readers, simple picture books, letter cards and optional tactile or adapted texts.",
    "assessment": "Observe book handling, reading position, direction of print tracking and letter-sound matching.",
    "competencies": "Self-efficacy and learning to learn. Values: responsibility for shared books. PCIs: eye care and inclusion."
  },
  {
    "id": "2.2",
    "title": "Word Reading",
    "strand": 2,
    "lessons": 4,
    "outcomes": [
      "Blend previously learnt sounds to read short familiar words.",
      "Recognise and read selected common words in signs, cards and very short texts.",
      "Use pictures and surrounding words to support recognition of an unfamiliar word.",
      "Read familiar theme words aloud without relying only on memorised pictures."
    ],
    "experiences": [
      "Build two- or three-sound words from movable letters and say each sound before blending.",
      "Match short word cards to pictures, then read the words after removing the pictures.",
      "Read words in a brief thematic sentence and check that the spoken word fits its meaning."
    ],
    "inquiry": [
      "What happens when we blend sounds together?",
      "How can a picture help us check the word we have read?"
    ],
    "resources": "Letter tiles, phonics cards, familiar signs, picture cards and short age-appropriate texts.",
    "assessment": "Check independent sound blending and word recognition in new combinations, not only recitation of memorised lists.",
    "competencies": "Learning to learn, communication and problem solving. Values: patience and respect. PCIs: literacy for daily life."
  },
  {
    "id": "2.3",
    "title": "Fluency",
    "strand": 2,
    "lessons": 12,
    "outcomes": [
      "Read a short, familiar passage aloud with improving accuracy.",
      "Group words naturally while reading a simple sentence.",
      "Use pauses at suitable points in a short text.",
      "Read short phrases with suitable voice expression.",
      "Build confidence through rereading and supported practice."
    ],
    "experiences": [
      "Listen to a teacher model reading of a short passage, then practise echo reading.",
      "Reread two or three simple sentences with a partner and notice where meaning changes with pauses.",
      "Perform a short dialogue aloud using a friendly tone and natural expression."
    ],
    "inquiry": [
      "Why is it helpful to pause while reading?",
      "How does practising a short passage make reading easier?"
    ],
    "resources": "Short theme-based passages, simple dialogues, enlarged sentence strips and optional audio support.",
    "assessment": "Use brief observation of accuracy, expression, sensible phrasing and improvement through supported repeated reading.",
    "competencies": "Communication, collaboration and self-efficacy. Values: cooperation and care. PCIs: positive peer support."
  },
  {
    "id": "2.4",
    "title": "Comprehension",
    "strand": 2,
    "lessons": 8,
    "outcomes": [
      "Identify people, objects or places mentioned in a very short story.",
      "Tell what happened first and next in a simple passage.",
      "Answer straightforward oral or written questions about a short text.",
      "Relate the meaning of a story to everyday experiences.",
      "Use pictures and a few key words to retell a short narrative."
    ],
    "experiences": [
      "Read or listen to an illustrated short text and point to pictures that match its meaning.",
      "Answer who, what, where and simple why questions using words or complete short sentences.",
      "Reorder three picture cards and retell the story with a partner."
    ],
    "inquiry": [
      "What clues help us know what a story is about?",
      "How can we tell someone what happened in a text?"
    ],
    "resources": "Illustrated picture stories, sequence cards and short levelled reading passages.",
    "assessment": "Ask meaning-based questions, observe picture sequencing and check whether retelling preserves the main idea.",
    "competencies": "Critical thinking, creativity and communication. Values: respect and responsibility. PCIs: empathy and safe decision-making."
  },
  {
    "id": "3.1",
    "title": "Word Classes",
    "strand": 3,
    "lessons": 22,
    "outcomes": [
      "Use familiar naming words naturally when talking about people, objects and places.",
      "Choose simple describing words that make a spoken sentence clearer.",
      "Use short expressions to refer to a person or object without unnecessary repetition.",
      "Use suitable action words when talking about everyday activities.",
      "Communicate simple ideas using naturally formed short sentences."
    ],
    "experiences": [
      "Describe familiar classroom pictures and objects through short spoken sentences without naming grammar categories.",
      "Play a guessing game that adds one describing word to help a partner find an object.",
      "Practise short dialogues in which learners speak about what people or animals do."
    ],
    "inquiry": [
      "How can we make a short description clear?",
      "What words help another person understand our message?"
    ],
    "resources": "Picture cards, everyday objects, action illustrations and short oral dialogues.",
    "assessment": "Listen for natural, meaningful use of everyday words in short spoken sentences; do not test technical grammar labels.",
    "competencies": "Communication and collaboration, self-efficacy. Values: respect and responsibility. PCIs: effective daily communication."
  },
  {
    "id": "3.2",
    "title": "Tense",
    "strand": 3,
    "lessons": 6,
    "outcomes": [
      "Talk simply about things happening now.",
      "Describe familiar activities that happened earlier.",
      "Make short statements about something planned for later.",
      "Choose understandable everyday time words in a conversation."
    ],
    "experiences": [
      "Use today, yesterday and tomorrow picture cards to talk about routines in complete short sentences.",
      "Listen to a short exchange about an earlier activity and answer questions.",
      "Take turns describing what a family or school activity is like on different days."
    ],
    "inquiry": [
      "How do we tell a friend when an activity happened?",
      "What can we say about something we plan to do?"
    ],
    "resources": "Routine pictures, time cards, short conversations and oral story prompts.",
    "assessment": "Observe whether learners communicate present, past and future meaning understandably without requiring grammar terminology.",
    "competencies": "Communication, learning to learn and confidence. Values: respect and cooperation. PCIs: planning and time awareness."
  },
  {
    "id": "3.3",
    "title": "Sentences",
    "strand": 3,
    "lessons": 2,
    "outcomes": [
      "Respond to questions with meaningful short oral sentences.",
      "Join familiar words into a clear message about an everyday theme.",
      "Use courteous short statements while speaking to classmates and adults."
    ],
    "experiences": [
      "Look at one picture and produce a short sentence that tells what is happening.",
      "Extend a one-word answer into a clear statement with teacher support.",
      "Practise brief polite exchanges with classmates using familiar context words."
    ],
    "inquiry": [
      "What helps a listener understand a short message?"
    ],
    "resources": "Simple picture prompts, conversation cards and age-appropriate role-play objects.",
    "assessment": "Listen for understandable short statements and appropriate responses; avoid explicit grammar terminology.",
    "competencies": "Communication, self-efficacy and collaboration. Values: respect and unity. PCIs: confidence in social interaction."
  },
  {
    "id": "4.1",
    "title": "Pre-writing",
    "strand": 4,
    "lessons": 4,
    "outcomes": [
      "Sit or position the body comfortably before writing.",
      "Hold a pencil or adapted writing tool with improving control.",
      "Trace and produce simple lines, loops and shapes needed for letter formation.",
      "Coordinate eye and hand movement when following a writing path."
    ],
    "experiences": [
      "Demonstrate good writing posture and allow learners to adjust seating or supports.",
      "Practise large movements in the air or on reusable surfaces before tracing lines on paper.",
      "Follow simple paths and letter-like shapes using crayons, fingers or adapted tools."
    ],
    "inquiry": [
      "What helps our hands make clear marks?",
      "Why should we sit or position ourselves comfortably when writing?"
    ],
    "resources": "Pencils, crayons, writing boards, paper, large templates and adapted grips.",
    "assessment": "Observe posture, grip or adapted tool control, direction of strokes and progress towards steady marks.",
    "competencies": "Self-efficacy, creativity and learning to learn. Values: care for materials. PCIs: posture and inclusion."
  },
  {
    "id": "4.2",
    "title": "Handwriting",
    "strand": 4,
    "lessons": 6,
    "outcomes": [
      "Form taught lower-case letters in a recognisable way.",
      "Form selected capital letters in a recognisable way.",
      "Copy familiar words with improving letter size and spacing.",
      "Write short words neatly enough for another reader to recognise."
    ],
    "experiences": [
      "Watch a model letter formation and practise with large strokes before writing on a line.",
      "Copy a few theme words while observing letter orientation and spacing.",
      "Compare a learner's earlier and later handwriting gently, focusing on progress."
    ],
    "inquiry": [
      "How does clear handwriting help someone read our work?",
      "What makes letters easier to recognise?"
    ],
    "resources": "Letter formation charts, exercise books, pencils and lined or large-grid paper.",
    "assessment": "Review letter shapes, direction, spacing, legibility and steady improvement rather than speed.",
    "competencies": "Learning to learn, self-efficacy and responsibility. Values: patience and care. PCIs: fine-motor development."
  },
  {
    "id": "4.3",
    "title": "Spelling",
    "strand": 4,
    "lessons": 6,
    "outcomes": [
      "Write familiar short words after sounding them out.",
      "Select suitable letters for sounds in taught words.",
      "Spell selected theme words with support from a picture or word bank.",
      "Check and correct an attempt at spelling using a reliable classroom model."
    ],
    "experiences": [
      "Say a simple word, listen for its sounds and choose matching letter tiles.",
      "Complete a familiar picture-word matching and spelling game.",
      "Write a short word from a teacher prompt and compare it respectfully with a printed model."
    ],
    "inquiry": [
      "How do sounds help us spell words?",
      "What can we do when we are not sure of a letter?"
    ],
    "resources": "Sound and letter cards, picture prompts, word walls and writing surfaces.",
    "assessment": "Check how learners use sound-letter knowledge in newly presented words and correct spelling attempts thoughtfully.",
    "competencies": "Learning to learn, creativity and self-efficacy. Values: persistence and respect. PCIs: functional literacy."
  },
  {
    "id": "4.4",
    "title": "Punctuation",
    "strand": 4,
    "lessons": 4,
    "outcomes": [
      "Recognise that a written sentence begins with a capital letter.",
      "Notice a full stop at the end of a simple statement.",
      "Use basic ending marks in a short copied or guided sentence.",
      "Read short writing with pauses that reflect familiar punctuation."
    ],
    "experiences": [
      "Compare two large sentence cards, one with and one without a beginning capital and full stop.",
      "Write a simple message about a picture and place a full stop at its end.",
      "Practise reading short sentences with natural pauses and supportive guidance."
    ],
    "inquiry": [
      "How does a reader know where a written message begins and ends?"
    ],
    "resources": "Sentence strips, board markers, picture cards and writing books.",
    "assessment": "Inspect capital letters, simple end punctuation and understanding during reading and writing.",
    "competencies": "Communication and self-efficacy. Values: responsibility. PCIs: clear communication."
  },
  {
    "id": "4.5",
    "title": "Guided Writing",
    "strand": 4,
    "lessons": 10,
    "outcomes": [
      "Compose a short spoken message before attempting to write it.",
      "Write a brief sentence based on a familiar picture or real experience.",
      "Arrange simple words in an order that communicates meaning.",
      "Write two or more connected simple ideas with teacher support where appropriate.",
      "Review a short written message for clarity, letter formation and basic punctuation."
    ],
    "experiences": [
      "Talk about a familiar theme picture, rehearse one sentence orally and write it with a model or word bank.",
      "Use three picture prompts to plan a very short personal account with an adult's support.",
      "Read a completed sentence to a partner and revise a word or punctuation mark where needed."
    ],
    "inquiry": [
      "What do we want another person to know from our writing?",
      "How can pictures help us plan what to write?"
    ],
    "resources": "Illustrated story prompts, simple word banks, classroom word walls and writing books.",
    "assessment": "Review whether writing shares a coherent simple message and whether support is used productively; value meaning as well as neatness.",
    "competencies": "Creativity and imagination, communication and learning to learn. Values: care, respect and responsibility. PCIs: expression and inclusion."
  }
]

const card: CSSProperties = { border: '1px solid #dce7e0', borderRadius: 12, background: '#fff', padding: 15 }
const h: CSSProperties = { fontSize: 13, color: '#1d4937', fontWeight: 800, margin: '0 0 9px' }
const bullet: CSSProperties = { margin: '4px 0', lineHeight: 1.65, fontSize: 13, color: '#253d32' }

type LinkedCurriculumUnit = {
  id: string;
  name: string;
  sub_strand: string;
  outcomes: { id: string; outcome_text: string }[];
}

export default function Grade1EnglishMap({
  compact = false, selectedUnitId = '1.1', selectedThemeId = 1, onSelectUnit, onPlanUnit,
  mappedUnits, catalogLoading = false, catalogError = '',
}: {
  compact?: boolean;
  selectedUnitId?: string;
  selectedThemeId?: number;
  onSelectUnit?: (unitId: string) => void;
  onPlanUnit?: (unitId: string, themeId: number) => void;
  mappedUnits?: Record<string, LinkedCurriculumUnit>;
  catalogLoading?: boolean;
  catalogError?: string;
}) {
  const validUnitId = GRADE1_ENGLISH_UNITS.some(item => item.id === selectedUnitId) ? selectedUnitId : '1.1'
  const [selectedId, setSelectedId] = useState(validUnitId)
  useEffect(() => { setSelectedId(validUnitId) }, [validUnitId])
  const [search, setSearch] = useState('')
  const [themeId, setThemeId] = useState(selectedThemeId)
  useEffect(() => { setThemeId(GRADE1_ENGLISH_THEMES.some(theme=>theme.id===selectedThemeId) ? selectedThemeId : 1) }, [selectedThemeId])
  const theme = GRADE1_ENGLISH_THEMES.find(item => item.id === themeId) ?? GRADE1_ENGLISH_THEMES[0]
  const [indexOpen, setIndexOpen] = useState(false)
  const unit = GRADE1_ENGLISH_UNITS.find(item => item.id === selectedId) ?? GRADE1_ENGLISH_UNITS[0]
  const linkedUnit = mappedUnits?.[unit.id]
  const displayedOutcomes = linkedUnit ? linkedUnit.outcomes.map(outcome => outcome.outcome_text) : unit.outcomes
  const index = GRADE1_ENGLISH_UNITS.findIndex(item => item.id === unit.id)
  const contextualActivity = (() => {
    switch (unit.id) {
      case '1.1': return theme.context
      case '2.1': return 'Use a simple poster about ' + theme.title.toLowerCase() + ' to practise book and print tracking before reading.'
      case '2.2': return 'Blend sounds and read short familiar words from the theme, checking their meaning with pictures.'
      case '2.3': return 'Echo-read two short theme sentences aloud, focusing on smooth phrasing and pauses.'
      case '2.4': return 'Read or listen to a short illustrated theme text and answer who, what and where questions.'
      case '3.1': return 'Talk naturally about people, things and actions in a theme picture, using clear short sentences.'
      case '3.2': return 'Say one short sentence about a theme activity happening now and another about an earlier activity.'
      case '3.3': return 'Use the theme words to speak a clear and polite short message to a partner.'
      case '4.1': return 'Trace large marks and the starting letter shapes of familiar theme words using suitable writing tools.'
      case '4.2': return 'Copy two familiar theme words carefully, attending to clear letter shapes and spacing.'
      case '4.3': return 'Sound out and spell one or two taught words from the selected theme using a picture or word bank.'
      case '4.4': return 'Write one simple theme sentence with a starting capital letter and ending full stop.'
      case '4.5': return 'Discuss a theme picture, rehearse a short sentence orally and write it with supportive prompts.'
      default: return theme.context
    }
  })()

  const results = useMemo(() => {
    const term = search.trim().toLowerCase()
    return GRADE1_ENGLISH_UNITS.filter(item => !term || [item.id, item.title, ...item.outcomes].some(text => text.toLowerCase().includes(term)))
  }, [search])
  const choose = (id: string) => { setSelectedId(id); setIndexOpen(false); setSearch(''); onSelectUnit?.(id) }
  const list = (items: readonly string[]) => <ul style={{ paddingLeft: 19, margin: 0 }}>{items.map((item, i) => <li key={i} style={bullet}>{item}</li>)}</ul>

  return <section aria-label="VibeSchool Grade 1 English curriculum map" style={{ color: '#153b2a', maxWidth: '100%', overflowWrap: 'anywhere', marginBottom: 18, borderRadius: 16, border: '1px solid #dce7e0', background: '#f9fbfa', padding: 'clamp(13px,3vw,22px)' }}>
    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.09em', color: '#28624b' }}>VIBESCHOOL CURRICULUM MAP · GRADE 1</div>
    <h2 style={{ margin: '6px 0', fontSize: 'clamp(20px,3vw,26px)' }}>English</h2>
    <p style={{ color: '#536c60', fontSize: 13, lineHeight: 1.6, margin: '0 0 12px' }}>Read the annual curriculum directly inside the teacher app. Four strands · 13 sub-strands · 58 VibeSchool learning outcome descriptions · 15 themes · 150 suggested lessons.</p>
    <div style={{ ...card, background: '#eff6f1', fontSize: 12, lineHeight: 1.6, marginBottom: 15 }}>
      <strong>Source:</strong> KICD 2024 revised Grades 1–3 English curriculum. This is independently written VibeSchool guidance, not the official KICD text; final source-to-outcome certification is pending. This reader groups the 13 recurring skill sub-strands; the source presents them across 15 themes. In Grades 1–3, teach language patterns naturally without explicit grammar labels.{' '}
      <a href={GRADE1_ENGLISH_SOURCE} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 800, color: '#13573e' }}>View original KICD source</a>.
      <div style={{ marginTop: 5, color: '#526d5e' }}>Curriculum scope is independent of the teacher’s weekly timetable, scheme and lesson plans.</div>
    </div>
    {/* The annual map is the subject's primary entry point. Select a strand to view its first sub-strand. */}
    <nav aria-label="Grade 1 English curriculum strands" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 8, marginBottom: 15 }}>
      {GRADE1_ENGLISH_STRANDS.map(strand => {
        const units = GRADE1_ENGLISH_UNITS.filter(item => item.strand === strand.id)
        const active = strand.id === unit.strand
        return <button type="button" key={strand.id} onClick={() => choose(units[0].id)} aria-pressed={active} style={{
          minHeight: 74, textAlign: 'left', border: active ? '2px solid #175b43' : '1px solid #bad0c1',
          borderRadius: 12, background: active ? '#e6f3e9' : '#fff', color: '#173f32',
          padding: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <strong style={{ fontSize: 13 }}>{strand.title}</strong>
          <span style={{ fontSize: 11, color: '#536c60' }}>{units.length} sub-strand{units.length === 1 ? '' : 's'}</span>
        </button>
      })}
    </nav>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 12 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#587363' }}>STRAND {unit.strand} · SUB-STRAND {unit.id}</div>
        <h3 style={{ fontSize: 19, margin: '4px 0' }}>{unit.title}</h3>
        <div style={{ fontSize: 12, color: '#607467' }}>{GRADE1_ENGLISH_STRANDS.find(s => s.id === unit.strand)?.title} · {unit.lessons} suggested lessons</div>
      </div>
      <button type="button" onClick={() => setIndexOpen(x => !x)} aria-expanded={indexOpen} aria-controls="grade1-english-index" style={{ minHeight: 44, border: '1px solid #9fbbaa', borderRadius: 10, background: '#fff', padding: '10px 13px', fontWeight: 800, color: '#175b43', cursor: 'pointer' }}>{indexOpen ? 'Close topics' : 'All 13 sub-strands'}</button>
    </div>
    {indexOpen && <div id="grade1-english-index" style={{ ...card, marginBottom: 14 }}>
      <label htmlFor="grade1-english-search" style={h}>Find a sub-strand or outcome</label>
      <input id="grade1-english-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search all 13 sub-strands" style={{ boxSizing: 'border-box', width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid #a9c2b1', fontSize: 15, minHeight: 44 }} />
      <nav aria-label="Grade 1 English strands and sub-strands" style={{ maxHeight: 350, overflowY: 'auto', marginTop: 12 }}>
        {GRADE1_ENGLISH_STRANDS.map(strand => {
          const items = results.filter(item => item.strand === strand.id)
          return items.length ? <div key={strand.id} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#527765', fontWeight: 850, margin: '4px 0' }}>STRAND {strand.id} · {strand.title}</div>
            {items.map(item => <button type="button" key={item.id} aria-current={item.id === unit.id ? 'true' : undefined} onClick={() => choose(item.id)} style={{ width: '100%', background: item.id === unit.id ? '#e7f2ea' : '#fff', border: '1px solid #e0e9e2', color: '#204836', borderRadius: 8, padding: '10px 11px', textAlign: 'left', minHeight: 44, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
              <span><strong>{item.id}</strong> {item.title}</span><span aria-hidden="true">›</span>
            </button>)}
          </div> : null
        })}
        {!results.length && <p style={{ fontSize: 13 }}>No matching curriculum entries.</p>}
      </nav>
    </div>}
    <div style={{ ...card, background: '#f2f7fa', marginBottom: 12 }}>
      <label htmlFor="grade1-english-theme" style={h}>Teaching theme (15 KICD contexts)</label>
      <select id="grade1-english-theme" value={themeId} onChange={event => setThemeId(Number(event.target.value))} style={{ display: 'block', width: '100%', minHeight: 44, padding: '10px 12px', border: '1px solid #a9c2b1', background: '#fff', borderRadius: 9, fontSize: 15 }}>
        {GRADE1_ENGLISH_THEMES.map(item => <option key={item.id} value={item.id}>{item.id}. {item.title}</option>)}
      </select>
      <p style={{ ...bullet, marginTop: 9 }}><strong>Useful words:</strong> {theme.words}</p>
      <p style={{ ...bullet, marginTop: 6 }}><strong>VibeSchool activity for this skill:</strong> {contextualActivity}</p>
      <p style={{ fontSize: 11, color: '#567065', margin: '7px 0 0' }}>The theme supplies familiar context for the selected skill; it does not assign a fixed instructional week or create a lesson plan.</p>
    </div>
    {onPlanUnit && <div style={{ ...card, marginBottom: 14, borderColor: '#9fbbaa' }}>
      {linkedUnit ? <button type="button" onClick={() => onPlanUnit(unit.id, themeId)} style={{ width: '100%', minHeight: 44, padding: '11px 14px', borderRadius: 10, border: 0, background: '#175b43', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Plan this sub-strand in Scheme of Work</button>
        : <p role="status" style={{ fontSize: 13, color: '#526d5e', margin: 0 }}>{catalogLoading ? 'Connecting persisted curriculum outcomes…' : catalogError || 'This sub-strand is not yet connected to a database curriculum record.'}</p>}
      <p style={{ margin: '8px 0 0', fontSize: 12, color: '#526d5e' }}>Select an instructional week and real stored outcome IDs before saving. VibeSchool-authored guidance is not official KICD text.</p>
    </div>}
    <article aria-label={'Sub-strand ' + unit.id + ' ' + unit.title} style={{ display: 'grid', gap: 11 }}>
      <div style={card}><h4 style={h}>VibeSchool learning outcomes ({displayedOutcomes.length})</h4>{list(displayedOutcomes.map((text, i) => String.fromCharCode(97 + i) + '. ' + text))}</div>
      <div style={card}><h4 style={h}>Suggested learning experiences</h4>{list(unit.experiences)}</div>
      <div style={card}><h4 style={h}>Key inquiry questions</h4>{list(unit.inquiry)}</div>
      <div style={card}><h4 style={h}>Competencies, values and issues</h4><p style={bullet}>{unit.competencies}</p></div>
      <div style={card}><h4 style={h}>Assessment guidance</h4><p style={bullet}>{unit.assessment}</p></div>
      <div style={card}><h4 style={h}>Learning resources</h4><p style={bullet}>{unit.resources}</p></div>
      {unit.safety && <div style={{ ...card, background: '#fffaf0' }}><h4 style={h}>Safety and inclusion</h4><p style={bullet}>{unit.safety}</p></div>}
    </article>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 15 }}>
      <button type="button" disabled={index === 0} onClick={() => choose(GRADE1_ENGLISH_UNITS[index - 1].id)} style={{ minHeight: 44, padding: '10px 14px', borderRadius: 10, border: '1px solid #c8d7cc', background: '#fff', color: '#1a5a40', fontWeight: 700, opacity: index === 0 ? 0.45 : 1, cursor: index === 0 ? 'default' : 'pointer' }}>← Previous</button>
      <button type="button" disabled={index === GRADE1_ENGLISH_UNITS.length - 1} onClick={() => choose(GRADE1_ENGLISH_UNITS[index + 1].id)} style={{ minHeight: 44, padding: '10px 14px', borderRadius: 10, border: 'none', background: '#175b43', color: '#fff', fontWeight: 800, opacity: index === GRADE1_ENGLISH_UNITS.length - 1 ? 0.45 : 1, cursor: index === GRADE1_ENGLISH_UNITS.length - 1 ? 'default' : 'pointer' }}>Next topic →</button>
    </div>
    {!compact && <p style={{ fontSize: 11, color: '#5f776b', margin: '13px 0 0' }}>Reference: VS-CUR-G01-EN-2026. These reading entries are not verified canonical database outcomes and do not change teaching records.</p>}
  </section>
}

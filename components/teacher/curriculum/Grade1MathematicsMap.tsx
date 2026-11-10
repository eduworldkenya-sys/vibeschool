'use client'

import { useMemo, useState, type CSSProperties } from 'react'

/**
 * Read-only curriculum reference drawn from the independent VibeSchool
 * Grade 1 Mathematics edition (VS-CUR-G01-MA-2026).
 *
 * Do not promote these VibeSchool-authored descriptions to "KICD verified".
 * This annual reference is distinct from the canonical, dated curriculum
 * records and the teacher-owned Scheme of Work. No PDF rendering required.
 */
export const GRADE1_MATHEMATICS_SOURCE = 'https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-1-3-Mathematics-Revised.pdf'

type CurriculumUnit = {
  id: string
  title: string
  strand: 1 | 2 | 3
  lessons: number
  outcomes: readonly string[]
  experiences: readonly string[]
  inquiry: readonly string[]
  resources: string
  assessment: string
  competencies: string
  safety?: string
}

export const GRADE1_MATHEMATICS_STRANDS = [
  { id: 1, title: 'Numbers' },
  { id: 2, title: 'Measurement' },
  { id: 3, title: 'Geometry' },
] as const

/** The 11 sub-strands, 54 VibeSchool outcome descriptions and KICD-suggested lesson counts. */
export const GRADE1_MATHEMATICS_UNITS: readonly CurriculumUnit[] = [
  {
    "id": "1.1",
    "title": "Pre-Number Activities",
    "strand": 1,
    "lessons": 20,
    "outcomes": [
      "Sort familiar safe objects into sets using a shared feature such as colour, size, shape, texture or purpose.",
      "Pair objects that share a clearly identifiable feature.",
      "Arrange objects in a chosen order, for example from smallest to largest.",
      "Build and explain repeating patterns using objects of different shapes or sizes.",
      "Use sorting and grouping when organising everyday materials."
    ],
    "experiences": [
      "Gather clean classroom objects; explain the reason for each group rather than merely making piles.",
      "Match picture cards or objects with similar features; compare partners' choices.",
      "Arrange objects by size and design a repeating pattern using lids, blocks or drawings."
    ],
    "inquiry": [
      "What rule did you use to group these objects?",
      "How can another learner continue your pattern?"
    ],
    "resources": "Clean bottle tops, safe blocks, picture cards, coloured paper and reusable sorting trays.",
    "assessment": "Observe sorting, matching, ordering and pattern-extension tasks; ask learners to state their rule.",
    "competencies": "Creativity and imagination; self-efficacy. Values: unity and responsibility. PCIs: safe use of materials and social cohesion.",
    "safety": "Use large, clean, non-sharp counters; offer tactile objects and high-contrast cards."
  },
  {
    "id": "1.2",
    "title": "Whole Numbers",
    "strand": 1,
    "lessons": 25,
    "outcomes": [
      "Count forwards accurately through the numbers from 1 to 50.",
      "Count backwards starting at 30.",
      "Show quantities from 1 to 30 with physical counters or grouped objects.",
      "Recognise, read and write number symbols from 1 to 50.",
      "Read and write the number names one to ten.",
      "Fill gaps in simple number sequences within 20.",
      "Invent and extend number patterns within 20 during learning games."
    ],
    "experiences": [
      "Count classroom objects in turns, first slowly and then with number cards for checking.",
      "Build quantities using counters and match them with numeral cards; practise numeral formation.",
      "Complete missing-number strips and make original patterns for a partner to extend."
    ],
    "inquiry": [
      "How can we check that every object was counted once?",
      "What is the rule for the missing number?"
    ],
    "resources": "Counters, numeral cards 1–50, a large number line, pencils and an optional accessible counting game.",
    "assessment": "Ask learners to count forwards and backwards, represent a quantity, write symbols and number names, and continue a pattern.",
    "competencies": "Digital literacy where available; creativity; turn-taking and respect. PCIs: environmental safety and cooperation."
  },
  {
    "id": "1.3",
    "title": "Addition",
    "strand": 1,
    "lessons": 25,
    "outcomes": [
      "Demonstrate addition by combining two groups of objects and counting the new total.",
      "Record addition using the plus and equals symbols correctly.",
      "Find totals when two single-digit quantities are combined.",
      "Find totals when three single-digit quantities are combined.",
      "Add a one-digit quantity to a two-digit quantity without regrouping, keeping the total within 50.",
      "Work out missing terms in additive number patterns within 50.",
      "Use games or suitable digital activities to practise addition strategies."
    ],
    "experiences": [
      "Use two piles of counters to show that joining groups creates a larger combined set.",
      "Translate picture stories into addition statements and practise with dice.",
      "Work with tens-and-ones cards to add without regrouping, then describe the method used."
    ],
    "inquiry": [
      "What changes when two groups are combined?",
      "How can we add a small number to a two-digit number?"
    ],
    "resources": "Counters, dice, number cards, a place-value chart, an abacus where available and simple story cards.",
    "assessment": "Check concrete modelling, correct use of signs, the 2- and 3-addend calculations and two-digit plus one-digit calculations without regrouping.",
    "competencies": "Problem solving; creativity and collaboration. Values: inclusion and fairness. PCIs: safety and creative thinking."
  },
  {
    "id": "1.4",
    "title": "Subtraction",
    "strand": 1,
    "lessons": 20,
    "outcomes": [
      "Show subtraction by physically removing part of a collection.",
      "Write subtraction number sentences with the minus and equals symbols.",
      "Subtract one single-digit number from another.",
      "Subtract a one-digit number from a two-digit number without regrouping.",
      "Continue or complete subtraction-based number patterns involving numbers to 50.",
      "Use age-appropriate games or digital activities to practise subtraction."
    ],
    "experiences": [
      "Start with a set of counters, take some away and describe the remainder.",
      "Show subtraction as movement backwards on a number path and write corresponding statements.",
      "Use a number chart to practise subtraction within 50 without crossing a ten in the written two-digit examples."
    ],
    "inquiry": [
      "How does taking away change the quantity?",
      "How can counting backwards help us subtract?"
    ],
    "resources": "Counters, number lines, numeral cards, a place-value board and picture word problems.",
    "assessment": "Use demonstrations and short questions to verify the subtraction process, signs and answers without regrouping.",
    "competencies": "Learning to learn; creativity; shared responsibility and unity. PCIs: collaboration and reasoning."
  },
  {
    "id": "2.1",
    "title": "Length",
    "strand": 2,
    "lessons": 10,
    "outcomes": [
      "Select safe everyday items that differ in length.",
      "Compare two objects using longer, shorter and equal-length descriptions.",
      "Measure the length of an object with a consistent informal unit.",
      "Explain why comparing and measuring lengths is helpful in ordinary situations."
    ],
    "experiences": [
      "Compare pencils, leaves and ribbons by placing them beside each other with one end aligned.",
      "Use hand spans, footsteps or paper strips to measure objects and discuss why answers may vary.",
      "Make a classroom display of objects ordered by length."
    ],
    "inquiry": [
      "Which item is longer and how can we tell?",
      "What can we use to measure a table when we have no ruler?"
    ],
    "resources": "Ribbons, pencils, string, paper strips, blocks and a clear floor area.",
    "assessment": "Observe correct comparisons and consistent counting of non-standard measuring units.",
    "competencies": "Self-efficacy; communication and collaboration. Values: responsibility. PCIs: social cohesion and environmental care."
  },
  {
    "id": "2.2",
    "title": "Mass",
    "strand": 2,
    "lessons": 10,
    "outcomes": [
      "Find safe classroom items with noticeably different masses.",
      "Describe relative mass using heavier, lighter or the same.",
      "Compare and measure mass through a suitable informal balancing or reference method.",
      "Recognise everyday situations where comparing mass is useful."
    ],
    "experiences": [
      "Predict which of two safe objects is heavier and test using a simple balance.",
      "Compare classroom objects and describe the results to a partner.",
      "Use identical small units to balance an object and record the count."
    ],
    "inquiry": [
      "Can a large object be lighter than a smaller one?",
      "How can a balance help us compare two objects?"
    ],
    "resources": "A simple balance, identical small reference objects, sealed dry goods and safe everyday items.",
    "assessment": "Check comparisons and repeatable informal measurements; ask learners to explain evidence rather than guessing from size.",
    "competencies": "Communication and collaboration; digital literacy when appropriate. Values: respect and unity. PCIs: safety and effective communication.",
    "safety": "Do not handle heavy, sharp or fragile items; use sealed containers and supervise balancing."
  },
  {
    "id": "2.3",
    "title": "Capacity",
    "strand": 2,
    "lessons": 12,
    "outcomes": [
      "Select safe containers that hold different amounts.",
      "Compare containers as holding more, less or an equal amount.",
      "Measure capacity using repeated fills from the same informal unit.",
      "Find practical uses for clean empty containers instead of discarding them."
    ],
    "experiences": [
      "Estimate which of two containers will hold more and test with water in a controlled area.",
      "Use the same cup to count how many fills a larger container takes.",
      "Discuss clean, safe ways of reusing containers for storage."
    ],
    "inquiry": [
      "How can we find which container holds more?",
      "Why must we use the same cup when comparing capacity?"
    ],
    "resources": "Clean plastic containers, one measuring cup per comparison, a shallow basin, water and towels.",
    "assessment": "Observe comparison vocabulary, repeated fills and recording; check responsible container reuse.",
    "competencies": "Problem solving and learning to learn. Values: responsibility and unity. PCIs: safe water handling and sustainable use.",
    "safety": "Supervise water, clean spills immediately and avoid glass, chemical or previously hazardous containers."
  },
  {
    "id": "2.4",
    "title": "Time",
    "strand": 2,
    "lessons": 8,
    "outcomes": [
      "Name the seven days of the week in their usual order.",
      "Associate common activities with particular days of the week.",
      "Name the twelve months of the year.",
      "Describe everyday routines that take place on different days."
    ],
    "experiences": [
      "Arrange day cards into a correct weekly sequence and relate them to familiar routines.",
      "Use a song or rhyme to rehearse month names in sequence.",
      "Make a simple personal week chart with school, family and leisure activities."
    ],
    "inquiry": [
      "Which day comes before or after a chosen day?",
      "How do we organise activities over a week?"
    ],
    "resources": "Day and month cards, a simple calendar, routine illustrations and paper.",
    "assessment": "Listen for correct sequence and identification of days and months; review a learner's weekly routine chart.",
    "competencies": "Self-efficacy; communication and collaboration. Values: peaceful participation and respect for varied family routines. PCIs: citizenship and inclusion."
  },
  {
    "id": "2.5",
    "title": "Money",
    "strand": 2,
    "lessons": 8,
    "outcomes": [
      "Recognise Kenyan currency coins by appearance and denomination.",
      "Identify the Kenyan fifty-shilling banknote.",
      "Count selected currency coins one at a time and state their values.",
      "Use the exact amount in a simulated purchase involving no more than two items, without change.",
      "Describe situations where money is used to pay for goods."
    ],
    "experiences": [
      "Compare real or imitation Kenyan money images and talk about their values.",
      "Set up a pretend shop with simple price labels and practise paying the exact price.",
      "Count the value of selected single coins, avoiding transactions that require calculating change."
    ],
    "inquiry": [
      "How can we tell the value of money we are using?",
      "What do we need to buy two items with exactly the right amount?"
    ],
    "resources": "Up-to-date Kenyan currency images or safe imitations, picture price tags, shopping baskets and paper item cards.",
    "assessment": "Check denomination recognition, counting and correct exact-payment role-play up to two items.",
    "competencies": "Citizenship and confidence. Values: integrity and responsibility. PCIs: basic financial literacy.",
    "safety": "Use replicas or images rather than requiring learners to bring money; verify denominations still in circulation when choosing examples."
  },
  {
    "id": "3.1",
    "title": "Lines",
    "strand": 3,
    "lessons": 6,
    "outcomes": [
      "Spot straight lines in classroom objects and familiar surroundings.",
      "Make straight line marks on suitable surfaces.",
      "Recognise curved lines in objects and drawings.",
      "Draw curved lines using appropriate classroom materials.",
      "Distinguish examples of straight and curved edges in real-life objects."
    ],
    "experiences": [
      "Look for lines on desks, books, wheels or paths and classify them.",
      "Connect two marked points with a straight line on paper, then draw several curved paths.",
      "Create a picture that combines both kinds of lines and explain the choices."
    ],
    "inquiry": [
      "How is a curved line different from a straight one?",
      "Where can we see examples of each in our classroom?"
    ],
    "resources": "Paper, pencils, chalk, large shape cards and familiar classroom objects.",
    "assessment": "Review recognition, drawing and naming of straight and curved lines.",
    "competencies": "Learning to learn; self-efficacy. Values: respect and responsibility. PCIs: cooperation and awareness of the environment."
  },
  {
    "id": "3.2",
    "title": "Shapes",
    "strand": 3,
    "lessons": 6,
    "outcomes": [
      "Identify circles, triangles and rectangles in familiar objects and pictures.",
      "Create and repeat visual patterns using circles, triangles, rectangles and ovals.",
      "Notice and describe decorative shape patterns in ordinary materials."
    ],
    "experiences": [
      "Find simple shapes in classroom pictures and safe real objects.",
      "Arrange paper shape cut-outs in a repeated sequence, explaining the order.",
      "Colour a shape pattern and compare it with patterns seen on fabric or household items."
    ],
    "inquiry": [
      "Which shapes can we recognise around us?",
      "How can repeated shapes make a pattern?"
    ],
    "resources": "Large shape cut-outs, coloured paper, safe classroom objects, crayons and pattern cards.",
    "assessment": "Check naming of shapes and ability to construct and explain a repeating pattern.",
    "competencies": "Creativity and imagination; learning to learn. Values: peaceful cooperation and responsibility. PCIs: classroom safety and creative thinking.",
    "safety": "Use pre-cut shapes and supervise scissors if used."
  }
]

const card: CSSProperties = { border: '1px solid #dce7e0', borderRadius: 12, background: '#fff', padding: 15 }
const h: CSSProperties = { fontSize: 13, color: '#1d4937', fontWeight: 800, margin: '0 0 9px' }
const bullet: CSSProperties = { margin: '4px 0', lineHeight: 1.65, fontSize: 13, color: '#253d32' }

export default function Grade1MathematicsMap({ compact = false }: { compact?: boolean }) {
  const [selectedId, setSelectedId] = useState('1.1')
  const [search, setSearch] = useState('')
  const [indexOpen, setIndexOpen] = useState(false)
  const unit = GRADE1_MATHEMATICS_UNITS.find(item => item.id === selectedId) ?? GRADE1_MATHEMATICS_UNITS[0]
  const index = GRADE1_MATHEMATICS_UNITS.findIndex(item => item.id === unit.id)
  const results = useMemo(() => {
    const term = search.trim().toLowerCase()
    return GRADE1_MATHEMATICS_UNITS.filter(item => !term || [item.id, item.title, ...item.outcomes].some(text => text.toLowerCase().includes(term)))
  }, [search])
  const choose = (id: string) => { setSelectedId(id); setIndexOpen(false); setSearch('') }
  const list = (items: readonly string[]) => <ul style={{ paddingLeft: 19, margin: 0 }}>{items.map((item, i) => <li key={i} style={bullet}>{item}</li>)}</ul>

  return <section aria-label="VibeSchool Grade 1 Mathematics curriculum map" style={{ color: '#153b2a', maxWidth: '100%', overflowWrap: 'anywhere', marginBottom: 18, borderRadius: 16, border: '1px solid #dce7e0', background: '#f9fbfa', padding: 'clamp(13px,3vw,22px)' }}>
    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.09em', color: '#28624b' }}>VIBESCHOOL CURRICULUM LIBRARY · GRADE 1</div>
    <h2 style={{ margin: '6px 0', fontSize: 'clamp(20px,3vw,26px)' }}>Mathematics</h2>
    <p style={{ color: '#536c60', fontSize: 13, lineHeight: 1.6, margin: '0 0 12px' }}>Read the annual curriculum directly inside the teacher app. Three strands · 11 sub-strands · 54 mapped VibeSchool learning outcomes · 150 suggested lessons.</p>
    <div style={{ ...card, background: '#eff6f1', fontSize: 12, lineHeight: 1.6, marginBottom: 15 }}>
      <strong>Source:</strong> KICD 2024 revised Grades 1–3 Mathematics curriculum. This is independently written VibeSchool guidance, not the official KICD text; final source-to-outcome certification is pending.{' '}
      <a href={GRADE1_MATHEMATICS_SOURCE} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 800, color: '#13573e' }}>View original KICD source</a>.
      <div style={{ marginTop: 5, color: '#526d5e' }}>Curriculum scope is independent of the teacher’s weekly timetable, scheme and lesson plans.</div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 12 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#587363' }}>STRAND {unit.strand} · SUB-STRAND {unit.id}</div>
        <h3 style={{ fontSize: 19, margin: '4px 0' }}>{unit.title}</h3>
        <div style={{ fontSize: 12, color: '#607467' }}>{GRADE1_MATHEMATICS_STRANDS.find(s => s.id === unit.strand)?.title} · {unit.lessons} suggested lessons</div>
      </div>
      <button type="button" onClick={() => setIndexOpen(x => !x)} aria-expanded={indexOpen} aria-controls="grade1-mathematics-index" style={{ minHeight: 44, border: '1px solid #9fbbaa', borderRadius: 10, background: '#fff', padding: '10px 13px', fontWeight: 800, color: '#175b43', cursor: 'pointer' }}>{indexOpen ? 'Close topics' : 'All 11 topics'}</button>
    </div>
    {indexOpen && <div id="grade1-mathematics-index" style={{ ...card, marginBottom: 14 }}>
      <label htmlFor="grade1-mathematics-search" style={h}>Find a sub-strand or outcome</label>
      <input id="grade1-mathematics-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search all 11 topics" style={{ boxSizing: 'border-box', width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid #a9c2b1', fontSize: 15, minHeight: 44 }} />
      <nav aria-label="Grade 1 Mathematics strands and sub-strands" style={{ maxHeight: 350, overflowY: 'auto', marginTop: 12 }}>
        {GRADE1_MATHEMATICS_STRANDS.map(strand => {
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
    <article aria-label={'Sub-strand ' + unit.id + ' ' + unit.title} style={{ display: 'grid', gap: 11 }}>
      <div style={card}><h4 style={h}>Specific learning outcomes ({unit.outcomes.length})</h4>{list(unit.outcomes.map((text, i) => String.fromCharCode(97 + i) + '. ' + text))}</div>
      <div style={card}><h4 style={h}>Suggested learning experiences</h4>{list(unit.experiences)}</div>
      <div style={card}><h4 style={h}>Key inquiry questions</h4>{list(unit.inquiry)}</div>
      <div style={card}><h4 style={h}>Competencies, values and issues</h4><p style={bullet}>{unit.competencies}</p></div>
      <div style={card}><h4 style={h}>Assessment guidance</h4><p style={bullet}>{unit.assessment}</p></div>
      <div style={card}><h4 style={h}>Learning resources</h4><p style={bullet}>{unit.resources}</p></div>
      {unit.safety && <div style={{ ...card, background: '#fffaf0' }}><h4 style={h}>Safety and inclusion</h4><p style={bullet}>{unit.safety}</p></div>}
    </article>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 15 }}>
      <button type="button" disabled={index === 0} onClick={() => choose(GRADE1_MATHEMATICS_UNITS[index - 1].id)} style={{ minHeight: 44, padding: '10px 14px', borderRadius: 10, border: '1px solid #c8d7cc', background: '#fff', color: '#1a5a40', fontWeight: 700, opacity: index === 0 ? 0.45 : 1, cursor: index === 0 ? 'default' : 'pointer' }}>← Previous</button>
      <button type="button" disabled={index === GRADE1_MATHEMATICS_UNITS.length - 1} onClick={() => choose(GRADE1_MATHEMATICS_UNITS[index + 1].id)} style={{ minHeight: 44, padding: '10px 14px', borderRadius: 10, border: 'none', background: '#175b43', color: '#fff', fontWeight: 800, opacity: index === GRADE1_MATHEMATICS_UNITS.length - 1 ? 0.45 : 1, cursor: index === GRADE1_MATHEMATICS_UNITS.length - 1 ? 'default' : 'pointer' }}>Next topic →</button>
    </div>
    {!compact && <p style={{ fontSize: 11, color: '#5f776b', margin: '13px 0 0' }}>Reference: VS-CUR-G01-MA-2026. These reading entries are not verified canonical database outcomes and do not change teaching records.</p>}
  </section>
}

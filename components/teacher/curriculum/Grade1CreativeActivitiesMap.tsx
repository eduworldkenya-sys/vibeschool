'use client'

import { useMemo, useState, type CSSProperties } from 'react'

/**
 * Read-only curriculum reference drawn from the independent VibeSchool
 * Grade 1 Creative Activities edition (VS-CUR-G01-CA-2026).
 *
 * Do not promote these VibeSchool-authored descriptions to "KICD verified".
 * This annual reference is distinct from the canonical, dated curriculum
 * records and the teacher-owned Scheme of Work. No PDF rendering required.
 */
export const GRADE1_CREATIVE_SOURCE = 'https://drive.google.com/file/d/1vrC5cJO2MpDm9v4u3-qwCze9yPa9HcEZ/preview'

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

export const GRADE1_CREATIVE_STRANDS = [
  { id: 1, title: 'Creating and Executing' },
  { id: 2, title: 'Performing and Displaying' },
  { id: 3, title: 'Appreciation' },
] as const

/** The 16 sub-strands, 68 VibeSchool outcome descriptions and KICD-suggested lesson counts. */
export const GRADE1_CREATIVE_UNITS: readonly CurriculumUnit[] = [
  {
    id: '1.1', title: 'Jumping', strand: 1, lessons: 14,
    outcomes: ['Recognise different kinds of jumps and how each challenges body control.', 'Plan and make simple, safe jump markers from appropriate materials.', 'Perform small jumps for height and distance, including changes of direction.', 'Coordinate jumping movements with group singing.', 'Take part confidently while observing personal and shared safety.'],
    experiences: ['Compare demonstrations of upward, forward and sideways jumping and describe how the body moves.', 'Set out flat markers, agree on safe landing areas and practise height, distance and directional jumps.', 'Coordinate jumps with a simple song, then discuss safe landings and helpful techniques.'],
    inquiry: ['How does the direction of a jump change our movement?', 'What makes homemade jumping markers safe?'],
    resources: 'Level open space, flat markers, pictures, soft mats where available and drinking water.',
    assessment: 'Observe jump types, controlled take-off and landing, directions, safe improvisation, coordination with a song and positive participation.',
    competencies: 'Creativity; communication and collaboration; responsibility and unity.',
    safety: 'Avoid raised obstacles, slippery surfaces and overcrowding. Offer an accessible low-impact movement alternative.',
  },
  {
    id: '1.2', title: 'Rhythm', strand: 1, lessons: 14,
    outcomes: ['Recognise regular pulses in everyday sounds.', 'Keep a steady beat using a percussion instrument while singing.', 'Create a body-percussion accompaniment for a familiar song.', 'Appreciate rhythmic sound-making with others.'],
    experiences: ['Listen for repeating pulses and mark them by clapping, tapping, marching or stamping.', 'Use a safe shaker or drum to maintain a beat while a group sings.', 'Invent a short body-sound pattern, repeat it and reflect on the group timing.'],
    inquiry: ['How does a regular beat help a group sing together?', 'How can hands and feet become percussion instruments?'],
    resources: 'Hands, safe shakers or drums, familiar songs and optional sound recordings.',
    assessment: 'Listen for recognition of pulse, steady timing, a repeatable original pattern and respectful group performance.',
    competencies: 'Learning to learn; self-efficacy; teamwork; unity.',
  },
  {
    id: '1.3', title: 'Drawing', strand: 1, lessons: 14,
    outcomes: ['Identify straight, curved, wavy and zigzag lines.', 'Draw vertical, horizontal and diagonal lines.', 'Combine different line types to make repeated patterns.', 'Use drawing to express ideas and appreciate the work of others.'],
    experiences: ['Find line types in familiar objects and pictures.', 'Draw lines in varied directions using pencils, crayons or suitable local tools.', 'Arrange different lines into a repeating pattern and share what the image communicates.'],
    inquiry: ['What can we express by changing the direction or shape of a line?'],
    resources: 'Paper, pencils, crayons or safe charcoal, example images and reusable drawing surfaces.',
    assessment: 'Inspect line identification, direction, pattern repetition, personal expression and constructive response to artwork.',
    competencies: 'Creativity and imagination; communication; care for shared materials.',
  },
  {
    id: '1.4', title: 'Stretching', strand: 1, lessons: 14,
    outcomes: ['Identify body parts used during stretching.', 'Demonstrate gentle stretches forwards, backwards, sideways and upwards in different positions.', 'Participate willingly in stretching for physical fitness.'],
    experiences: ['Name joints and limbs used in stretching.', 'Demonstrate gentle stretches while standing, sitting, kneeling or lying with safe body control.', 'Try an age-appropriate flexibility game and discuss how stretching feels.'],
    inquiry: ['Why do we stretch in different directions and positions?'],
    resources: 'Clean mats, direction cards, a safe open area and chairs for adapted movement.',
    assessment: 'Observe body-part awareness, correct directions, controlled movement, safety and willingness to participate.',
    competencies: 'Collaboration; self-awareness; personal responsibility and care.',
    safety: 'Do not force joints or stretch to pain. Provide seated or supported alternatives.',
  },
  {
    id: '1.5', title: 'Painting and Colouring', strand: 1, lessons: 14,
    outcomes: ['Identify suitable painting and colouring tools.', 'Choose colours to represent observed surroundings.', 'Apply paint inside simple shapes using a brush.', 'Make expressive marks or images with finger painting.', 'Use a sponge to apply paint to a surface.', 'Enjoy expressing ideas through colour and paint.'],
    experiences: ['Explore objects, scenes, colours and appropriate tools.', 'Practise colouring within simple shapes and use brushes, fingers and sponges to make different marks.', 'Display work, explain material choices and clean the workspace responsibly.'],
    inquiry: ['What changes when we paint using a brush, fingers or a sponge?'],
    resources: 'Non-toxic paint, broad brushes, clean sponges, paper, water and protective clothing.',
    assessment: 'Check tool recognition, colour choice, brush/finger/sponge techniques, finished work and safe clean-up.',
    competencies: 'Critical thinking; creativity; self-efficacy; responsibility.',
    safety: 'Use washable non-toxic materials; prevent ingestion and provide alternatives for skin sensitivity.',
  },
  {
    id: '1.6', title: 'Melody', strand: 1, lessons: 14,
    outcomes: ['Distinguish melodic sounds from ordinary noise.', 'Compare short melodic phrases for similarity or difference.', 'Repeat short tunes by humming or singing.', 'Enjoy careful listening and musical echoing.'],
    experiences: ['Listen to pitched and non-pitched sounds and compare them.', 'Listen to pairs of short melodies and identify which sound alike.', 'Echo brief tunes with the voice, individually or in a supportive group.'],
    inquiry: ['How can careful listening tell us whether two tunes are alike?'],
    resources: 'Teacher voice, short tune examples and optional tuned instruments or recordings.',
    assessment: 'Use listening checks and short echo activities to assess pitch awareness, phrase matching and participation.',
    competencies: 'Listening; self-efficacy; communication and collaboration.',
  },
  {
    id: '1.7', title: 'Pattern Making', strand: 1, lessons: 10,
    outcomes: ['Recognise repeating arrangements made with letters and numbers.', 'Create patterns using repeating letters.', 'Make number-based visual patterns.', 'Enjoy using repetition for creative expression.'],
    experiences: ['Observe and describe repeated letters and numerals.', 'Arrange letter cards in a predictable pattern and explain the repeating section.', 'Create and share an original number-based pattern.'],
    inquiry: ['How can we tell what comes next in a repeating pattern?'],
    resources: 'Letter and number cards, pencils, paper, string and reusable tiles.',
    assessment: 'Look for correct identification of the repeating part, ability to extend and create patterns, and an explanation of the pattern rule.',
    competencies: 'Creativity; learning to learn; communication; responsibility.',
  },
  {
    id: '2.1', title: 'Kenyan Singing Games', strand: 2, lessons: 13,
    outcomes: ['Identify props used in singing games from Kenyan communities.', 'Make an appropriate simple substitute prop.', 'Participate in a culturally grounded singing game with music, movement and roles.', 'Appreciate singing-game traditions and respectful group participation.'],
    experiences: ['Observe examples of local singing games and name their props.', 'Make a safe prop using available materials and practise group roles and formations.', 'Perform a selected game and discuss its cultural meaning and group cooperation.'],
    inquiry: ['How do props and group roles enrich a singing game?'],
    resources: 'Age-appropriate local songs, safe recycled props, a suitable movement area and community examples.',
    assessment: 'Observe props, safe improvisation, song participation, formations, teamwork and respect for cultural practices.',
    competencies: 'Citizenship; confidence; cooperation; cultural respect.',
    safety: 'Avoid unsafe props and stereotypes; adapt roles so all learners can participate.',
  },
  {
    id: '2.2', title: 'Throwing and Catching', strand: 2, lessons: 14,
    outcomes: ['Identify safe reusable materials for making a soft ball.', 'Make a suitable ball from available materials.', 'Throw and catch a ball with increasing control.', 'Enjoy cooperating in ball games.'],
    experiences: ['Sort clean, safe and unsafe ball-making materials.', 'Make a soft lightweight ball using fabric or paper with appropriate guidance.', 'Practise short-distance throws, catches and simple cooperative games.'],
    inquiry: ['What helps another player catch a ball successfully?'],
    resources: 'Soft balls, clean reusable fabric or paper, tape, targets and a clear open area.',
    assessment: 'Check material choice, ball construction, controlled throw and catch, safe spacing and cooperation.',
    competencies: 'Self-efficacy; collaboration; environmental care.',
    safety: 'Use soft balls, leave sufficient space and adapt ball size or distance to learner needs.',
  },
  {
    id: '2.3', title: 'Paper Craft', strand: 2, lessons: 10,
    outcomes: ['Identify objects made from paper.', 'Make an object by pleating paper.', 'Create an object through paper folding.', 'Use completed paper objects imaginatively in play.'],
    experiences: ['Observe everyday items made from paper and select clean materials.', 'Make a simple pleated paper fan and a different folded shape.', 'Use the completed items in imaginative play and describe the methods used.'],
    inquiry: ['How does folding change what a piece of paper can become?'],
    resources: 'Clean reused paper, example fans or toys, picture instructions and blunt tools.',
    assessment: 'Look for recognition of paper-made objects, purposeful pleating, correct folding and imaginative use.',
    competencies: 'Creativity; communication; learning to learn; responsible reuse.',
    safety: 'Avoid staples and sharp blades. Offer large sheets and tactile support where needed.',
  },
  {
    id: '2.4', title: 'Log Roll and T-Balance', strand: 2, lessons: 14,
    outcomes: ['Recognise body actions used in log rolling and T-balancing.', 'Prepare a safe movement area with simple markers.', 'Perform a controlled log roll.', 'Hold an appropriately aligned T-balance.', 'Participate positively while observing movement safety.'],
    experiences: ['Observe safe demonstrations of log rolling and a T-shaped balance.', 'Prepare a clear marked area and practise gradual balance movements with supervision.', 'Demonstrate an appropriate roll or adapted movement and reflect on body control.'],
    inquiry: ['Why are body control and space important during rolling and balancing?'],
    resources: 'Soft gym mats, floor markers, level space and trained adult supervision.',
    assessment: 'Observe understanding, safe space preparation, body alignment, controlled movement and responsibility.',
    competencies: 'Problem solving; cooperation; personal safety and respect.',
    safety: 'No rolls on hard ground or near obstacles; supervise closely and offer adapted alternatives.',
  },
  {
    id: '2.5', title: 'Action Songs', strand: 2, lessons: 13,
    outcomes: ['Explain the main idea communicated by an appropriate action song.', 'Perform action songs with suitable tune, rhythm, words, gestures and expression.', 'Enjoy expressive group singing and value others’ participation.'],
    experiences: ['Listen to a suitable song and discuss its message.', 'Practise matching gestures to words and maintaining a steady group rhythm.', 'Perform together and offer constructive comments about clarity and expression.'],
    inquiry: ['How can movement help communicate the meaning of a song?'],
    resources: 'Age-appropriate songs, gesture cards, optional recordings and safe space.',
    assessment: 'Assess song-message understanding, coordinated movements, tune, rhythm, clear words and cooperative singing.',
    competencies: 'Communication and collaboration; creativity; confidence.',
  },
  {
    id: '2.6', title: 'Modelling: Pinch Method', strand: 2, lessons: 14,
    outcomes: ['Identify simple objects shaped using the pinch technique.', 'Choose appropriate modelling materials and tools.', 'Create an object using controlled thumb-and-finger pinching.', 'Appreciate modelling and share completed objects confidently.'],
    experiences: ['Observe examples of vessels or objects made from soft modelling media.', 'Press and pinch clay or dough to form a simple hollow or raised shape.', 'Display models, describe the technique and clean up or reuse materials.'],
    inquiry: ['How can our fingers shape soft material into a useful object?'],
    resources: 'Clean non-toxic clay or dough, mats, sample objects and washing water.',
    assessment: 'Look for appropriate material choice, recognisable pinch technique, completed form and explanation.',
    competencies: 'Problem solving; creativity; self-efficacy; sustainability.',
    safety: 'Use non-toxic material and supervise small tools or loose parts.',
  },
  {
    id: '2.7', title: 'Percussion Musical Instruments', strand: 2, lessons: 10,
    outcomes: ['Recognise percussion instruments from several Kenyan communities.', 'Make a simple playable percussion instrument from suitable materials.', 'Play a percussion instrument for enjoyment or to support a song.', 'Appreciate the place of percussion in Kenyan cultural life.'],
    experiences: ['Observe drums, shakers or jingles and discuss their sound sources.', 'Construct a safe shaker or similar instrument using available clean materials.', 'Practise striking or shaking in time with singing and reflect on cultural uses.'],
    inquiry: ['How can safe everyday materials become musical instruments?'],
    resources: 'Illustrations of Kenyan percussion, sealed containers, safe filling materials and suitable tape.',
    assessment: 'Check instrument recognition, safe construction, playable sound, rhythmic accompaniment and cultural respect.',
    competencies: 'Creativity; citizenship; teamwork; environmental responsibility.',
    safety: 'Secure small fillings, supervise construction and protect hearing.',
  },
  {
    id: '3.1', title: 'Musical Sounds', strand: 3, lessons: 14,
    outcomes: ['Identify sound sources involving people, animals, birds and ordinary objects.', 'Distinguish loud/soft, fast/slow and high/low qualities in sounds.', 'Express personal responses to environmental sounds.', 'Describe the mood evoked by a short musical passage.', 'Enjoy listening carefully and talking about music.'],
    experiences: ['Listen to and identify sounds from familiar environments.', 'Compare paired examples for volume, speed and pitch.', 'Respond to short music or sounds with appropriate words, drawings or movement and describe the mood.'],
    inquiry: ['How do we identify sound qualities and what they make us feel?'],
    resources: 'Voices, nearby sounds, picture cards and optional short sound recordings.',
    assessment: 'Check sound-source recognition, comparison of qualities, mood responses and respectful listening.',
    competencies: 'Communication; creative imagination; cultural sensitivity.',
    safety: 'Avoid excessive sound levels; offer visual or vibration cues for varied hearing needs.',
  },
  {
    id: '3.2', title: 'Water Safety Awareness', strand: 3, lessons: 14,
    outcomes: ['Identify common water collection and storage points near home.', 'Recognise dangers associated with household and community water locations.', 'Make a picture montage showing water points.', 'Describe safe behaviour near different water sources.', 'Value water safety as an everyday life-protection habit.'],
    experiences: ['Examine pictures of tanks, containers, wells, rivers and other local water points.', 'Discuss realistic dangers and identify safer behaviour and when to seek adult help.', 'Create a picture montage showing water sources, warning signs and safety actions.'],
    inquiry: ['How can we recognise and avoid danger around water?'],
    resources: 'Pictures of water points, paper, glue, warning-sign images and adult-approved rules.',
    assessment: 'Check recognition of water points and hazards, montage accuracy, safe-action descriptions and responsible behaviour.',
    competencies: 'Communication; personal responsibility; health and safety awareness.',
    safety: 'Use classroom pictures and discussions; never take young learners to unsafe water sites for this activity.',
  },
]

const card: CSSProperties = { border: '1px solid #dce7e0', borderRadius: 12, background: '#fff', padding: 15 }
const h: CSSProperties = { fontSize: 13, color: '#1d4937', fontWeight: 800, margin: '0 0 9px' }
const bullet: CSSProperties = { margin: '4px 0', lineHeight: 1.65, fontSize: 13, color: '#253d32' }

export default function Grade1CreativeActivitiesMap({ compact = false, onPlanUnit, selectedUnitId = '1.1' }: { compact?: boolean; onPlanUnit?: (unitId: string) => void; selectedUnitId?: string }) {
  const [selectedId, setSelectedId] = useState(GRADE1_CREATIVE_UNITS.some(unit => unit.id === selectedUnitId) ? selectedUnitId : '1.1')
  const [search, setSearch] = useState('')
  const [indexOpen, setIndexOpen] = useState(false)
  const unit = GRADE1_CREATIVE_UNITS.find(item => item.id === selectedId) ?? GRADE1_CREATIVE_UNITS[0]
  const index = GRADE1_CREATIVE_UNITS.findIndex(item => item.id === unit.id)
  const results = useMemo(() => {
    const term = search.trim().toLowerCase()
    return GRADE1_CREATIVE_UNITS.filter(item => !term || [item.id, item.title, ...item.outcomes].some(text => text.toLowerCase().includes(term)))
  }, [search])
  const choose = (id: string) => { setSelectedId(id); setIndexOpen(false); setSearch('') }
  const list = (items: readonly string[]) => <ul style={{ paddingLeft: 19, margin: 0 }}>{items.map((item, i) => <li key={i} style={bullet}>{item}</li>)}</ul>

  return <section aria-label="VibeSchool Grade 1 Creative Activities curriculum map" style={{ color: '#153b2a', maxWidth: '100%', overflowWrap: 'anywhere', marginBottom: 18, borderRadius: 16, border: '1px solid #dce7e0', background: '#f9fbfa', padding: 'clamp(13px,3vw,22px)' }}>
    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.09em', color: '#28624b' }}>VIBESCHOOL CURRICULUM LIBRARY · GRADE 1</div>
    <h2 style={{ margin: '6px 0', fontSize: 'clamp(20px,3vw,26px)' }}>Creative Activities</h2>
    <p style={{ color: '#536c60', fontSize: 13, lineHeight: 1.6, margin: '0 0 12px' }}>Read the annual curriculum directly inside the teacher app. Three strands · 16 sub-strands · 68 mapped VibeSchool learning outcomes · 210 suggested lessons.</p>
    <div style={{ ...card, background: '#eff6f1', fontSize: 12, lineHeight: 1.6, marginBottom: 15 }}>
      <strong>Source:</strong> KICD 2024 revised Grades 1–3 Creative Activities & Indigenous Languages curriculum. This is independently written VibeSchool guidance, not the official KICD text; final source-to-outcome certification is pending.{' '}
      <a href={GRADE1_CREATIVE_SOURCE} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 800, color: '#13573e' }}>View original KICD source</a>.
      <div style={{ marginTop: 5, color: '#526d5e' }}>Curriculum scope is independent of the teacher’s weekly timetable, scheme and lesson plans.</div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 12 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#587363' }}>STRAND {unit.strand} · SUB-STRAND {unit.id}</div>
        <h3 style={{ fontSize: 19, margin: '4px 0' }}>{unit.title}</h3>
        <div style={{ fontSize: 12, color: '#607467' }}>{GRADE1_CREATIVE_STRANDS.find(s => s.id === unit.strand)?.title} · {unit.lessons} suggested lessons</div>
      </div>
      <button type="button" onClick={() => setIndexOpen(x => !x)} aria-expanded={indexOpen} aria-controls="grade1-creative-index" style={{ minHeight: 44, border: '1px solid #9fbbaa', borderRadius: 10, background: '#fff', padding: '10px 13px', fontWeight: 800, color: '#175b43', cursor: 'pointer' }}>{indexOpen ? 'Close topics' : 'All 16 topics'}</button>
    </div>
    {indexOpen && <div id="grade1-creative-index" style={{ ...card, marginBottom: 14 }}>
      <label htmlFor="grade1-creative-search" style={h}>Find a sub-strand or outcome</label>
      <input id="grade1-creative-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search all 16 topics" style={{ boxSizing: 'border-box', width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid #a9c2b1', fontSize: 15, minHeight: 44 }} />
      <nav aria-label="Grade 1 Creative Activities strands and sub-strands" style={{ maxHeight: 350, overflowY: 'auto', marginTop: 12 }}>
        {GRADE1_CREATIVE_STRANDS.map(strand => {
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
    {onPlanUnit && <div style={{ ...card, marginTop: 15, borderColor: '#9fbbaa' }}>
      <button type="button" onClick={() => onPlanUnit(unit.id)} style={{ width: '100%', minHeight: 44, padding: '11px 14px', borderRadius: 10, border: 0, background: '#175b43', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Plan this sub-strand in Scheme of Work</button>
      <p style={{ margin: '8px 0 0', fontSize: 12, color: '#526d5e', lineHeight: 1.5 }}>Choose an instructional week and the learning outcomes for a lesson. This is VibeSchool-authored guidance, not verified KICD text.</p>
    </div>}
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 15 }}>
      <button type="button" disabled={index === 0} onClick={() => choose(GRADE1_CREATIVE_UNITS[index - 1].id)} style={{ minHeight: 44, padding: '10px 14px', borderRadius: 10, border: '1px solid #c8d7cc', background: '#fff', color: '#1a5a40', fontWeight: 700, opacity: index === 0 ? 0.45 : 1, cursor: index === 0 ? 'default' : 'pointer' }}>← Previous</button>
      <button type="button" disabled={index === GRADE1_CREATIVE_UNITS.length - 1} onClick={() => choose(GRADE1_CREATIVE_UNITS[index + 1].id)} style={{ minHeight: 44, padding: '10px 14px', borderRadius: 10, border: 'none', background: '#175b43', color: '#fff', fontWeight: 800, opacity: index === GRADE1_CREATIVE_UNITS.length - 1 ? 0.45 : 1, cursor: index === GRADE1_CREATIVE_UNITS.length - 1 ? 'default' : 'pointer' }}>Next topic →</button>
    </div>
    {!compact && <p style={{ fontSize: 11, color: '#5f776b', margin: '13px 0 0' }}>Reference: VS-CUR-G01-CA-2026. These reading entries are not verified canonical database outcomes and do not change teaching records.</p>}
  </section>
}

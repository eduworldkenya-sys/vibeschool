import { NextRequest, NextResponse } from 'next/server'

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_WINDOW_MS = 60_000
const RATE_MAX_CALLS = 10

function checkRateLimit(ip: string): boolean {
  const now   = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_MAX_CALLS) return false
  entry.count++
  return true
}

const ALLOWED_SUBJECTS = new Set([
  'Mathematics','English','Biology','Chemistry','History',
  'Physics','Geography','Kiswahili','CRE','Business Studies',
])
const ALLOWED_FORMS        = new Set(['Form 1','Form 2','Form 3','Form 4'])
const ALLOWED_DIFFICULTIES = new Set(['easy','medium','hard'])

const SUBJECT_CONTEXT: Record<string, string> = {
  Mathematics:
    'Write all numbers and expressions as plain text (e.g. "x^2 + 3x - 4", "3/4", "sqrt(16)"). ' +
    'Base calculations on real KCSE paper style: define variables, show units, use Kenyan currency (Ksh) for commercial arithmetic.',
  English:
    'Write comprehension passages in clear Standard Kenyan English. Grammar questions must test real KCSE Paper 1 and 2 structures. ' +
    'Vocabulary should reflect KCSE set books and oral literature where relevant.',
  Biology:
    'Use correct biological terminology aligned with KNEC KCSE Biology syllabus. ' +
    'Reference local Kenyan ecosystems, diseases common in Kenya (malaria, typhoid), and local flora/fauna where relevant.',
  Chemistry:
    'Use IUPAC nomenclature aligned with KNEC Chemistry syllabus. Write chemical equations as plain text (e.g. "2H2 + O2 -> 2H2O"). ' +
    'Reference Kenyan industrial chemistry (soda ash, cement, fertilisers).',
  Physics:
    'Write all equations as plain text (e.g. "F = ma", "v^2 = u^2 + 2as"). Use SI units throughout. ' +
    'Reference Kenyan contexts (hydroelectric power at Masinga Dam, solar energy). KCSE Physics Paper 1 and Paper 2 style.',
  Geography:
    'Reference Kenyan geography specifically: Rift Valley, Lake Victoria, Mt Kenya, Mombasa port. ' +
    'KNEC Geography Paper 1 (Physical) and Paper 2 (Human and Economic). Map features described in words.',
  Kiswahili:
    'Andika maswali kwa Kiswahili sanifu. Tumia muundo wa kawaida wa mtihani wa KCSE Kiswahili. ' +
    'Maswali ya sarufi, ufahamu, na fasihi yafuate mtaala wa KNEC.',
  CRE:
    'Questions must align with the KNEC CRE syllabus covering Old Testament, New Testament, and Christian Living. ' +
    'Reference specific Bible passages by book, chapter and verse. Include Kenyan Christian context where relevant.',
  History:
    'Cover KNEC History and Government syllabus precisely. Reference specific Kenyan historical events, leaders, dates, and policies. ' +
    'Government questions should reflect Kenya\'s constitutional structure post-2010.',
  'Business Studies':
    'Cover KNEC Business Studies syllabus including Commerce, Accounting, Economics principles. ' +
    'Use Kenyan business context: M-Pesa, NSE, Kenya Revenue Authority. Financial calculations use Ksh.',
}

const DIFFICULTY_INSTRUCTIONS: Record<string, string> = {
  easy:
    'Questions test direct recall and basic application. Single-step problems. ' +
    'Distractors are clearly wrong to a prepared student. Suitable for revision starters.',
  medium:
    'Questions test understanding and standard application. Two or three steps required. ' +
    'Distractors include common misconceptions. This is the core KCSE exam standard.',
  hard:
    'Questions test higher-order thinking: analysis, synthesis, multi-step reasoning, common exam traps. ' +
    'Distractors are close to the correct answer — they catch students who partially understand. ' +
    'Modelled on the hardest questions from recent KCSE papers (2018–2023).',
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a minute before generating another exam.' },
      { status: 429 }
    )
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

  try {
    const body = await req.json()
    const { subject, form, topic, difficulty, count } = body

    if (!ALLOWED_SUBJECTS.has(subject))        return NextResponse.json({ error: 'Invalid subject' },    { status: 400 })
    if (!ALLOWED_FORMS.has(form))              return NextResponse.json({ error: 'Invalid form' },       { status: 400 })
    if (!ALLOWED_DIFFICULTIES.has(difficulty)) return NextResponse.json({ error: 'Invalid difficulty' }, { status: 400 })
    if (!topic || typeof topic !== 'string' || topic.length > 80)
      return NextResponse.json({ error: 'Invalid topic' }, { status: 400 })

    const safeTopic = topic.replace(/[^a-zA-Z0-9 \-,().'/&]/g, '').trim()
    if (!safeTopic) return NextResponse.json({ error: 'Invalid topic' }, { status: 400 })

    const safeCount      = Math.min(Math.max(parseInt(String(count), 10) || 10, 5), 30)
    const subjectCtx     = SUBJECT_CONTEXT[subject]     ?? ''
    const diffCtx        = DIFFICULTY_INSTRUCTIONS[difficulty] ?? ''

    const systemPrompt =
      `You are a senior KNEC KCSE examiner with 15 years of experience setting the official Kenya Certificate of Secondary Education examinations. ` +
      `You output ONLY raw valid JSON arrays — no markdown, no backticks, no preamble, no trailing text. ` +
      `Every question you write has appeared or could appear in a real KCSE paper.`

    const userPrompt =
      `Generate exactly ${safeCount} KCSE ${subject} multiple choice questions.\n` +
      `Form: ${form}\nTopic: "${safeTopic}"\nDifficulty: ${difficulty}\n\n` +
      `SUBJECT RULES:\n${subjectCtx}\n\n` +
      `DIFFICULTY RULES:\n${diffCtx}\n\n` +
      `QUESTION QUALITY RULES:\n` +
      `1. Every question must be unambiguous — only ONE option is definitively correct.\n` +
      `2. All four options must be plausible. Never use "All of the above" or "None of the above".\n` +
      `3. Options should be similar in length and grammatical structure.\n` +
      `4. Vary the correct answer position across questions.\n` +
      `5. Vary question types: definition, calculation, application, error identification.\n\n` +
      `EXPLANATION RULES:\n` +
      `1. explanation: 2-3 sentences walking through WHY the correct answer is right, like a smart friend explaining after an exam.\n` +
      `2. teachingNote: 1-2 sentences — the core concept a student must nail to never get this wrong again.\n` +
      `3. hint: One subtle nudge toward the solution. Do NOT reveal the answer or full method.\n\n` +
      `Return ONLY this JSON array:\n` +
      `[{"id":"q1","question":"...","options":["A text","B text","C text","D text"],"correctIndex":0,"explanation":"...","teachingNote":"...","topic":"${safeTopic}","hint":"..."}]`

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
        max_tokens:  4096,
        temperature: 0.4,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      return NextResponse.json({ error: err.error?.message ?? 'AI service error' }, { status: 502 })
    }

    const data = await res.json()
    const text = (data.choices?.[0]?.message?.content ?? '').trim()

    const startIdx = text.indexOf('[')
    const endIdx   = text.lastIndexOf(']')
    if (startIdx === -1 || endIdx === -1) {
      console.error('[VibeExam] Bad AI response:', text.slice(0, 200))
      return NextResponse.json({ error: 'AI returned an invalid response. Please try again.' }, { status: 500 })
    }

    let questions: unknown[]
    try {
      questions = JSON.parse(text.substring(startIdx, endIdx + 1))
    } catch {
      console.error('[VibeExam] JSON parse failed:', text.slice(0, 200))
      return NextResponse.json({ error: 'AI returned malformed JSON. Please try again.' }, { status: 500 })
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'AI returned empty questions. Please try again.' }, { status: 500 })
    }

    const validated = questions
      .filter((q): q is Record<string, unknown> => typeof q === 'object' && q !== null)
      .filter(q =>
        typeof q.question    === 'string' &&
        Array.isArray(q.options) && q.options.length === 4 &&
        typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex <= 3 &&
        typeof q.explanation  === 'string' &&
        typeof q.teachingNote === 'string'
      )
      .map((q, i) => ({
        id:           `q${i + 1}`,
        question:     String(q.question).trim(),
        options:      (q.options as unknown[]).map(o => String(o).trim()) as [string,string,string,string],
        correctIndex: Number(q.correctIndex),
        explanation:  String(q.explanation).trim(),
        teachingNote: String(q.teachingNote).trim(),
        topic:        safeTopic,
        hint:         typeof q.hint === 'string' ? String(q.hint).trim() : '',
      }))

    if (validated.length < Math.floor(safeCount * 0.7)) {
      console.error(`[VibeExam] Only ${validated.length}/${safeCount} passed validation`)
      return NextResponse.json({ error: 'AI returned too many invalid questions. Please try again.' }, { status: 500 })
    }

    return NextResponse.json({ questions: validated })

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[VibeExam] Generate error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { saveFunHubSession } from '@/lib/useFunHubSession'

// ─── TYPES ───────────────────────────────────────────────────────────────────
type Subject = 'Mathematics' | 'English' | 'Science' | 'Social Studies' | 'Kiswahili'
type Difficulty = 'Easy' | 'Medium' | 'Hard'
type GamePhase = 'setup' | 'playing' | 'result'

interface Question {
  question: string
  options: string[]
  answer_index: number
  subject: Subject
}

interface Balloon {
  id: string
  label: string
  x: number
  y: number
  speed: number
  color: string
  isCorrect: boolean
  popped: boolean
}

// ─── QUESTION BANK ────────────────────────────────────────────────────────────
const QUESTION_BANK: Record<Subject, Record<Difficulty, Question[]>> = {
  Mathematics: {
    Easy: [
      { question: '5 × 6 = ?',         options: ['30','25','35','28'], answer_index: 0, subject: 'Mathematics' },
      { question: '48 ÷ 8 = ?',         options: ['5','6','7','8'],    answer_index: 1, subject: 'Mathematics' },
      { question: '17 + 15 = ?',        options: ['31','32','33','34'], answer_index: 1, subject: 'Mathematics' },
      { question: '100 - 37 = ?',       options: ['63','64','73','62'], answer_index: 0, subject: 'Mathematics' },
      { question: 'Half of 44 = ?',     options: ['21','22','23','24'], answer_index: 1, subject: 'Mathematics' },
      { question: '9 × 7 = ?',          options: ['56','62','63','64'], answer_index: 2, subject: 'Mathematics' },
      { question: '81 ÷ 9 = ?',         options: ['7','8','9','10'],   answer_index: 2, subject: 'Mathematics' },
      { question: '25 + 38 = ?',        options: ['61','62','63','64'], answer_index: 2, subject: 'Mathematics' },
      { question: 'Double of 16 = ?',   options: ['30','31','32','33'], answer_index: 2, subject: 'Mathematics' },
      { question: '7 × 8 = ?',          options: ['54','55','56','57'], answer_index: 2, subject: 'Mathematics' },
    ],
    Medium: [
      { question: '15% of 200 = ?',     options: ['20','25','30','35'], answer_index: 2, subject: 'Mathematics' },
      { question: 'LCM of 4 and 6 = ?', options: ['8','10','12','14'], answer_index: 2, subject: 'Mathematics' },
      { question: '√144 = ?',           options: ['10','11','12','13'], answer_index: 2, subject: 'Mathematics' },
      { question: '2³ = ?',             options: ['4','6','8','10'],   answer_index: 2, subject: 'Mathematics' },
      { question: '3/4 of 80 = ?',      options: ['50','55','60','65'], answer_index: 2, subject: 'Mathematics' },
      { question: 'GCD of 12 and 18?',  options: ['3','4','6','9'],    answer_index: 2, subject: 'Mathematics' },
      { question: '0.5 × 0.5 = ?',      options: ['0.1','0.25','0.5','1'], answer_index: 1, subject: 'Mathematics' },
      { question: '12² = ?',            options: ['124','134','144','154'], answer_index: 2, subject: 'Mathematics' },
      { question: 'Area: 6cm × 4cm?',   options: ['20','22','24','26'], answer_index: 2, subject: 'Mathematics' },
      { question: '(-5) + 8 = ?',       options: ['1','2','3','4'],    answer_index: 2, subject: 'Mathematics' },
    ],
    Hard: [
      { question: 'x² - 5x + 6 = 0, x?', options: ['1,2','2,3','3,4','4,5'], answer_index: 1, subject: 'Mathematics' },
      { question: 'Volume cube 4cm?',      options: ['48','56','64','72'],     answer_index: 2, subject: 'Mathematics' },
      { question: 'sin 90° = ?',           options: ['0','0.5','1','-1'],      answer_index: 2, subject: 'Mathematics' },
      { question: '3/5 ÷ 9/10 = ?',       options: ['1/2','2/3','3/4','4/5'], answer_index: 1, subject: 'Mathematics' },
      { question: 'Prime between 20-30?',  options: ['21','23','25','27'],     answer_index: 1, subject: 'Mathematics' },
    ],
  },
  English: {
    Easy: [
      { question: 'Plural of "child"?',    options: ['childs','childes','children','childrens'], answer_index: 2, subject: 'English' },
      { question: 'Opposite of "ancient"?',options: ['old','modern','fast','slow'],              answer_index: 1, subject: 'English' },
      { question: 'Verb in: "She sings"?', options: ['She','sings','loudly','song'],             answer_index: 1, subject: 'English' },
      { question: '"Big" synonym?',         options: ['tiny','small','large','thin'],             answer_index: 2, subject: 'English' },
      { question: 'Past tense of "run"?',  options: ['runned','runs','ran','running'],           answer_index: 2, subject: 'English' },
      { question: 'Noun: "The dog barks"?',options: ['The','dog','barks','loudly'],              answer_index: 1, subject: 'English' },
      { question: '"Happy" antonym?',       options: ['glad','joyful','sad','merry'],             answer_index: 2, subject: 'English' },
      { question: 'Plural of "mouse"?',    options: ['mouses','mouse','mice','mices'],           answer_index: 2, subject: 'English' },
      { question: '"Quick" adverb form?',  options: ['quicker','quickly','quicken','quickest'],  answer_index: 1, subject: 'English' },
      { question: 'Adjective: "tall boy"?',options: ['boy','the','tall','walks'],                answer_index: 2, subject: 'English' },
    ],
    Medium: [
      { question: 'Simile: "brave as a ___"?', options: ['lamb','lion','cat','bird'],            answer_index: 1, subject: 'English' },
      { question: '"Benevolent" means?',         options: ['cruel','kind','loud','shy'],          answer_index: 1, subject: 'English' },
      { question: 'Passive: "She ate food"?',    options: ['Food ate she','Food was eaten by her','She has eaten','Food is eaten'], answer_index: 1, subject: 'English' },
      { question: '"Ambiguous" means?',          options: ['clear','certain','unclear','simple'], answer_index: 2, subject: 'English' },
      { question: 'Compound word: "sun+___"?',   options: ['moon','light','star','sky'],         answer_index: 1, subject: 'English' },
    ],
    Hard: [
      { question: 'Subjunctive mood?',            options: ['I was','I were','I am','I be'],     answer_index: 1, subject: 'English' },
      { question: '"Ephemeral" means?',           options: ['eternal','lasting','short-lived','huge'], answer_index: 2, subject: 'English' },
      { question: 'Oxymoron in: ___?',            options: ['dark night','deafening silence','cold ice','wet rain'], answer_index: 1, subject: 'English' },
      { question: 'Gerund in: "Swimming is fun"?',options: ['is','fun','Swimming','the'],        answer_index: 2, subject: 'English' },
      { question: '"Loquacious" means?',          options: ['quiet','talkative','angry','sad'],   answer_index: 1, subject: 'English' },
    ],
  },
  Science: {
    Easy: [
      { question: 'Largest planet?',         options: ['Earth','Saturn','Jupiter','Mars'],    answer_index: 2, subject: 'Science' },
      { question: 'Plants make food by?',    options: ['Respiration','Photosynthesis','Digestion','Absorption'], answer_index: 1, subject: 'Science' },
      { question: 'H₂O is?',                options: ['Salt','Sugar','Water','Acid'],        answer_index: 2, subject: 'Science' },
      { question: 'Heart pumps?',            options: ['Air','Food','Blood','Water'],         answer_index: 2, subject: 'Science' },
      { question: 'Bones form the?',         options: ['Muscle','Skeleton','Organ','Tissue'], answer_index: 1, subject: 'Science' },
      { question: 'Sun is a?',               options: ['Planet','Moon','Star','Comet'],       answer_index: 2, subject: 'Science' },
      { question: 'Ice is water in ___ state?',options: ['Gas','Liquid','Solid','Plasma'],   answer_index: 2, subject: 'Science' },
      { question: 'Insects have ___ legs?',  options: ['4','6','8','10'],                    answer_index: 1, subject: 'Science' },
      { question: 'Lungs are for?',          options: ['Digestion','Breathing','Pumping','Thinking'], answer_index: 1, subject: 'Science' },
      { question: 'Tadpole grows into?',     options: ['Fish','Snake','Frog','Lizard'],       answer_index: 2, subject: 'Science' },
    ],
    Medium: [
      { question: 'Unit of force?',          options: ['Joule','Watt','Newton','Pascal'],     answer_index: 2, subject: 'Science' },
      { question: 'Photosynthesis releases?',options: ['CO₂','N₂','O₂','H₂'],               answer_index: 2, subject: 'Science' },
      { question: 'Basic unit of life?',     options: ['Tissue','Organ','Cell','Atom'],       answer_index: 2, subject: 'Science' },
      { question: 'Sound travels fastest in?',options: ['Air','Water','Vacuum','Steel'],      answer_index: 3, subject: 'Science' },
      { question: 'Atomic number of Carbon?',options: ['4','6','8','12'],                    answer_index: 1, subject: 'Science' },
    ],
    Hard: [
      { question: 'Newton\'s 2nd law?',      options: ['F=mv','F=ma','F=mg','F=mc²'],        answer_index: 1, subject: 'Science' },
      { question: 'Speed of light?',         options: ['3×10⁶','3×10⁷','3×10⁸','3×10⁹'],   answer_index: 2, subject: 'Science' },
      { question: 'DNA stands for?',         options: ['Deoxyribose Nucleic Acid','Diribonucleic Acid','Deoxyribonucleic Acid','Dinitrogenic Acid'], answer_index: 2, subject: 'Science' },
      { question: 'Mitosis produces ___ cells?',options: ['1','2','3','4'],                  answer_index: 1, subject: 'Science' },
      { question: 'pH of pure water?',       options: ['5','6','7','8'],                     answer_index: 2, subject: 'Science' },
    ],
  },
  'Social Studies': {
    Easy: [
      { question: 'Capital of Kenya?',       options: ['Mombasa','Kisumu','Nairobi','Nakuru'],  answer_index: 2, subject: 'Social Studies' },
      { question: 'Kenya counties?',         options: ['42','45','47','50'],                    answer_index: 2, subject: 'Social Studies' },
      { question: 'Kenya independence year?',options: ['1960','1961','1962','1963'],             answer_index: 3, subject: 'Social Studies' },
      { question: 'Kenya national language?',options: ['English','Kikuyu','Kiswahili','Luo'],   answer_index: 2, subject: 'Social Studies' },
      { question: 'Ocean east of Kenya?',    options: ['Atlantic','Pacific','Indian','Arctic'],  answer_index: 2, subject: 'Social Studies' },
      { question: 'Largest lake in Africa?', options: ['Tanganyika','Victoria','Malawi','Chad'], answer_index: 1, subject: 'Social Studies' },
      { question: 'Kenya 1st president?',    options: ['Moi','Kibaki','Kenyatta J','Uhuru'],    answer_index: 2, subject: 'Social Studies' },
      { question: 'Kenya main export crop?', options: ['Coffee','Maize','Tea','Wheat'],         answer_index: 2, subject: 'Social Studies' },
      { question: 'Highest mountain Kenya?', options: ['Elgon','Longonot','Kenya','Kilimanjaro'],answer_index: 2, subject: 'Social Studies' },
      { question: 'Kenya currency?',         options: ['Dollar','Pound','Shilling','Euro'],     answer_index: 2, subject: 'Social Studies' },
    ],
    Medium: [
      { question: 'Kenya constitution year?',options: ['2008','2009','2010','2011'],            answer_index: 2, subject: 'Social Studies' },
      { question: 'Kenya govt branches?',    options: ['1','2','3','4'],                        answer_index: 2, subject: 'Social Studies' },
      { question: 'Great Rift Valley is?',   options: ['River','Tectonic depression','Mountain','Forest'], answer_index: 1, subject: 'Social Studies' },
      { question: 'Kenya economic system?',  options: ['Communist','Socialist','Mixed','Barter'],answer_index: 2, subject: 'Social Studies' },
      { question: 'Devolution means?',       options: ['Central power','Shared power','No power','Military power'], answer_index: 1, subject: 'Social Studies' },
    ],
    Hard: [
      { question: 'Lancaster Conference?',   options: ['Trade','Sports','Independence','Education'], answer_index: 2, subject: 'Social Studies' },
      { question: 'ECOWAS covers?',          options: ['East Africa','West Africa','North Africa','South Africa'], answer_index: 1, subject: 'Social Studies' },
      { question: 'AU headquarters?',        options: ['Nairobi','Cairo','Addis Ababa','Lagos'], answer_index: 2, subject: 'Social Studies' },
      { question: 'Kenya senate seats?',     options: ['47','57','67','77'],                    answer_index: 1, subject: 'Social Studies' },
      { question: 'Mau Mau fought against?', options: ['Arabs','French','British','Portuguese'], answer_index: 2, subject: 'Social Studies' },
    ],
  },
  Kiswahili: {
    Easy: [
      { question: '"Nyumba" kwa Kiingereza?',  options: ['School','House','Car','Book'],        answer_index: 1, subject: 'Kiswahili' },
      { question: 'Wingi wa "mti"?',           options: ['Miti','Mto','Mtoto','Mimi'],          answer_index: 0, subject: 'Kiswahili' },
      { question: '"Asante" kwa Kiingereza?',  options: ['Sorry','Please','Thank you','Hello'],  answer_index: 2, subject: 'Kiswahili' },
      { question: 'Kinyume cha "kubwa"?',      options: ['Nzuri','Ndogo','Refu','Fupi'],        answer_index: 1, subject: 'Kiswahili' },
      { question: '"Haraka" maana yake?',      options: ['Polepole','Kwa kasi','Vizuri','Mbali'], answer_index: 1, subject: 'Kiswahili' },
      { question: 'Wingi wa "kiti"?',          options: ['Vikiti','Viti','Kiti','Makiti'],       answer_index: 1, subject: 'Kiswahili' },
      { question: '"Daktari" ni nani?',         options: ['Mwalimu','Dawa','Mganga','Mgonjwa'],  answer_index: 2, subject: 'Kiswahili' },
      { question: 'Kinyume cha "fupi"?',        options: ['Ndogo','Kubwa','Refu','Nzuri'],       answer_index: 2, subject: 'Kiswahili' },
      { question: '"Chakula" kwa Kiingereza?',  options: ['Water','Clothes','Food','House'],     answer_index: 2, subject: 'Kiswahili' },
      { question: 'Wingi wa "jicho"?',          options: ['Jicho','Majicho','Macho','Jijicho'],  answer_index: 2, subject: 'Kiswahili' },
    ],
    Medium: [
      { question: 'Methali: "Haraka haraka..."?', options: ['haina nguvu','haina baraka','haina mwisho','haina maana'], answer_index: 1, subject: 'Kiswahili' },
      { question: 'Kitenzi: "Wanasoma"?',         options: ['Wana','soma','wanasoma','somo'],   answer_index: 2, subject: 'Kiswahili' },
      { question: 'Ngeli ya "KI-VI" ni ya?',       options: ['Watu','Vitu','Mahali','Wakati'],  answer_index: 1, subject: 'Kiswahili' },
      { question: '"Yeye" anawakilisha?',           options: ['Mimi','Wewe','Mtu 3rd','Sisi'],   answer_index: 2, subject: 'Kiswahili' },
      { question: 'Aina ya sentensi swali?',        options: ['Taarifa','Amri','Swali','Mshangao'], answer_index: 2, subject: 'Kiswahili' },
    ],
    Hard: [
      { question: 'Tashbihi ni?',              options: ['Kulinganisha bila kama','Kulinganisha kwa kama','Kutumia maneno ya kufurahisha','Kuimba'], answer_index: 1, subject: 'Kiswahili' },
      { question: 'Tamthilia ni?',             options: ['Shairi','Hadithi','Mchezo wa kuigiza','Methali'], answer_index: 2, subject: 'Kiswahili' },
      { question: 'Barua rasmi huanza na?',    options: ['Salamu','Tarehe na anwani','Mwili','Hitimisho'], answer_index: 1, subject: 'Kiswahili' },
      { question: 'Uandishi wa "au" ni?',      options: ['Kiunganishi','Kivumishi','Kiwakilishi','Kielezi'], answer_index: 0, subject: 'Kiswahili' },
      { question: 'Neno "mazingira" ni?',      options: ['Kitenzi','Kivumishi','Nomino','Kielezi'], answer_index: 2, subject: 'Kiswahili' },
    ],
  },
}

const BALLOON_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#14b8a6']
const SUBJECT_ICONS: Record<Subject, string> = {
  Mathematics: '📐', English: '📖', Science: '🔬', 'Social Studies': '🌍', Kiswahili: '🗣️',
}
const SUBJECTS: Subject[] = ['Mathematics','English','Science','Social Studies','Kiswahili']
const DIFFICULTIES: Difficulty[] = ['Easy','Medium','Hard']
const DIFFICULTY_POINTS: Record<Difficulty, number> = { Easy: 10, Medium: 20, Hard: 30 }
const GAME_DURATION = 60 // seconds
const MAX_BALLOONS = 4

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function BalloonPage() {
  const router = useRouter()

  const [phase, setPhase] = useState<GamePhase>('setup')
  const [subject, setSubject] = useState<Subject | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [balloons, setBalloons] = useState<Balloon[]>([])
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [feedback, setFeedback] = useState<{ text: string; color: string } | null>(null)
  const [locked, setLocked] = useState(false)

  const animRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)
  const feedbackRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentQ = questions[qIndex]

  // ── Build balloons for current question ───────────────────────────────────
  const buildBalloons = useCallback((q: Question) => {
    const shuffledOptions = shuffle(q.options.map((label, i) => ({ label, isCorrect: i === q.answer_index })))
    const cols = [15, 38, 61, 84]
    return shuffledOptions.map((opt, i) => ({
      id: Math.random().toString(36).slice(2),
      label: opt.label,
      x: cols[i % cols.length],
      y: 110 + Math.random() * 20,
      speed: 0.025 + Math.random() * 0.015 + (difficulty === 'Hard' ? 0.015 : difficulty === 'Medium' ? 0.008 : 0),
      color: BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)],
      isCorrect: opt.isCorrect,
      popped: false,
    }))
  }, [difficulty])

  // ── Start game ─────────────────────────────────────────────────────────────
  const startGame = () => {
    if (!subject || !difficulty) return
    const bank = QUESTION_BANK[subject][difficulty]
    const picked = shuffle(bank).slice(0, 15)
    setQuestions(picked)
    setQIndex(0)
    setScore(0)
    setLives(3)
    setTimeLeft(GAME_DURATION)
    setStreak(0)
    setBestStreak(0)
    setCorrectCount(0)
    setTotalCount(0)
    setLocked(false)
    setFeedback(null)
    setBalloons(buildBalloons(picked[0]))
    setPhase('playing')
  }

  // ── Timer countdown ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return
    if (timeLeft <= 0) { setPhase('result'); return }
    const id = setTimeout(() => setTimeLeft(t => t - 1), 1000)
    return () => clearTimeout(id)
  }, [timeLeft, phase])

  // ── Animation loop — float balloons up ────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return

    const animate = (timestamp: number) => {
      const delta = timestamp - lastTimeRef.current
      lastTimeRef.current = timestamp

      setBalloons(prev => {
        const updated = prev.map(b => {
          if (b.popped) return b
          const newY = b.y - b.speed * delta * 0.1
          return { ...b, y: newY }
        })

        // If any correct balloon floated off screen (y < -20) — lose a life
        const escaped = updated.find(b => !b.popped && b.isCorrect && b.y < -15)
        if (escaped) {
          setLives(l => {
            const next = l - 1
            if (next <= 0) setTimeout(() => setPhase('result'), 300)
            return next
          })
          setStreak(0)
          setTotalCount(c => c + 1)
          showFeedback('Escaped! ❌', '#ef4444')
          nextQuestion()
          return []
        }

        return updated
      })

      animRef.current = requestAnimationFrame(animate)
    }

    animRef.current = requestAnimationFrame(animate)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [phase, qIndex])

  // ── Show feedback briefly ─────────────────────────────────────────────────
  const showFeedback = (text: string, color: string) => {
    setFeedback({ text, color })
    if (feedbackRef.current) clearTimeout(feedbackRef.current)
    feedbackRef.current = setTimeout(() => setFeedback(null), 900)
  }

  // ── Next question ─────────────────────────────────────────────────────────
  const nextQuestion = useCallback(() => {
    setLocked(false)
    setQIndex(i => {
      const next = i + 1
      if (next >= questions.length) {
        setTimeout(() => setPhase('result'), 400)
        return i
      }
      setTimeout(() => {
        setBalloons(buildBalloons(questions[next]))
      }, 300)
      return next
    })
  }, [questions, buildBalloons])

  // ── Pop balloon ───────────────────────────────────────────────────────────
  const popBalloon = useCallback((balloon: Balloon) => {
    if (locked || balloon.popped || phase !== 'playing') return
    setLocked(true)

    setBalloons(prev => prev.map(b => b.id === balloon.id ? { ...b, popped: true } : b))

    if (balloon.isCorrect) {
      const pts = DIFFICULTY_POINTS[difficulty!] + (streak >= 2 ? 5 : 0)
      setScore(s => s + pts)
      setStreak(s => { const n = s + 1; setBestStreak(b => Math.max(b, n)); return n })
      setCorrectCount(c => c + 1)
      setTotalCount(c => c + 1)
      showFeedback(streak >= 2 ? `🔥 ${streak + 1}x Streak! +${pts}` : `✓ +${pts}`, '#10b981')
    } else {
      // Pop wrong — show all balloons briefly, lose streak
      setLives(l => {
        const next = l - 1
        if (next <= 0) setTimeout(() => setPhase('result'), 600)
        return next
      })
      setStreak(0)
      setTotalCount(c => c + 1)
      showFeedback('Wrong! ❌', '#ef4444')
      // Reveal correct balloon
      setBalloons(prev => prev.map(b => b.isCorrect ? { ...b, popped: false } : { ...b, popped: true }))
    }

    setTimeout(() => nextQuestion(), balloon.isCorrect ? 500 : 800)
  }, [locked, phase, difficulty, streak, nextQuestion])

  // ── Lives display ─────────────────────────────────────────────────────────
  const livesDisplay = Array.from({ length: 3 }, (_, i) => i < lives ? '❤️' : '🖤')
  const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0
  const timerPct = (timeLeft / GAME_DURATION) * 100
  const timerColor = timeLeft > 20 ? '#10b981' : timeLeft > 10 ? '#f59e0b' : '#ef4444'

  // ─── SETUP ────────────────────────────────────────────────────────────────
  // ─── RESULT ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'result') return
    const xp = Math.round(score / 2) + bestStreak * 5
    saveFunHubSession({
      game_slug:   'balloon',
      subject:     subject ?? 'General',
      grade:       1,
      score:       score,
      xp_earned:   xp,
      correct:     correctCount,
      total:       totalCount,
      streak_max:  bestStreak,
    }).catch(() => {})
  }, [phase])

  if (phase === 'setup') return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <button onClick={() => router.back()} style={{ background: '#18181b', border: 'none', color: '#fff', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontSize: 16 }}>←</button>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>🎈 Pop Balloon</div>
          <div style={{ fontSize: 11, color: '#71717a' }}>Tap the correct answer · CBC</div>
        </div>
      </div>

      <div style={{ background: '#18181b', borderRadius: 16, padding: 16, marginBottom: 24, border: '1px solid #27272a' }}>
        <div style={{ fontSize: 11, color: '#71717a', marginBottom: 8 }}>HOW TO PLAY</div>
        <div style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.6 }}>
          🎈 Balloons float up with answers<br/>
          ✅ Tap the correct answer balloon<br/>
          ❌ Wrong tap or balloon escapes = lose a life<br/>
          🔥 Build streaks for bonus points<br/>
          ⏱️ 60 seconds — score as high as you can!
        </div>
      </div>

      <div style={{ fontSize: 10, fontWeight: 700, color: '#52525b', letterSpacing: 2, marginBottom: 12 }}>SUBJECT</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
        {SUBJECTS.map(s => (
          <div key={s} onClick={() => setSubject(s)} style={{
            background: subject === s ? '#1d4ed8' : '#18181b',
            borderRadius: 14, padding: '14px 12px', cursor: 'pointer',
            border: subject === s ? '2px solid #3b82f6' : '2px solid #27272a',
            transform: subject === s ? 'scale(1.02)' : 'scale(1)',
            transition: 'all 0.15s',
          }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{SUBJECT_ICONS[s]}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{s}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10, fontWeight: 700, color: '#52525b', letterSpacing: 2, marginBottom: 12 }}>DIFFICULTY</div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 32 }}>
        {DIFFICULTIES.map(d => {
          const dc = d === 'Easy' ? '#10b981' : d === 'Medium' ? '#f59e0b' : '#ef4444'
          return (
            <div key={d} onClick={() => setDifficulty(d)} style={{
              flex: 1, padding: '12px 0', borderRadius: 12, textAlign: 'center', cursor: 'pointer',
              border: difficulty === d ? `2px solid ${dc}` : '2px solid #27272a',
              background: difficulty === d ? `${dc}22` : '#18181b',
              color: difficulty === d ? dc : '#71717a',
              fontWeight: 800, fontSize: 13, transition: 'all 0.15s',
            }}>
              {d}
              <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2, opacity: 0.8 }}>+{DIFFICULTY_POINTS[d]}pts</div>
            </div>
          )
        })}
      </div>

      <div onClick={subject && difficulty ? startGame : undefined} style={{
        background: subject && difficulty ? '#3b82f6' : '#27272a',
        color: subject && difficulty ? '#fff' : '#52525b',
        borderRadius: 16, padding: '16px 0', textAlign: 'center',
        fontWeight: 900, fontSize: 15, cursor: subject && difficulty ? 'pointer' : 'not-allowed',
        transition: 'all 0.15s',
      }}>
        🎈 Start Game
      </div>
    </div>
  )

  // ─── PLAYING ──────────────────────────────────────────────────────────────
  if (phase === 'playing') return (
    <div style={{ minHeight: '100vh', background: '#0f0f23', color: '#fff', overflow: 'hidden', position: 'relative', userSelect: 'none' }}>

      {/* HUD */}
      <div style={{ padding: '16px 16px 0', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#f59e0b' }}>⚡ {score}</div>
          <div style={{ display: 'flex', gap: 4 }}>{livesDisplay.map((l, i) => <span key={i} style={{ fontSize: 16 }}>{l}</span>)}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: timerColor }}>{timeLeft}s</div>
        </div>
        {/* Timer bar */}
        <div style={{ background: '#1e1e3a', borderRadius: 99, height: 5, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ width: `${timerPct}%`, height: '100%', borderRadius: 99, background: timerColor, transition: 'width 1s linear, background 0.3s' }} />
        </div>
        {streak >= 2 && (
          <div style={{ textAlign: 'center', fontSize: 11, color: '#fb923c', fontWeight: 800 }}>🔥 {streak}x Streak!</div>
        )}
      </div>

      {/* Question */}
      <div style={{ margin: '12px 16px', background: 'rgba(255,255,255,0.07)', borderRadius: 16, padding: '14px 16px', textAlign: 'center', position: 'relative', zIndex: 10 }}>
        <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 700, marginBottom: 4 }}>Q{qIndex + 1} · {subject}</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.4 }}>{currentQ?.question}</div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{
          position: 'absolute', top: '38%', left: '50%', transform: 'translateX(-50%)',
          background: feedback.color, color: '#fff', borderRadius: 12,
          padding: '10px 20px', fontWeight: 900, fontSize: 15, zIndex: 50,
          animation: 'fadeUp 0.3s ease', whiteSpace: 'nowrap',
        }}>
          {feedback.text}
        </div>
      )}

      {/* Balloon field */}
      <div style={{ position: 'relative', height: '55vh', margin: '0 8px' }}>
        {balloons.map(b => !b.popped && (
          <div
            key={b.id}
            onClick={() => popBalloon(b)}
            style={{
              position: 'absolute',
              left: `${b.x}%`,
              top: `${b.y}%`,
              transform: 'translateX(-50%)',
              cursor: 'pointer',
              zIndex: 20,
              transition: 'opacity 0.2s',
            }}
          >
            {/* Balloon body */}
            <div style={{
              width: 72, height: 88,
              background: `radial-gradient(circle at 35% 35%, ${b.color}ee, ${b.color}88)`,
              borderRadius: '50% 50% 50% 50% / 55% 55% 45% 45%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 20px ${b.color}55`,
              border: `2px solid ${b.color}cc`,
              position: 'relative',
            }}>
              {/* Shine */}
              <div style={{
                position: 'absolute', top: 10, left: 14,
                width: 18, height: 22, borderRadius: '50%',
                background: 'rgba(255,255,255,0.35)',
                transform: 'rotate(-20deg)',
              }} />
              <span style={{ fontSize: 11, fontWeight: 900, color: '#fff', textAlign: 'center', padding: '0 6px', lineHeight: 1.2, zIndex: 1 }}>
                {b.label}
              </span>
            </div>
            {/* Knot */}
            <div style={{ width: 8, height: 8, background: b.color, borderRadius: '50% 50% 0 0', margin: '0 auto' }} />
            {/* String */}
            <div style={{ width: 2, height: 20, background: 'rgba(255,255,255,0.3)', margin: '0 auto', borderRadius: 99 }} />
          </div>
        ))}
      </div>



      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  )





  if (phase === 'result') {
    const grade = accuracy >= 80 ? { label: 'Amazing!', color: '#10b981', emoji: '🏆' }
      : accuracy >= 60 ? { label: 'Good Job!', color: '#f59e0b', emoji: '⭐' }
      : { label: 'Try Again!', color: '#ef4444', emoji: '💪' }
    return (
      <div style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: '40px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>{grade.emoji}</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: grade.color, marginBottom: 4 }}>{grade.label}</div>
        <div style={{ fontSize: 12, color: '#71717a', marginBottom: 32 }}>{subject} · {difficulty} · Pop Balloon</div>

        <div style={{ width: '100%', background: '#18181b', borderRadius: 20, padding: 20, marginBottom: 20, border: '1px solid #27272a' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, textAlign: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#f59e0b' }}>{score}</div>
              <div style={{ fontSize: 10, color: '#71717a', marginTop: 4 }}>Score</div>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#10b981' }}>{correctCount}/{totalCount}</div>
              <div style={{ fontSize: 10, color: '#71717a', marginTop: 4 }}>Correct</div>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#fb923c' }}>{bestStreak}</div>
              <div style={{ fontSize: 10, color: '#71717a', marginTop: 4 }}>Best Streak</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#71717a', marginBottom: 6 }}>
            <span>Accuracy</span><span>{accuracy}%</span>
          </div>
          <div style={{ background: '#27272a', borderRadius: 99, height: 8, overflow: 'hidden' }}>
            <div style={{ width: `${accuracy}%`, height: '100%', borderRadius: 99, background: grade.color }} />
          </div>
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div onClick={startGame} style={{ background: '#3b82f6', color: '#fff', borderRadius: 16, padding: '16px 0', textAlign: 'center', fontWeight: 900, fontSize: 15, cursor: 'pointer' }}>
            🎈 Play Again
          </div>
          <div onClick={() => { setPhase('setup'); setSubject(null); setDifficulty(null) }} style={{ background: '#18181b', color: '#d4d4d8', borderRadius: 16, padding: '16px 0', textAlign: 'center', fontWeight: 700, fontSize: 14, cursor: 'pointer', border: '1px solid #27272a' }}>
            🔄 Change Subject
          </div>
          <div onClick={() => router.back()} style={{ color: '#71717a', padding: '12px 0', textAlign: 'center', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            ← Back to FunHub
          </div>
        </div>
      </div>
    )
  }

  return null
}

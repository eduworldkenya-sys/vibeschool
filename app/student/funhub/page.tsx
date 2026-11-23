'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react'

type Game = 'numbers' | 'words' | 'world'
type Question = { prompt: string; answers: [string, string, string, string]; correct: number; reason: string }
const BANK: Record<Game, Question[]> = {
  numbers: [
    { prompt: 'What is 8 + 7?', answers: ['14', '15', '16', '17'], correct: 1, reason: '8 + 2 = 10; then add 5 to get 15.' },
    { prompt: 'Complete the pattern: 4, 8, 12, ...', answers: ['14', '15', '16', '20'], correct: 2, reason: 'The rule is add 4. 12 + 4 = 16.' },
    { prompt: 'Share 18 mangoes equally among 3 children. How many does each get?', answers: ['5', '6', '7', '9'], correct: 1, reason: '18 ÷ 3 = 6 mangoes per child.' },
  ],
  words: [
    { prompt: 'What is the opposite of "quiet"?', answers: ['Silent', 'Noisy', 'Calm', 'Soft'], correct: 1, reason: 'Noisy means not quiet.' },
    { prompt: 'Choose the correct sentence.', answers: ['She go to school.', 'She going school.', 'She goes to school.', 'She gone to school.'], correct: 2, reason: 'We say "she goes" in the simple present tense.' },
    { prompt: 'Which word rhymes with "light"?', answers: ['Late', 'Night', 'Lot', 'Let'], correct: 1, reason: 'Light and night have matching ending sounds.' },
  ],
  world: [
    { prompt: 'Which part of a plant usually absorbs water from soil?', answers: ['Flower', 'Root', 'Fruit', 'Leaf'], correct: 1, reason: 'Roots absorb water from the soil.' },
    { prompt: 'In which direction does the Sun appear to rise?', answers: ['North', 'South', 'East', 'West'], correct: 2, reason: 'The Sun appears to rise in the east.' },
    { prompt: 'Before crossing a road, what should you do?', answers: ['Run', 'Look and listen', 'Close your eyes', 'Play on the road'], correct: 1, reason: 'Stop, look and listen; cross when it is safe.' },
  ],
}
const GAMES: { id: Game; title: string; description: string }[] = [
  { id: 'numbers', title: 'Number Sprint', description: 'Numbers and patterns' },
  { id: 'words', title: 'Word Detective', description: 'Language puzzles' },
  { id: 'world', title: 'World Explorer', description: 'Nature and everyday knowledge' },
]
const tile: React.CSSProperties = { border: '1px solid var(--vs-border)', borderRadius: 12, padding: 15, background: 'var(--vs-card)', color: 'var(--vs-text)', fontFamily: 'inherit', textAlign: 'left', minHeight: 50, cursor: 'pointer' }

export default function FunHubPage() {
  const [game, setGame] = useState<Game | null>(null)
  const [index, setIndex] = useState(0)
  const [chosen, setChosen] = useState<number | null>(null)
  const [correct, setCorrect] = useState(0)
  const [complete, setComplete] = useState(false)
  const questions = game ? BANK[game] : []
  const question = questions[index]
  function start(next: Game) { setGame(next); setIndex(0); setChosen(null); setCorrect(0); setComplete(false) }
  function choose(answer: number) {
    if (chosen !== null || !question || complete) return
    setChosen(answer)
    if (answer === question.correct) setCorrect(value => value + 1)
  }
  function next() {
    if (chosen === null || !question) return
    if (index + 1 === questions.length) setComplete(true)
    else { setIndex(value => value + 1); setChosen(null) }
  }
  return <main style={{ maxWidth: 720, margin: '0 auto', padding: '8px 0 65px', display: 'grid', gap: 16 }}>
    <header style={{ display: 'grid', gap: 6 }}>
      <p style={{ color: 'var(--vs-accent)', fontSize: 12, fontWeight: 800 }}>PLAY & LEARN</p>
      <h1 style={{ fontSize: 'clamp(24px,4vw,30px)' }}>FunHub</h1>
      <p style={{ color: 'var(--vs-muted)', fontSize: 13 }}>Short self-check games. Scores are for fun and are not saved as school marks or mastery.</p>
    </header>
    {!game ? <>
      <h2 style={{ fontSize: 17 }}>Choose a game</h2>
      <nav aria-label="Games" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
        {GAMES.map(item => <button type="button" key={item.id} onClick={() => start(item.id)} style={{ ...tile, display: 'grid', gap: 8, minHeight: 125 }}>
          <strong style={{ fontSize: 16 }}>{item.title}</strong>
          <span style={{ fontSize: 12, color: 'var(--vs-muted)' }}>{item.description}</span>
          <span style={{ color: 'var(--vs-accent)', fontSize: 12, fontWeight: 750 }}>Play <ArrowRight size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /></span>
        </button>)}
      </nav>
      <Link href="/student/vibelearn/topic-practice" style={{ color: 'var(--vs-accent)', fontSize: 13, textDecoration: 'none', fontWeight: 750 }}>For recorded learning results, open Topic Practice <ArrowRight size={14} style={{ display: 'inline' }}/></Link>
    </> : <>
      <button type="button" onClick={() => setGame(null)} style={{ ...tile, border: 0, minHeight: 40, padding: 4, width: 'fit-content', background: 'transparent' }}><ArrowLeft size={16} style={{ display: 'inline', verticalAlign: 'middle' }}/> All games</button>
      {complete ? <section aria-live="polite" style={{ ...tile, cursor: 'default', display: 'grid', gap: 14, padding: 22 }}>
        <h2>Round complete</h2>
        <p>You answered {correct} of {questions.length} questions correctly.</p>
        <button type="button" onClick={() => start(game)} style={{ ...tile, background: 'var(--vs-accent)', color: 'var(--vs-on-accent)', display: 'flex', gap: 8, alignItems: 'center' }}><RotateCcw size={16}/> Play again</button>
      </section> : question && <section style={{ ...tile, cursor: 'default', display: 'grid', gap: 15, padding: 20 }}>
        <p style={{ color: 'var(--vs-muted)', fontSize: 12 }}>{GAMES.find(item => item.id === game)?.title} · Question {index + 1} of {questions.length}</p>
        <div role="progressbar" aria-label="Game progress" aria-valuenow={index} aria-valuemin={0} aria-valuemax={questions.length} style={{ background: 'var(--vs-border)', height: 6, borderRadius: 4, overflow: 'hidden' }}><div style={{ width: Math.round(index / questions.length * 100) + '%', height: '100%', background: 'var(--vs-accent)' }}/></div>
        <h2 style={{ fontSize: 19, lineHeight: 1.4 }}>{question.prompt}</h2>
        <div role="group" aria-label="Choose an answer" style={{ display: 'grid', gap: 9 }}>
          {question.answers.map((label, choice) => <button key={label} type="button" disabled={chosen !== null} aria-pressed={chosen === choice} onClick={() => choose(choice)}
            style={{ ...tile, borderColor: chosen !== null && choice === question.correct ? 'var(--vs-accent)' : chosen === choice ? 'var(--vs-error)' : 'var(--vs-border)', background: chosen !== null && choice === question.correct ? 'var(--vs-accent-soft)' : 'var(--vs-card)' }}>{String.fromCharCode(65 + choice)}. {label}</button>)}
        </div>
        {chosen !== null && <div role="status" aria-live="polite" style={{ display: 'grid', gap: 10, background: 'var(--vs-soft)', border: '1px solid var(--vs-border)', padding: 13, borderRadius: 10 }}>
          <strong>{chosen === question.correct ? 'Correct!' : 'Not quite. Learn why:'}</strong>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--vs-muted)' }}>{question.reason}</p>
          <button type="button" onClick={next} style={{ ...tile, background: 'var(--vs-accent)', color: 'var(--vs-on-accent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>{index + 1 === questions.length ? 'See result' : 'Next question'} <ArrowRight size={17}/></button>
        </div>}
      </section>}
    </>}
  </main>
}

'use client'

import { useState } from 'react'
import { Eye, Lightbulb, RotateCcw } from 'lucide-react'
import { timeStudyHint } from '@/lib/content/grade4TimePractice.mjs'
import { VisualRichText } from '@/components/learn/VisualLearningAsset'
import styles from './Grade4TimeContentReader.module.css'

export type TimeQuestionCard = {
  id: string
  kind: string
  prompt: string
  answer: string
  why: string
}

const quickChecks: Record<string, { prompt: string; choices: [string, string]; correct: string; retry: string }> = {
  'A child arrives home at 5:15 in the afternoon. Is it a.m. or p.m.?': {
    prompt: '5:15 in the afternoon',
    choices: ['a.m.', 'p.m.'],
    correct: 'p.m.',
    retry: 'Afternoon comes after noon. Which label starts at noon?',
  },
  'Is 12:00 a.m. midday or midnight?': {
    prompt: '12:00 a.m.',
    choices: ['Midday', 'Midnight'],
    correct: 'Midnight',
    retry: 'Think about which 12:00 starts a new day.',
  },
}

/** Private response state is local to this card; no scoring, storage or submission. */
function QuestionCard({question,index,lessonNumber}:{
  question: TimeQuestionCard
  index:number
  lessonNumber:number
}) {
  const check = quickChecks[question.prompt]
  const [choice, setChoice] = useState('')
  const [written,setWritten] = useState('')
  const [hint,setHint] = useState(0)
  const [revealed,setRevealed] = useState(false)

  return <div className={styles.questionCard}>
    <p className={styles.questionNumber}>Question {index + 1}</p>
    <div className={styles.questionPrompt}><VisualRichText body={question.prompt} style={{fontSize:17,lineHeight:1.7}}/></div>
    {check ? <div className={styles.questionActions} role="group" aria-label={check.prompt}>
      {check.choices.map(option => <button key={option} type="button" className={styles.answerButton}
        aria-pressed={choice === option} onClick={() => setChoice(option)}>{option}</button>)}
    </div> : <>
    <label className={styles.answerLabel} htmlFor={'answer-' + question.id}>
      Your working or answer <span>(optional)</span>
    </label>
    <textarea className={styles.answerInput} id={'answer-' + question.id}
      value={written} onChange={event=>setWritten(event.target.value)}
      rows={2} placeholder="Think it through, or write in your exercise book."/>
    </>}
    {choice && check && <div className={choice === check.correct ? styles.answerPanel : styles.hintPanel} role="status">
      {choice === check.correct ? <><strong>Correct.</strong> {question.why}</> : check.retry}
    </div>}
    <div className={styles.questionActions}>
      {!revealed && <button type="button" className={styles.hintButton}
        onClick={()=>setHint(current=>Math.min(2,current+1))} disabled={hint===2}>
        <Lightbulb size={15} aria-hidden="true"/>
        {hint===0?'Give me a hint':hint===1?'Another hint':'Hints shown'}
      </button>}
      {question.answer && <button type="button" className={styles.answerButton}
        aria-expanded={revealed} onClick={()=>setRevealed(current=>!current)}>
        <Eye size={15} aria-hidden="true"/>
        {revealed?'Hide answer':'Show answer'}
      </button>}
      {(hint>0||revealed||written||choice) && <button type="button" className={styles.resetButton}
        onClick={()=>{setChoice('');setWritten('');setHint(0);setRevealed(false)}}>
        <RotateCcw size={14} aria-hidden="true"/> Try again
      </button>}
    </div>
    {hint>0 && <div className={styles.hintPanel} role="status" aria-live="polite">
      <strong>Hint {hint} of 2</strong>
      <p>{question.prompt === 'The library closes at 4:30 in the afternoon. Write the time.'
        ? hint === 1 ? 'Does the afternoon come before or after noon?' : 'Use the label that starts at noon. Keep the clock time as it is.'
        : timeStudyHint(lessonNumber,hint)}</p>
    </div>}
    {revealed && question.answer && <div className={styles.answerPanel} role="status" aria-live="polite">
      <strong>Answer: {question.answer}</strong>
      {question.why && <p>{question.why}</p>}
      <small>Check your method against the published explanation. No score is recorded.</small>
    </div>}
    {!question.answer && <p className={styles.ungradedNote}>Try this in your exercise book. An individual checked answer is not available for this question.</p>}
  </div>
}

export default function Grade4TimePracticeCards({questions,lessonNumber}:{
  questions:TimeQuestionCard[]
  lessonNumber:number
}) {
  if (!questions.length) return null
  return <div className={styles.questionGrid}>
    <p className={styles.questionIntro}>
      Try each question before revealing the explanation. Your typed answer stays on this page.
    </p>
    {questions.map((question,index)=>
      <QuestionCard key={question.id} question={question} index={index} lessonNumber={lessonNumber}/>
    )}
  </div>
}

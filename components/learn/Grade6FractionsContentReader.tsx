'use client'

import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import UniversalLearnReader from '@/components/learn/UniversalLearnReader'
import { adaptCanonicalLearnSections } from '@/lib/learn/learningBlockContract'
import { buildLearningToolContext } from '@/lib/learn/teachingToolContentBridge.mjs'
import styles from './Grade6FractionsContentReader.module.css'

type Practice = { prompt: string; answer: string; explanation: string }
type MCQ = { prompt: string; options: string[]; correct: number; why: string }
type PublicLesson = {
  resource_version_id: string; resource_id: string; title: string; unit_id: string
  sections: unknown; questions: Practice[]; quick_check_mcqs: MCQ[]
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Presentation-only, text-safe Markdown subset. Never execute raw HTML from content. */
function inlineText(raw: string): ReactNode {
  return raw.split(/(\*\*[^*]+\*\*|\x60[^\x60]+\x60)/g).map((piece,i) =>
    piece.startsWith('**') && piece.endsWith('**')
      ? <strong key={i}>{piece.slice(2,-2)}</strong>
      : piece.startsWith('\x60') && piece.endsWith('\x60')
        ? <code key={i}>{piece.slice(1,-1)}</code>
        : <Fragment key={i}>{piece}</Fragment>)
}
function LessonProse({ body }: { body:string }) {
  const parts = body.replace(/\r\n?/g,'\n').trim().split(/\n\s*\n/)
  return <div className={styles.prose}>{parts.map((part,index) => {
    const lines = part.split('\n').filter(Boolean)
    if (/^###?\s/.test(part)) {
      const txt = part.replace(/^#{2,3}\s+/,'')
      return part.startsWith('###') ? <h4 key={index}>{inlineText(txt)}</h4> : <h3 key={index}>{inlineText(txt)}</h3>
    }
    if (lines.length > 1 && lines.every(line=>/^\s*\|/.test(line))) {
      const rows=lines.map(l=>l.trim().replace(/^\||\|$/g,'').split('|').map(s=>s.trim()))
        .filter(row=>!row.every(cell=>/^[-:\s]+$/.test(cell)))
      return <div key={index} style={{overflowX:'auto'}}><table>
        <thead><tr>{rows[0]?.map((c,i)=><th scope="col" key={i}>{inlineText(c)}</th>)}</tr></thead>
        <tbody>{rows.slice(1).map((row,j)=><tr key={j}>{row.map((c,i)=><td key={i}>{inlineText(c)}</td>)}</tr>)}</tbody>
      </table></div>
    }
    if (lines.length > 0 && lines.every(line=>/^\s*[-*]\s/.test(line))) {
      return <ul key={index}>{lines.map((line,i)=><li key={i}>{inlineText(line.replace(/^\s*[-*]\s+/,''))}</li>)}</ul>
    }
    if (lines.length > 0 && lines.every(line=>/^\s*\d+[.)]\s/.test(line))) {
      return <ol key={index}>{lines.map((line,i)=><li key={i}>{inlineText(line.replace(/^\s*\d+[.)]\s+/,''))}</li>)}</ol>
    }
    return <p key={index}>{inlineText(part)}</p>
  })}</div>
}

const groups=[
  'Understanding fractions', 'LCM and equivalent fractions',
  'Basic addition', 'More demanding denominators',
  'Answers greater than one', 'Real-life applications',
  'Reasoning and error correction'
]
function PracticeCards({questions}:{questions:Practice[]}) {
  const [shown,setShown]=useState<number[]>([])
  return <div className={styles.questions}>
    <p className={styles.small}>Work out each problem first. Reveal the answer and explanation only when you are ready. This is practice, not a secure examination.</p>
    {groups.map((label,group)=><section className={styles.questionSet} key={label} aria-label={label}>
      <h3>Set {String.fromCharCode(65+group)} — {label}</h3>
      <div className={styles.questions}>{questions.slice(group*9,group*9+9).map((q,index)=>{
        const number=group*9+index+1,open=shown.includes(number)
        return <article key={number} className={styles.qCard}>
          <div className={styles.qLabel}>Question {number} of {questions.length}</div>
          <div className={styles.qPrompt}>{q.prompt}</div>
          <button type="button" className={styles.qButton} aria-expanded={open}
            onClick={()=>setShown(v=>open?v.filter(n=>n!==number):[...v,number])}>
              {open?'Hide explanation':'Show answer and explanation'}
          </button>
          {open && <div className={styles.answer}><strong>Answer: {q.answer}</strong><div>{q.explanation}</div></div>}
        </article>
      })}</div>
    </section>)}
  </div>
}

function QuickCheck({questions}:{questions:MCQ[]}) {
  const [answers,setAnswers]=useState<Record<number,number>>({})
  const [submitted,setSubmitted]=useState(false)
  const answered=Object.keys(answers).length
  const total=questions.reduce((n,q,i)=>n+(answers[i]===q.correct?1:0),0)
  return <section className={styles.quiz} aria-label="Fractions mastery quick check">
    <h2>Check your understanding</h2>
    <p className={styles.small}>Answer five questions, then submit to review your explanations. No score is stored in an exam record.</p>
    {questions.map((q,i)=><fieldset key={i} className={styles.quizQuestion} style={{border:0,margin:0,padding:0}}>
      <legend>{i+1}. {q.prompt}</legend>
      {q.options.map((option,j)=><label key={j} className={styles.choice}>
        <input type="radio" name={'g6-fraction-quiz-'+i} checked={answers[i]===j} disabled={submitted}
          onChange={()=>setAnswers(v=>({...v,[i]:j}))}/>{option}
      </label>)}
      {submitted && <p className={styles.quizFeedback}>
        {answers[i] === q.correct ? 'Correct. ' : answers[i] === undefined ? 'Skipped. ' : 'Not quite. '}
        {q.why} Correct answer: {q.options[q.correct]}.
      </p>}
    </fieldset>)}
    {submitted && <div role="status" className={styles.score}>Your result: {total} of {questions.length} correct.</div>}
    <div className={styles.actions}>
      {!submitted && <button className={styles.submit} type="button"
        onClick={()=>setSubmitted(true)} disabled={answered===0}>Submit and see explanations</button>}
      <button type="button" className={styles.reset}
        onClick={()=>{setAnswers({});setSubmitted(false)}}>Practise again</button>
    </div>
  </section>
}
const validPractice=(xs:unknown):xs is Practice[]=>Array.isArray(xs)&&xs.length===63&&xs.every(x=>x&&typeof x.prompt==='string'&&typeof x.answer==='string'&&typeof x.explanation==='string')
const validQuiz=(xs:unknown):xs is MCQ[]=>Array.isArray(xs)&&xs.length===5&&xs.every(x=>x&&typeof x.prompt==='string'&&Array.isArray(x.options)&&x.options.length>=3&&x.options.every((v:unknown)=>typeof v==='string')&&Number.isInteger(x.correct)&&x.correct>=0&&x.correct<x.options.length&&typeof x.why==='string')

/** One certified-only RPC for learner content; never import editorial JSON into the browser. */
export default function Grade6FractionsContentReader() {
  const [lesson,setLesson]=useState<PublicLesson|null>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState(false)
  useEffect(()=>{
    let alive=true
    void (async()=>{
      try {
        const res=await supabase.rpc('vs_public_grade6_fractions_addition_learner_lesson')
        if (res.error) throw res.error
        if (!Array.isArray(res.data)) throw Error('invalid reader response')
        if (res.data.length===0) return
        if (res.data.length!==1) throw Error('ambiguous reader')
        const candidate=res.data[0] as Record<string,unknown>
        if (typeof candidate.resource_version_id!=='string'||!UUID.test(candidate.resource_version_id)
          ||typeof candidate.resource_id!=='string'||!UUID.test(candidate.resource_id)
          ||typeof candidate.title!=='string'||candidate.unit_id!=='1.4'
          ||!validPractice(candidate.questions)||!validQuiz(candidate.quick_check_mcqs)
          ||adaptCanonicalLearnSections(candidate.sections).length!==6) throw Error('invalid certified lesson')
        if (alive) setLesson(candidate as PublicLesson)
      } catch {if(alive)setError(true)}
      finally {if(alive)setLoading(false)}
    })()
    return()=>{alive=false}
  },[])
  const sections=useMemo(()=>lesson?adaptCanonicalLearnSections(lesson.sections):[],[lesson])
  const toolContext=useMemo(()=>lesson?buildLearningToolContext({
    sourceKind:'published_lesson',audience:'learner',subject:'Mathematics',grade:'Grade 6',
    resourceVersionId:lesson.resource_version_id,resourceId:lesson.resource_id,
    outcomeId:'65cc88b5-0767-4c09-965c-0ce562f3fdae',
    subStrandId:'d8f452e0-3270-4389-ad86-646af8f26f6d',sections,
  }):undefined,[lesson,sections])
  const questions=lesson?.questions
  const quiz=lesson?.quick_check_mcqs
  return <main className={styles.page}><div className={styles.wrap}>
    <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href="/learn">Learn</Link><span aria-hidden="true">›</span>
      <Link href="/learn?grade=Grade+6&subject=Mathematics">Grade 6 Mathematics</Link><span aria-hidden="true">›</span><span aria-current="page">Fractions</span></nav>
    <header className={styles.hero}>
      <p className={styles.kicker}>Grade 6 Mathematics · Numbers · Fractions</p>
      <h1>Adding Fractions with Different Denominators</h1>
      <p>Explore equivalent fractions with fraction bars. Work through examples, practise at your own pace and check what you remember.</p>
    </header>
    {loading?<p className={styles.loading} role="status">Loading certified Mathematics content…</p>
      :error?<p className={styles.error} role="alert">This lesson could not be loaded. Please reopen the page.</p>
      :!lesson?<p className={styles.empty} role="status">This fractions lesson is not currently published for learners.</p>
      :<div className={styles.content}>
        <UniversalLearnReader subject="Mathematics" topic="Adding unlike fractions"
          sections={sections} toolContext={toolContext} anchorPrefix="grade6-fractions"
          renderBody={(section)=>section.id==='practice' && questions
            ?<PracticeCards questions={questions}/>
            :<LessonProse body={section.body}/>} />
        {quiz && <QuickCheck questions={quiz}/>}
      </div>}
  </div></main>
}

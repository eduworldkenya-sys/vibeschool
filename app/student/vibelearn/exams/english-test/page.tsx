'use client'
import { useState } from 'react'
import Link from 'next/link'

const questions = [
  { q: 'Mary _____ to school every morning.', a: ['go', 'goes', 'going', 'gone'], correct: 1 },
  { q: 'Which word is the opposite of happy?', a: ['Joyful', 'Excited', 'Sad', 'Kind'], correct: 2 },
  { q: 'Choose the correctly punctuated sentence.', a: ['where is my bag.', 'Where is my bag?', 'where is my bag?', 'Where is my bag.'], correct: 1 },
  { q: 'What is the plural of child?', a: ['Childs', 'Children', 'Childes', 'Childrens'], correct: 1 },
  { q: 'Which word is an adjective? The clever girl answered the question.', a: ['girl', 'answered', 'clever', 'question'], correct: 2 },
  { q: 'Choose the past tense of eat.', a: ['eated', 'eating', 'eats', 'ate'], correct: 3 },
  { q: 'Which sentence is a polite request?', a: ['Give me that book!', 'May I borrow your book, please?', 'I want that book.', 'Bring it now.'], correct: 1 },
  { q: 'Which word is a pronoun?', a: ['Teacher', 'She', 'School', 'Beautiful'], correct: 1 },
  { q: 'The books are _____ the table.', a: ['on', 'quickly', 'happy', 'run'], correct: 0 },
  { q: 'Which sentence is in the future tense?', a: ['I played yesterday.', 'I am playing now.', 'I will play tomorrow.', 'I play every day.'], correct: 2 },
]
export default function Grade4EnglishTest() {
 const [started,setStarted]=useState(false)
 const [index,setIndex]=useState(0)
 const [answers,setAnswers]=useState<Record<number,number>>({})
 const [confirm,setConfirm]=useState(false)
 const [finished,setFinished]=useState(false)
 const count=Object.keys(answers).length
 const score=questions.reduce((sum,q,i)=>sum+(answers[i]===q.correct?1:0),0)
 const button:React.CSSProperties={border:0,borderRadius:12,padding:'14px 18px',fontSize:16,fontWeight:700,background:'#17365d',color:'white',cursor:'pointer'}
 return <main style={{maxWidth:480,margin:'0 auto',padding:'20px 16px 110px',fontFamily:'system-ui,sans-serif',color:'#14243b'}}>
  <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}><strong>VibeSchool</strong><span>Grade 4 · Test</span></header>
  <Link href="/student/vibelearn/exams" style={{color:'#17365d'}}>← Exams</Link>
  {!started?<section style={{marginTop:40}}><p>ENGLISH ACTIVITIES</p><h1>Grade 4 English</h1><p>10 questions · Suggested time: 20 minutes</p><p>This is a demonstration. Results are not saved to your school record.</p><button style={button} onClick={()=>setStarted(true)}>Start exam →</button></section>:
  finished?<section aria-live="polite"><h1>Exam completed</h1><h2>{score} / 10 ({score*10}%)</h2>{questions.map((q,i)=><p key={i}>Question {i+1}: {answers[i]===q.correct?'Correct':`Correct answer: ${q.a[q.correct]}`}</p>)}<button style={button} onClick={()=>{setStarted(false);setFinished(false);setIndex(0);setAnswers({});setConfirm(false)}}>Try again</button></section>:
  <section><p style={{fontSize:13}}>ENGLISH ACTIVITIES · {count} answered</p><h1 style={{fontSize:23}}>Question {index+1} of {questions.length}</h1>
  <div style={{height:6,background:'#e5e7eb',borderRadius:8,overflow:'hidden'}}><div style={{height:'100%',width:`${(index+1)*10}%`,background:'#17365d'}} /></div>
  <nav aria-label="Jump to question" style={{display:'flex',flexWrap:'wrap',gap:7,margin:'20px 0'}}>{questions.map((_,i)=><button key={i} aria-label={`Question ${i+1}`} aria-current={index===i?'step':undefined} onClick={()=>{setIndex(i);setConfirm(false)}} style={{width:36,height:36,borderRadius:9,border:'1px solid #bac5d2',background:index===i?'#17365d':answers[i]!==undefined?'#dcece4':'white',color:index===i?'white':'#14243b'}}>{i+1}</button>)}</nav>
  <h2 style={{fontSize:20,lineHeight:1.5}}>{questions[index].q}</h2>
  <fieldset style={{border:0,padding:0,margin:'22px 0'}}><legend style={{position:'absolute',width:1,height:1,overflow:'hidden'}}>Select an answer</legend>{questions[index].a.map((option,i)=><label key={i} style={{display:'flex',alignItems:'center',gap:12,minHeight:58,padding:'8px 14px',marginBottom:10,border:`2px solid ${answers[index]===i?'#17365d':'#dbe1e8'}`,borderRadius:12,background:answers[index]===i?'#edf4fc':'white',cursor:'pointer'}}><input type="radio" name={`q-${index}`} checked={answers[index]===i} onChange={()=>{setAnswers(prev=>({...prev,[index]:i}));setConfirm(false)}} style={{width:20,height:20}} />{String.fromCharCode(65+i)}. {option}</label>)}</fieldset>
  {confirm?<div role="alert"><p>Submit {count} of 10 answered questions? You cannot change answers afterwards.</p><button style={{...button,background:'#e5e7eb',color:'#14243b',marginRight:8}} onClick={()=>setConfirm(false)}>Cancel</button><button style={button} onClick={()=>setFinished(true)}>Submit exam</button></div>:
  <div style={{display:'flex',gap:12}}><button style={{...button,background:'#e5e7eb',color:'#14243b',opacity:index===0?.5:1}} disabled={index===0} onClick={()=>setIndex(i=>i-1)}>← Back</button><button style={{...button,flex:1,opacity:answers[index]===undefined?.5:1}} disabled={answers[index]===undefined} onClick={()=>index===9?setConfirm(true):setIndex(i=>i+1)}>{index===9?'Finish':'Next →'}</button></div>}
  <p style={{fontSize:12,color:'#64748b',marginTop:20}}>Test mode · Answers stay on this screen · No backend submission</p></section>}
 </main>
}

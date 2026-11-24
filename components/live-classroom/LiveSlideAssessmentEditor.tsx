'use client'
import {useState} from 'react'
import {encodeAssessment, type SlideAssessment} from './LiveSlideProtocol'
import styles from './LiveClassroom.module.css'
export function AssessmentEditor({initial,disabled,onApply,onCancel}:{initial:SlideAssessment;disabled:boolean;onApply:(body:string)=>void;onCancel:()=>void}){
 const [value,setValue]=useState(initial)
 const encoded=encodeAssessment(value)
 return <section className={styles.slideFields} aria-label="Slide assessment editor">
 <label>Activity<select value={value.kind} disabled={disabled} onChange={e=>setValue(v=>({...v,kind:e.target.value==='poll'?'poll':'quiz'}))}><option value="quiz">Quiz</option><option value="poll">Poll</option></select></label>
 <label>Question<textarea value={value.question} maxLength={500} disabled={disabled} onChange={e=>setValue(v=>({...v,question:e.target.value}))}/></label>
 {value.options.map((option,i)=><div key={i} className={styles.slideToolbar}><label>Option {String.fromCharCode(65+i)}<input value={option} maxLength={140} disabled={disabled} onChange={e=>setValue(v=>({...v,options:v.options.map((o,j)=>j===i?e.target.value:o)}))}/></label><button type="button" disabled={disabled||value.options.length<=2} onClick={()=>setValue(v=>({...v,options:v.options.filter((_,j)=>j!==i)}))}>Remove</button></div>)}
 <button type="button" disabled={disabled||value.options.length>=6} onClick={()=>setValue(v=>({...v,options:[...v.options,'']}))}>Add option</button>
 <small>Quiz answers are entered privately when launching the activity in Live Lesson. They are never stored in the public slide.</small>
 <div className={styles.slideToolbar}><button type="button" disabled={disabled||!encoded} onClick={()=>onApply(encoded)}>Apply activity</button><button type="button" disabled={disabled} onClick={onCancel}>Cancel</button></div>
 </section>
}

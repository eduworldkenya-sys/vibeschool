'use client'
import {useState} from 'react'
import {decodeAssessment,preparedAssessment,prepareAssessment,presenterNotes,setPresenterNotes,type LiveSlide} from './LiveSlideProtocol'
import styles from './LiveClassroom.module.css'
export function PrivateSlideFields({slide,disabled,onChange}:{slide:LiveSlide;disabled:boolean;onChange:(notes:string)=>void}){
 const [error,setError]=useState('')
 const q=decodeAssessment(slide.body),a=preparedAssessment(slide)
 function apply(next:string|null){if(next===null){setError('Private preparation exceeds the available notes budget. Shorten the notes or explanation.');return}setError('');onChange(next)}
 return <section className={styles.slideFields} aria-label="Private slide preparation">
 {q?.kind==='quiz'&&<><label>Correct answer (private)<select value={a?.option??''} disabled={disabled} onChange={e=>apply(prepareAssessment(slide,e.target.value===''?null:Number(e.target.value),a?.explanation??''))}><option value="">Choose answer</option>{q.options.map((o,i)=><option key={i} value={i}>{String.fromCharCode(65+i)}. {o}</option>)}</select></label>
 {a&&<label>Explanation (private)<textarea value={a.explanation} maxLength={800} disabled={disabled} onChange={e=>apply(prepareAssessment(slide,a.option,e.target.value))}/></label>}
 <small>The answer and explanation are included in the existing hidden answer field only when you launch this quiz. Editing the question invalidates the old key.</small></>}
 <label>Presenter notes (private)<textarea maxLength={2000} value={presenterNotes(slide.notes)} disabled={disabled} onChange={e=>apply(setPresenterNotes(slide.notes,e.target.value))}/></label>
 {error&&<p role="alert">{error}</p>}
 </section>
}

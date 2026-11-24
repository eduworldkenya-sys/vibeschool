'use client'
import {useState,type ReactNode} from 'react'
import {liveAnswerChoices} from '@/lib/live/learnerActivity'
import styles from './LiveClassroom.module.css'
type Item={id:string;kind:'teach'|'quiz'|'exercise'|'poll'|'clock'|'board';body:string;answerKey:string|null;revealed:boolean}
type Props={items:readonly Item[];renderPage:(item:Item)=>ReactNode;onClose:()=>void}
function Practice({item}:{item:Item}){
 const [answer,setAnswer]=useState(''),[checked,setChecked]=useState(false)
 const options=liveAnswerChoices(item.body)
 const released=item.revealed&&!!item.answerKey
 return <section aria-label="Private practice" className={styles.selfPacedPractice}>
 <p>{item.body}</p>
 {options.length?<fieldset><legend>Choose your answer</legend>{options.map(o=><label key={o.letter}><input type="radio" name={'review-'+item.id} value={o.value} checked={answer===o.value} onChange={()=>{setAnswer(o.value);setChecked(false)}}/> {o.value}</label>)}</fieldset>:<label>Your answer<textarea maxLength={2000} value={answer} onChange={e=>{setAnswer(e.target.value);setChecked(false)}}/></label>}
 <button type="button" disabled={!answer.trim()} onClick={()=>setChecked(true)}>{item.kind==='poll'?'Keep my choice':released?'Check my answer':'Finish practice'}</button>
 {checked&&<div role="status">{item.kind==='poll'?<p>Your practice choice is private. It has not changed class poll results.</p>:released?<><strong>Teacher’s released answer</strong><p>{item.answerKey}</p><p>Compare your work with this answer.</p></>:<p>The teacher has not released an answer. Your practice has not been graded or submitted.</p>}</div>}
 <small>Practice only. Your original classroom answers are unchanged.</small>
 </section>
}
export function LiveSelfPacedReview({items,renderPage,onClose}:Props){
 const [selected,setSelected]=useState<string|null>(null),[visited,setVisited]=useState<Set<string>>(new Set()),[finished,setFinished]=useState(false)
 const index=Math.max(0,items.findIndex(p=>p.id===selected)),item=items[index]
 function complete(){if(item)setVisited(v=>new Set([...v,item.id]))}
 function next(){complete();if(index+1<items.length)setSelected(items[index+1].id);else setFinished(true)}
 const count=items.filter(p=>visited.has(p.id)).length
 return <section className={styles.selfPaced} aria-label="Self-paced lesson review">
 <div className={styles.slideToolbar}><strong>Learn at your pace</strong><button type="button" onClick={onClose}>Close review</button></div>
 <small>Only materials already shared in this lesson are included. Review progress lasts while this review is open.</small>
 {!item?<p>No shared lesson pages to review.</p>:<>
 <progress max={items.length} value={count} aria-label="Pages reviewed"/><p role="status">{count} of {items.length} pages reviewed</p>
 {finished?<section><h3>Review finished</h3><p>You reviewed {count} of {items.length} pages in this session.</p><button type="button" onClick={()=>{setVisited(new Set());setSelected(null);setFinished(false)}}>Review again</button><button type="button" onClick={onClose}>Close</button></section>:<>
 <div className={styles.slideToolbar}><button type="button" disabled={index===0} onClick={()=>setSelected(items[index-1].id)}>Previous</button><span>Page {index+1} / {items.length}</span><button type="button" onClick={next}>{index===items.length-1?'Finish':'Next'}</button></div>
 <div key={item.id}>{['quiz','poll','exercise'].includes(item.kind)?<Practice item={item}/>:renderPage(item)}</div>
 </>}
 </>}
 </section>
}

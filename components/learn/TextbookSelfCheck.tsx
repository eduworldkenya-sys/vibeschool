'use client'
import { useState } from 'react'
import type { ContentBlock } from '@/lib/publishTypes'
import styles from './PublishedTextbookEditorial.module.css'

/** Deliberately ungraded learning feedback. Never use this block for a scored
 * assessment, exam or private answer key. It receives only published blocks. */
export default function TextbookSelfCheck({block}:{block:ContentBlock}){
 const meta=block.meta??{}
 const choices=Array.isArray(meta.options)&&meta.options.every(v=>typeof v==='string')?meta.options:[]
 const correct=typeof meta.revealChoice==='string'?meta.revealChoice:''
 const explanation=typeof meta.explanation==='string'?meta.explanation:''
 const [selected,setSelected]=useState<string|null>(null)
 const [checked,setChecked]=useState(false)
 if(meta.ungraded!==true||choices.length<2||choices.length>6||new Set(choices).size!==choices.length||!choices.includes(correct)||!explanation||!block.content.trim())return <p>Review the explanation above before continuing.</p>
 return <section className={styles.selfCheck} aria-label="Ungraded learning check">
   <fieldset>
     <legend>Quick check</legend>
     <p>{block.content}</p>
     {choices.map((choice,i)=><label key={i} className={styles.selfCheckChoice}>
       <input type="radio" name={block.id} checked={selected===choice} disabled={checked} onChange={()=>setSelected(choice)}/>
       <span>{choice}</span>
     </label>)}
   </fieldset>
   {!checked?<button type="button" className={styles.selfCheckButton} disabled={selected===null} onClick={()=>setChecked(true)}>Check</button>:
   <div aria-live="polite"><p className={styles.selfCheckFeedback}>{selected===correct?'Correct.':'Review this idea.'} {explanation}</p><button type="button" className={styles.selfCheckButton} onClick={()=>{setSelected(null);setChecked(false)}}>Try again</button></div>}
 </section>
}

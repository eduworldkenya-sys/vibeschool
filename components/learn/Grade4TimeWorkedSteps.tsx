'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, RotateCcw } from 'lucide-react'
import { VisualRichText } from '@/components/learn/VisualLearningAsset'
import styles from './Grade4TimeContentReader.module.css'

/** Show the exact published numbered working in a learner-paced sequence. */
export default function Grade4TimeWorkedSteps({body}:{body:string}) {
  const example = useMemo(()=>{
    const lines = body.replace(/\r\n?/g,'\n').split('\n')
    const prompt:string[]=[]
    const steps:string[]=[]
    for (const raw of lines) {
      const line=raw.trim()
      const match=/^\d+\.\s+(.+)$/.exec(line)
      if (match) steps.push(match[1])
      else if (steps.length && line) steps[steps.length-1] += '\n'+line
      else if (line) prompt.push(line)
    }
    return {prompt:prompt.join('\n'),steps}
  },[body])
  const [shown,setShown] = useState(1)
  if (example.steps.length<2) return <VisualRichText body={body} style={{fontSize:17,lineHeight:1.85}}/>
  return <div className={styles.working}>
    {example.prompt && <div className={styles.workingPrompt}>
      <VisualRichText body={example.prompt} style={{fontSize:17,lineHeight:1.8}}/>
    </div>}
    <ol className={styles.workedStepList}>
      {example.steps.slice(0,shown).map((step,index)=>
        <li className={styles.workedStep} key={index}>
          <span aria-hidden="true" className={styles.stepNumber}>{index+1}</span>
          <VisualRichText body={step} style={{fontSize:17,lineHeight:1.75}}/>
        </li>)}
    </ol>
    <div className={styles.workedControls}>
      {shown<example.steps.length
        ? <button type="button" onClick={()=>setShown(current=>Math.min(example.steps.length,current+1))}>
            Show next step <ArrowRight size={16} aria-hidden="true"/>
          </button>
        : <p role="status" className={styles.allStepsVisible}>All {example.steps.length} steps are shown. Now try a similar question.</p>}
      <button type="button" className={styles.workReset} onClick={()=>setShown(shown===1?example.steps.length:1)}>
        {shown===1?'Show all steps':<><RotateCcw size={14} aria-hidden="true"/> Start again</>}
      </button>
    </div>
  </div>
}

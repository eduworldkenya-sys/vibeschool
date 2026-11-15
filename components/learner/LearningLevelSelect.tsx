'use client'

import { LEARNING_LEVELS } from '@/lib/learner/learning-levels'

type Props = {
  level: string
  choice: string
  onLevelChange: (level: string) => void
  onChoiceChange: (choice: string) => void
  disabled?: boolean
}

export default function LearningLevelSelect({level,choice,onLevelChange,onChoiceChange,disabled=false}:Props) {
  const selected = LEARNING_LEVELS.find(item => item.id === level)
  return <div style={{display:'grid',gap:14}}>
    <label style={{display:'grid',gap:7,fontSize:13,fontWeight:700}}>
      Learning level
      <select aria-label="Learning level" value={level} disabled={disabled}
        onChange={event=>{onLevelChange(event.target.value);onChoiceChange('')}}
        style={{width:'100%',borderRadius:11,padding:'10px 12px'}}>
        <option value="">Choose your level</option>
        {LEARNING_LEVELS.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </label>
    <label style={{display:'grid',gap:7,fontSize:13,fontWeight:700}}>
      {level==='professional'?'Course':level==='college'?'Qualification':'Grade / Programme'}
      <select aria-label="Grade or programme" value={choice} disabled={!selected||disabled}
        onChange={event=>onChoiceChange(event.target.value)}
        style={{width:'100%',borderRadius:11,padding:'10px 12px'}}>
        <option value="">{selected?'Choose':'Select level first'}</option>
        {selected?.choices.map(item=><option key={item} value={item}>{item}</option>)}
      </select>
    </label>
  </div>
}

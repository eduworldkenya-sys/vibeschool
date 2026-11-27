'use client'
import {useState} from 'react'
import {ExecutiveDialog} from './ExecutiveDialog'
import styles from './LiveClassroom.module.css'

type ClassroomAction={label:string;detail:string;keywords:string;disabled?:boolean;run:()=>void}
export function ExecutiveCommandPalette({actions,onClose}:{actions:ClassroomAction[];onClose:()=>void}){
 const [query,setQuery]=useState('')
 const terms=query.toLowerCase().trim().split(/\s+/).filter(Boolean)
 const matches=actions.filter(action=>terms.every(term=>(action.label+' '+action.detail+' '+action.keywords).toLowerCase().includes(term)))
 const run=(action:ClassroomAction)=>{if(action.disabled)return;onClose();action.run()}
 return <ExecutiveDialog title="Find a teaching action" onClose={onClose}>
  <label className={styles.commandSearch}>Search tools<input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="Try ruler, quiz, or invite…" onKeyDown={event=>{if(event.key==='Enter'){const first=matches.find(action=>!action.disabled);if(first){event.preventDefault();run(first)}}}}/></label>
  <div className={styles.commandResults} aria-label="Matching actions">{matches.map(action=><button type="button" key={action.label} disabled={action.disabled} onClick={()=>run(action)}><strong>{action.label}</strong><small>{action.detail}</small></button>)}</div>
  <small role="status">{matches.length?matches.length+' actions found':'No matching actions. Try another search.'}</small>
 </ExecutiveDialog>
}

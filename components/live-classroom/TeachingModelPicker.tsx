'use client'

import {useId, useState, type ReactNode} from 'react'
import {defaultDemo, DEMO_RANGES, diagramLabel, type DemoKind, type SlideDemo} from './LiveSlideProtocol'
import {DemoDrawing, DemoControls, DemoResult, ExploreDemo} from './LiveAdjustableDiagram'
import {teachingToolModel} from './TeachingToolModels.mjs'
import styles from './TeachingModelPicker.module.css'

const subjects: Partial<Record<DemoKind, string>> = {
  'electric-circuit': 'Science and Technology',
  'lever-balance': 'Science and Technology',
  'map-scale': 'Social Studies',
}
const models = (Object.keys(DEMO_RANGES) as DemoKind[]).map(kind => ({
  kind, label: diagramLabel(kind), subject: teachingToolModel(kind)?.subject ?? subjects[kind] ?? 'Mathematics',
})).sort((a,b) => a.label.localeCompare(b.label, 'en'))
const groups = Array.from(new Set(models.map(item => item.subject))).sort()

export function TeachingModelOptions() {
  return <>{groups.map(group => <optgroup key={group} label={group}>
    {models.filter(item => item.subject===group).map(({kind,label}) => <option key={kind} value={kind}>{label}</option>)}
  </optgroup>)}</>
}

export function TeachingModelPicker({onPresent,disabled=false,activities=[],actionLabel='Present to class'}:{
  onPresent?: (demo:SlideDemo)=>void
  disabled?: boolean
  actionLabel?: string
  activities?: readonly {kind:string;label:string;subject:string;render:()=>ReactNode}[]
}) {
  const modelId = useId()
  const subjectId = useId()
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState('')
  const [selected, setSelected] = useState<string>('ruler')
  const options = [...models,...activities]
  const allGroups = activities.length ? [...new Set(options.map(item=>item.subject))].sort() : groups
  const query = search.trim().toLocaleLowerCase('en')
  const results = options.filter(item => (!group || item.subject === group)
    && (item.label+' '+item.subject).toLocaleLowerCase('en').includes(query))
  const active = results.find(item => item.kind===selected) ?? results[0]
  const activeModel = models.find(item=>item.kind===active?.kind)
  const activity = activities.find(item=>item.kind===active?.kind)

  return <div className={styles.catalogue}>
    <div className={styles.filters}>
      <label>Search tools<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ruler, fractions, science…" /></label>
      <div className={styles.field}><label htmlFor={subjectId}>Subject</label><select id={subjectId} value={group} onChange={e=>setGroup(e.target.value)}>
        <option value="">All subjects</option>
        {allGroups.map(item=><option key={item}>{item}</option>)}
      </select></div>
      {active&&<div className={styles.field}><label htmlFor={modelId}>Tool</label><select id={modelId} value={active.kind} onChange={e=>setSelected(e.target.value)}>
        {results.map(item=><option key={item.kind} value={item.kind}>{item.label}</option>)}
      </select></div>}
    </div>
    <p className={styles.count} role="status">{results.length ? `${results.length} ${results.length===1?'tool':'tools'}` : 'No tools match. Try another search or subject.'}</p>
    {active&&<section className={styles.preview} aria-label={active.label}>
      <h2>{active.label}</h2>
      {activeModel&&(onPresent
        ? <PresentModel key={active.kind} initial={defaultDemo(activeModel.kind)} disabled={disabled} onPresent={onPresent} actionLabel={actionLabel}/>
        : <ExploreDemo key={active.kind} demo={defaultDemo(activeModel.kind)}/>)}
      {activity&&<div key={activity.kind}>{activity.render()}</div>}
    </section>}
  </div>
}

function PresentModel({initial,disabled,onPresent,actionLabel}:{
  initial:SlideDemo;disabled:boolean;onPresent:(demo:SlideDemo)=>void;actionLabel:string
}) {
  const [demo, setDemo] = useState(initial)
  return <div className={styles.present}>
    <DemoDrawing demo={demo} onChange={disabled?undefined:setDemo}/>
    <DemoResult demo={demo}/>
    <DemoControls demo={demo} disabled={disabled} onChange={setDemo}/>
    <div className={styles.actions}>
      <button type="button" disabled={disabled} onClick={()=>setDemo(initial)}>Reset diagram</button>
      <button type="button" disabled={disabled} onClick={()=>onPresent(demo)}>{actionLabel}</button>
    </div>
  </div>
}

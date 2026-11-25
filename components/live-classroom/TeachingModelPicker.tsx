'use client'

import {useId, useState, type ReactNode} from 'react'
import {Ruler,Clock,CircleDot,ChartColumn,Shapes,FlaskConical,BookOpen,Pencil,Map,ChevronLeft,ChevronRight,Plus} from 'lucide-react'
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

const featured = ['ruler','clock','counter-groups','linear-graph','protractor','electric-circuit']
const featuredIcons = {ruler:Ruler,clock:Clock,'counter-groups':CircleDot,'linear-graph':ChartColumn,protractor:Shapes,'electric-circuit':FlaskConical}
const PAGE_SIZE=6
function toolIcon(kind:string,subject:string){
  return featuredIcons[kind as keyof typeof featuredIcons] ?? (/science/i.test(subject)?FlaskConical:/social|geograph/i.test(subject)?Map:/english|kiswahili|language/i.test(subject)?BookOpen:/art/i.test(subject)?Pencil:Shapes)
}

export function TeachingModelPicker({onPresent,disabled=false,activities=[],actionLabel='Present to class',layout='select'}:{
  onPresent?: (demo:SlideDemo)=>void
  disabled?: boolean
  actionLabel?: string
  layout?: 'select'|'grid'
  activities?: readonly {kind:string;label:string;subject:string;render:()=>ReactNode}[]
}) {
  const modelId = useId()
  const subjectId = useId()
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState('')
  const [selected, setSelected] = useState<string>('ruler')
  const [page,setPage]=useState(0)
  const options = [...models,...activities]
  if(layout==='grid')options.sort((a,b)=>{const rank=(k:string)=>featured.includes(k)?featured.indexOf(k):featured.length;return rank(a.kind)-rank(b.kind)||a.label.localeCompare(b.label,'en')})
  const allGroups = activities.length ? [...new Set(options.map(item=>item.subject))].sort() : groups
  const query = search.trim().toLocaleLowerCase('en')
  const results = options.filter(item => (!group || item.subject === group)
    && (item.label+' '+item.subject).toLocaleLowerCase('en').includes(query))
  const pageCount=Math.max(1,Math.ceil(results.length/PAGE_SIZE))
  const currentPage=Math.min(page,pageCount-1)
  const visible=layout==='grid'?results.slice(currentPage*PAGE_SIZE,(currentPage+1)*PAGE_SIZE):results
  const active = visible.find(item => item.kind===selected) ?? visible[0]
  const activeModel = models.find(item=>item.kind===active?.kind)
  const activity = activities.find(item=>item.kind===active?.kind)

  return <div className={styles.catalogue}>
    <div className={styles.filters}>
      <label>Search tools<input type="search" value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}} placeholder="Ruler, fractions, science…" /></label>
      <div className={styles.field}><label htmlFor={subjectId}>Subject</label><select id={subjectId} value={group} onChange={e=>{setGroup(e.target.value);setPage(0)}}>
        <option value="">All subjects</option>
        {allGroups.map(item=><option key={item}>{item}</option>)}
      </select></div>
      {layout==='select'&&active&&<div className={styles.field}><label htmlFor={modelId}>Tool</label><select id={modelId} value={active.kind} onChange={e=>setSelected(e.target.value)}>
        {results.map(item=><option key={item.kind} value={item.kind}>{item.label}</option>)}
      </select></div>}
    </div>
    <p className={styles.count} role="status">{results.length ? `${results.length} ${results.length===1?'tool':'tools'}` : 'No tools match. Try another search or subject.'}</p>
    {layout==='grid'&&results.length>0&&<>
      <div className={styles.toolGrid} role="group" aria-label="Choose an interactive tool">
        {visible.map(item=>{const Icon=toolIcon(item.kind,item.subject);return <button type="button" key={item.kind} className={styles.toolCard} aria-pressed={active?.kind===item.kind} onClick={()=>setSelected(item.kind)}><Icon size={26} strokeWidth={1.8} aria-hidden="true"/><span>{item.label}</span></button>})}
      </div>
      {pageCount>1&&<nav className={styles.pagination} aria-label="Tool pages"><button type="button" aria-label="Previous tools" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}><ChevronLeft size={20} aria-hidden="true"/></button><span>{currentPage+1} / {pageCount}</span><button type="button" aria-label="Next tools" disabled={currentPage===pageCount-1} onClick={()=>setPage(currentPage+1)}><ChevronRight size={20} aria-hidden="true"/></button></nav>}
    </>}
    {active&&<section className={styles.preview} aria-label={active.label}>
      <h2>{active.label}</h2>
      {activeModel&&(onPresent
        ? <PresentModel key={active.kind} initial={defaultDemo(activeModel.kind)} disabled={disabled} onPresent={onPresent} actionLabel={actionLabel} grid={layout==='grid'}/>
        : <ExploreDemo key={active.kind} demo={defaultDemo(activeModel.kind)}/>)}
      {activity&&<div key={activity.kind}>{activity.render()}</div>}
    </section>}
  </div>
}

function PresentModel({initial,disabled,onPresent,actionLabel,grid}:{
  initial:SlideDemo;disabled:boolean;onPresent:(demo:SlideDemo)=>void;actionLabel:string;grid:boolean
}) {
  const [demo, setDemo] = useState(initial)
  return <div className={styles.present}>
    <DemoDrawing demo={demo} onChange={disabled?undefined:setDemo}/>
    <DemoResult demo={demo}/>
    <DemoControls demo={demo} disabled={disabled} onChange={setDemo}/>
    <div className={grid?styles.gridActions:styles.actions}>
      <button type="button" disabled={disabled} onClick={()=>setDemo(initial)}>Reset diagram</button>
      <button type="button" className={grid?styles.addButton:undefined} disabled={disabled} onClick={()=>onPresent(demo)}>{grid&&<Plus size={19} aria-hidden="true"/>}{actionLabel}</button>
    </div>
  </div>
}

'use client'

import {
  GRADE3_ENGLISH_SOURCE_URL,
  GRADE3_ENGLISH_SOURCE_EDITION,
  GRADE3_ENGLISH_LESSONS_PER_WEEK,
  GRADE3_ENGLISH_SUGGESTED_LESSONS,
  GRADE3_ENGLISH_STRANDS,
  GRADE3_ENGLISH_UNITS,
} from '@/lib/teaching/grade3EnglishCatalog.mjs'

type Props = {
  compact?: boolean
  selectedUnitId?: string
  onSelectUnit?: (unitId: string) => void
  onOpenScheme?: (unitId: string) => void
}

export default function Grade3EnglishMap({ compact = false, selectedUnitId = '1.1', onSelectUnit, onOpenScheme }: Props) {
  const selected = GRADE3_ENGLISH_UNITS.find(unit => unit.id === selectedUnitId) ?? GRADE3_ENGLISH_UNITS[0]
  return <section aria-label="Grade 3 English curriculum map" style={{ color:'#183e30', border:'1px solid #d4e5da', borderRadius:16, background:'#fff', padding:compact?14:18, marginBottom:14 }}>
    <p style={{fontSize:11,letterSpacing:'.07em',fontWeight:800,color:'#27694e',margin:'0 0 5px'}}>GRADE 3 · ENGLISH LANGUAGE ACTIVITIES</p>
    <h2 style={{fontSize:compact?19:23,margin:'0 0 6px'}}>Curriculum Map</h2>
    <p style={{fontSize:13,color:'#50685c',lineHeight:1.5,margin:'0 0 12px'}}>KICD 2024 source index · {GRADE3_ENGLISH_STRANDS.length} strands · {GRADE3_ENGLISH_UNITS.length} summary sub-strands · {GRADE3_ENGLISH_SUGGESTED_LESSONS} suggested lessons · {GRADE3_ENGLISH_LESSONS_PER_WEEK} per week.</p>
    <p style={{fontSize:12,color:'#526a5c',margin:'0 0 14px'}}>This is a structural reference, not the full KICD transcription or verified outcomes. Suggested lesson counts do not create or schedule Scheme lessons. Language structures should be taught implicitly at this grade.</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10}}>
      {GRADE3_ENGLISH_STRANDS.map(strand=><div key={strand.id} style={{border:'1px solid #e0eae3',borderRadius:12,padding:10}}>
        <strong style={{display:'block',fontSize:13,marginBottom:7}}>{strand.title} · {strand.lessons} lessons</strong>
        {GRADE3_ENGLISH_UNITS.filter(unit=>unit.strand===strand.title).map(unit=><button key={unit.id} type="button" aria-pressed={selected.id===unit.id}
          onClick={()=>onSelectUnit?.(unit.id)}
          style={{display:'block',textAlign:'left',cursor:'pointer',width:'100%',minHeight:42,marginTop:5,padding:'9px 11px',borderRadius:8,border:'1px solid '+(selected.id===unit.id?'#27724c':'#d7e4da'),background:selected.id===unit.id?'#eaf5ee':'#fff',color:'#1a4531'}}>
          {unit.title} <span style={{float:'right',color:'#567463',fontSize:12}}>{unit.lessons}</span>
        </button>)}
      </div>)}
    </div>
    <div style={{marginTop:13,padding:12,borderRadius:11,background:'#f3f8f4',border:'1px solid #d8e9dc'}}>
      <strong style={{display:'block',fontSize:14}}>{selected.strand} · {selected.title}</strong>
      <p style={{fontSize:12,color:'#51695b',lineHeight:1.5,margin:'6px 0 10px'}}>{selected.lessons} suggested lessons. Choose a term and instructional week in the existing Scheme workspace to plan; confirmed outcomes and teacher authorization are required to save a curriculum-linked Scheme lesson.</p>
      {onOpenScheme && <button type="button" onClick={()=>onOpenScheme(selected.id)} style={{border:0,borderRadius:9,background:'#176546',color:'#fff',fontWeight:750,minHeight:44,padding:'9px 13px',cursor:'pointer'}}>Open Scheme of Work</button>}
    </div>
    <p style={{fontSize:11,color:'#597265',margin:'12px 0 0'}}>{GRADE3_ENGLISH_SOURCE_EDITION} · summary p.176. <a href={GRADE3_ENGLISH_SOURCE_URL} target="_blank" rel="noopener noreferrer" style={{color:'#176546',textDecoration:'underline'}}>Official KICD document</a></p>
  </section>
}

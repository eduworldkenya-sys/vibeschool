'use client'

import { useMemo, useState } from 'react'
import reference from '@/content/curriculum/grade9-mathematics-hierarchy-2024-candidate.json'

/**
 * Reference-only curriculum outline. The observed April 2024 summary is NOT
 * a verified July 2024 source snapshot. Never use this reader to promote
 * canonical outcomes, schedule lessons or claim curriculum certification.
 */
export const GRADE9_MATHEMATICS_UNITS = reference.april_2024_summary.sub_strands.map(unit => ({
  id: unit.code,
  title: unit.sub_strand,
  strand: unit.strand,
  lessons: unit.suggested_lessons,
}))

type Props = {
  selectedUnitId?: string
  onSelectUnit?: (unitId: string) => void
  showExisting?: boolean
  onToggleExisting?: () => void
  legacyCount?: number
  onOpenScheme?: (unitId: string) => void
}

const ink = '#193b30'
const muted = '#52675e'
const border = '#dce8df'

export default function Grade9MathematicsMap({
  selectedUnitId = '1.1',
  onSelectUnit,
  showExisting = false,
  onToggleExisting,
  legacyCount = 0,
  onOpenScheme,
}: Props) {
  const [search, setSearch] = useState('')
  const [chosenStrand, setChosenStrand] = useState('Numbers')
  const query = search.trim().toLocaleLowerCase()
  const selectedUnit = GRADE9_MATHEMATICS_UNITS.find(unit => unit.id === selectedUnitId)
  const activeStrand = selectedUnit?.strand ?? chosenStrand
  const visibleUnits = useMemo(() => GRADE9_MATHEMATICS_UNITS.filter(unit =>
    query
      ? [unit.id, unit.title, unit.strand].some(value => value.toLocaleLowerCase().includes(query))
      : unit.strand === activeStrand
  ), [query, activeStrand])

  return (
    <section aria-label="Grade 9 Mathematics curriculum reference" style={{background:'#fff',border:`1px solid ${border}`,borderRadius:16,padding:18,marginBottom:14,color:ink}}>
      <div style={{fontSize:11,fontWeight:800,letterSpacing:'.08em',color:'#48785e'}}>GRADE 9 · MATHEMATICS · CURRICULUM MAP</div>
      <h2 style={{fontSize:23,margin:'5px 0 8px'}}>Mathematics learning areas</h2>
      <p style={{fontSize:13,color:muted,lineHeight:1.6,margin:'0 0 12px'}}>Explore the strands and sub-strands in the available 2024 curriculum outline. The revised July source and specific learning outcomes have not yet been verified in VibeSchool.</p>
      <div role="status" style={{padding:'10px 12px',background:'#fff7e8',border:'1px solid #eed8ad',borderRadius:9,fontSize:12,lineHeight:1.55,marginBottom:12}}>
        <strong>Reference outline — not yet certified.</strong> Suggested lesson counts are from the April 2024 summary and are not allocated school weeks. No outcome or Scheme link has been created from this draft.
      </div>
      <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:14}}>
        {['5 strands','19 sub-strands','150 suggested lessons · April reference','5 Mathematics lessons per week · April reference'].map(label=>
          <span key={label} style={{background:'#edf6f0',color:ink,borderRadius:20,padding:'6px 10px',fontSize:12,fontWeight:700}}>{label}</span>
        )}
      </div>
      <label htmlFor="grade9-mathematics-topic-search" style={{display:'block',fontSize:12,fontWeight:800,marginBottom:6}}>Find a topic or sub-strand</label>
      <input id="grade9-mathematics-topic-search" type="search" value={search} onChange={event=>setSearch(event.target.value)}
        placeholder="e.g. 2.3, trigonometry, probability"
        style={{width:'100%',boxSizing:'border-box',minHeight:44,borderRadius:9,border:`1px solid ${border}`,padding:'10px 12px',fontSize:14,marginBottom:12}}/>
      {!query&&<div aria-label="Mathematics strands" style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:13}}>
        {reference.strands.map(strand=><button type="button" key={strand.code}
          onClick={()=>{setChosenStrand(strand.name);onSelectUnit?.(strand.sub_strands[0][0])}}
          aria-pressed={strand.name===activeStrand}
          style={{minHeight:40,padding:'8px 12px',borderRadius:9,background:strand.name===activeStrand?'#24634b':'#fff',color:strand.name===activeStrand?'#fff':ink,border:`1px solid ${border}`,fontSize:12,fontWeight:750,cursor:'pointer'}}>
          {strand.name}
        </button>)}
      </div>}
      {visibleUnits.length===0?<p role="status" style={{fontSize:13,color:muted}}>No matching sub-strands. Try another search.</p>:
        <div style={{display:'grid',gap:9}}>
          {visibleUnits.map(unit=><article key={unit.id} style={{border:`1px solid ${border}`,borderRadius:10,padding:12,background:unit.id===selectedUnitId?'#f4f9f5':'#fff'}}>
            <button type="button" onClick={()=>onSelectUnit?.(unit.id)}
              style={{display:'flex',alignItems:'flex-start',gap:12,width:'100%',textAlign:'left',border:0,background:'transparent',cursor:'pointer',color:ink,padding:0}}>
              <span style={{minWidth:35,fontSize:12,fontWeight:800,color:'#317258'}}>{unit.id}</span>
              <span style={{flex:1}}>
                <strong style={{display:'block',fontSize:14}}>{unit.title}</strong>
                <span style={{fontSize:12,color:muted,marginTop:4,display:'block'}}>{unit.strand} · {unit.lessons} suggested lessons</span>
              </span>
            </button>
          </article>)}
        </div>}
      <p style={{fontSize:12,color:muted,lineHeight:1.55,marginTop:13}}>
        <a href={reference.registered_source_url} target="_blank" rel="noopener noreferrer" style={{color:'#24634b',fontWeight:700}}>KICD July 2024 revised Mathematics design (official source)</a> · Curriculum authority is registered, but its learning outcomes remain unverified.
      </p>
      <p style={{fontSize:12,color:muted,lineHeight:1.55,marginTop:13}}>Specific learning outcomes, learning experiences, key inquiry questions and assessments require verified canonical records before lessons can be linked to the Scheme of Work.</p>
      <div style={{display:'flex',flexWrap:'wrap',gap:9,marginTop:12}}>
        {onToggleExisting&&<button type="button" onClick={onToggleExisting} style={{minHeight:44,border:`1px solid ${border}`,borderRadius:9,padding:'9px 12px',fontSize:12,fontWeight:750,background:'#fff',color:ink,cursor:'pointer'}}>
          {showExisting?'Hide earlier stored topics':`Show earlier stored topics (${legacyCount})`}
        </button>}
        {onOpenScheme&&<button type="button" onClick={()=>onOpenScheme(selectedUnitId)} style={{minHeight:44,border:0,borderRadius:9,padding:'9px 12px',fontSize:12,fontWeight:750,background:'#24634b',color:'#fff',cursor:'pointer'}}>Plan selected sub-strand in Scheme</button>}
      </div>
    </section>
  )
}

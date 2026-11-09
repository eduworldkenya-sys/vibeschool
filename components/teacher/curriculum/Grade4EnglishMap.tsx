'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  GRADE4_ENGLISH_SOURCE,
  GRADE4_ENGLISH_STRANDS,
  GRADE4_ENGLISH_SUBSTRANDS,
  GRADE4_ENGLISH_THEMES,
  suggestedTermForTheme,
} from '@/lib/curriculum/grade4EnglishReference'

type Props = {
  selectedTerm: number | null
  selectedWeek: number
  weeklyRows: readonly {id: string; week: number | null; strand: string | null; sub_strand: string | null; topic: string | null}[]
  schemeLessons: readonly {id: string; week: number; topic: string | null; curriculum_id: string | null; status: string}[]
  showExisting: boolean
  onToggleExisting: () => void
  onOpenScheme: () => void
  weeklyCount: number
  schemeCount: number
  verifiedOutcomeCount: number
}

/**
 * A read-only source reference until KICD SLOs are reconciled with canonical
 * curriculum IDs. Never generate a scheme from unmapped reference headings.
 */
export default function Grade4EnglishMap({ selectedTerm, selectedWeek, weeklyRows, schemeLessons, showExisting, onToggleExisting, onOpenScheme, weeklyCount, schemeCount, verifiedOutcomeCount }: Props) {
  const [selectedTheme, setSelectedTheme] = useState<number | null>(null)
  const [showYear, setShowYear] = useState(false)
  const weekRows = useMemo(() => weeklyRows.filter(row => row.week === selectedWeek), [weeklyRows, selectedWeek])
  const weekLessons = useMemo(() => schemeLessons.filter(lesson => lesson.week === selectedWeek), [schemeLessons, selectedWeek])
  const visibleThemes = useMemo(() =>
    showYear || !selectedTerm
      ? GRADE4_ENGLISH_THEMES
      : GRADE4_ENGLISH_THEMES.filter(theme => suggestedTermForTheme(theme.number) === selectedTerm),
  [showYear, selectedTerm])
  useEffect(() => {
    // Reset the expanded theme when a teacher changes the school term.
    setSelectedTheme(null)
    setShowYear(false)
  }, [selectedTerm])

  return <section aria-label="Grade 4 English curriculum reference" style={{background:'#fff',border:'1px solid #dce6e0',borderRadius:16,padding:16,marginBottom:16}}>
    <header>
      <div style={{fontSize:11,fontWeight:800,color:'#326853',letterSpacing:'.04em'}}>GRADE 4 · ENGLISH</div>
      <h2 style={{fontSize:21,lineHeight:1.25,margin:'5px 0 8px',color:'#173d30'}}>Curriculum themes</h2>
      <p style={{fontSize:13,lineHeight:1.6,color:'#50655b',margin:'0 0 14px'}}>
        The annual KICD theme index is independent of your school's term plan. Use verified curriculum outcomes to prepare scheme lessons; reference headings alone are not approved outcomes.
      </p>
    </header>
    <div role="status" style={{background:'#f4f7f5',borderRadius:9,padding:12,marginBottom:14,fontSize:12,lineHeight:1.6,color:'#345448'}}>Selected-term weekly records: <strong>{weeklyCount}</strong> · My selected-term scheme lessons: <strong>{schemeCount}</strong> · Verified outcomes in selected-term records: <strong>{verifiedOutcomeCount}</strong>. These counts are not annual KICD theme mappings.</div>
    <div aria-label={`Week ${selectedWeek} English teaching content`} style={{border:'1px solid #bdd3c5',borderRadius:12,padding:14,marginBottom:16,background:'#fafffc'}}>
      <h3 style={{fontSize:17,margin:'0 0 6px',color:'#173d30'}}>Week {selectedWeek} · Your teaching plan</h3>
      <p style={{fontSize:12,color:'#52665b',margin:'0 0 10px'}}>These are the actual selected-term weekly records and your saved scheme, not an official KICD theme-to-week allocation.</p>
      {weekRows.length===0 && weekLessons.length===0 ? <p style={{fontSize:13,color:'#53695f'}}>No English curriculum or scheme lessons are assigned to Week {selectedWeek}. The week is not automatically filled from the annual themes.</p> : <div style={{display:'grid',gap:9}}>
        {weekRows.map(row => <div key={row.id} style={{padding:11,border:'1px solid #dce6e0',borderRadius:9,background:'#fff'}}><strong style={{fontSize:14,color:'#183c30'}}>{row.topic || row.sub_strand || 'Untitled curriculum item'}</strong><div style={{fontSize:12,color:'#50665b',marginTop:4}}>{[row.strand,row.sub_strand].filter(Boolean).join(' · ')} · Curriculum record (KICD alignment not yet verified)</div></div>)}
        {weekLessons.map(lesson => <div key={lesson.id} style={{padding:11,border:'1px solid #dce6e0',borderRadius:9,background:'#fff'}}><strong style={{fontSize:14,color:'#183c30'}}>{lesson.topic || 'Untitled scheme lesson'}</strong><div style={{fontSize:12,color:'#50665b',marginTop:4}}>My scheme · {lesson.status} · {lesson.curriculum_id ? 'Curriculum record linked' : 'Teacher-created; curriculum not linked'}</div></div>)}
      </div>}
      <button type="button" onClick={onOpenScheme} style={{marginTop:12,padding:'10px 13px',borderRadius:8,border:'1px solid #bdd3c5',background:'#fff',color:'#245b44',fontWeight:700}}>Open Week {selectedWeek} in my scheme</button>
    </div>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap',marginBottom:14}}>
      <span style={{fontSize:12,fontWeight:700,color:'#345448'}}>
        {showYear ? 'Full year · 13 themes (KICD reference)' : `Suggested Term ${selectedTerm ?? '—'} · ${visibleThemes.length} themes (not a week schedule)`}
      </span>
      <button type="button" onClick={() => {setShowYear(value=>!value);setSelectedTheme(null)}} aria-pressed={showYear}
        style={{border:'1px solid #bdd3c5',borderRadius:9,padding:'9px 12px',background:showYear?'#e4f3eb':'#fff',fontSize:12,fontWeight:700,cursor:'pointer',color:'#245b44'}}>
        {showYear?'Show suggested term grouping':'Browse full-year KICD themes'}
      </button>
    </div>
    <div style={{display:'flex',gap:7,flexWrap:'wrap',marginBottom:15}}>
      {GRADE4_ENGLISH_STRANDS.map(strand=><span key={strand} style={{background:'#f1f5f2',borderRadius:7,padding:'6px 9px',fontSize:12,color:'#365547'}}>{strand}</span>)}
    </div>
    <div style={{display:'grid',gap:9}}>
      {visibleThemes.map(theme=>{
        const expanded = selectedTheme === theme.number
        const subStrands = GRADE4_ENGLISH_SUBSTRANDS[theme.number] || []
        return <article key={theme.number} style={{border:'1px solid #dce6e0',borderRadius:11,overflow:'hidden',background:expanded?'#fcfefd':'#fff'}}>
          <button type="button" aria-expanded={expanded} aria-controls={`english-theme-${theme.number}`} onClick={()=>setSelectedTheme(expanded?null:theme.number)}
            style={{width:'100%',minHeight:62,display:'flex',alignItems:'center',textAlign:'left',gap:12,padding:'12px 14px',background:'transparent',border:0,cursor:'pointer',color:'#183c30'}}>
            <span style={{fontWeight:800,fontSize:14,color:'#277557',minWidth:27}}>{String(theme.number).padStart(2,'0')}</span>
            <span style={{flex:1}}>
              <strong style={{display:'block',fontSize:14}}>{theme.name}</strong>
              <span style={{display:'block',fontSize:12,color:'#65796e',marginTop:3}}>4 sub-strands · Curriculum reference</span>
            </span>
            <span aria-hidden="true" style={{fontSize:18}}>{expanded?'−':'+'}</span>
          </button>
          {expanded && <div id={`english-theme-${theme.number}`} style={{borderTop:'1px solid #e2ece6',padding:'12px 14px'}}>
            <div style={{fontSize:12,color:'#53695f',marginBottom:8}}>Sub-strands</div>
            <ol style={{paddingLeft:21,margin:'0 0 12px',fontSize:13,color:'#233d31',lineHeight:1.65}}>
              {subStrands.map((name,i)=><li key={i} style={{padding:'4px 0'}}>{name}</li>)}
            </ol>
            <div style={{background:'#f4f7f5',borderRadius:8,padding:10,fontSize:12,lineHeight:1.55,color:'#576b61'}}>
              Theme-specific learning outcomes: not yet reconciled with canonical records.
              <br/>Published lesson materials: none linked to this reference theme.
            </div>
            <div style={{fontSize:11,color:'#698075',marginTop:9}}>Source reference: page {theme.sourcePage} · Mapping awaiting verification</div>
          </div>}
        </article>
      })}
    </div>
    <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',marginTop:16}}>
      <button type="button" onClick={onToggleExisting} aria-expanded={showExisting} style={{padding:'11px 13px',border:'1px solid #b7d0c0',borderRadius:9,background:'#f2f7f4',color:'#22523e',fontSize:13,fontWeight:700,cursor:'pointer'}}>
        {showExisting?'Hide existing weekly curriculum':'View existing weekly curriculum'}
      </button>
      <button type="button" onClick={onOpenScheme} style={{padding:'11px 13px',border:'1px solid #cddad1',borderRadius:9,background:'#fff',color:'#22523e',fontSize:13,fontWeight:700,cursor:'pointer'}}>
        Open my scheme of work
      </button>
    </div>
    <p style={{margin:'13px 0 0',fontSize:12,lineHeight:1.5,color:'#657a6e'}}>
      The KICD theme reference and existing weekly curriculum are not yet reconciled. Only canonical curriculum records may be used for scheme planning.
      {' '}<a href={GRADE4_ENGLISH_SOURCE} target="_blank" rel="noopener noreferrer" style={{color:'#216549',textDecoration:'underline'}}>Curriculum source</a>
    </p>
  </section>
}

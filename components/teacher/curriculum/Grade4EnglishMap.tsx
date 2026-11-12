'use client'

import { useEffect, useMemo, useState } from 'react'
import { GRADE4_ENGLISH_UNITS } from '@/lib/teaching/grade4EnglishCatalog.mjs'
import { GRADE4_ENGLISH_SPELLING_PACKAGE } from '@/lib/teaching/grade4EnglishSpellingPackage.mjs'
import {
  GRADE4_ENGLISH_SOURCE,
  GRADE4_ENGLISH_STRANDS,
  GRADE4_ENGLISH_SUBSTRANDS,
  GRADE4_ENGLISH_THEMES,
} from '@/lib/curriculum/grade4EnglishReference'

type Props = {
  selectedTerm: number | null
  showExisting: boolean
  onToggleExisting: () => void
  onOpenScheme: () => void
  weeklyCount: number
  schemeCount: number
  verifiedOutcomeCount: number
  selectedUnitId?: string
  onSelectUnit?: (unitId: string) => void
  onPlanUnit?: (unitId: string) => void
  mappedUnits?: Record<string,{id: string,outcomes: {id: string,outcome_text: string,outcome_code?: string}[]}>
  catalogLoading?: boolean
  catalogError?: string
}

const sourceLinkStyle = {
  color: '#175b43',
  fontWeight: 700,
  textDecoration: 'underline' as const,
  textUnderlineOffset: 3,
}

/**
 * Mobile-first, read-only annual curriculum document index.
 *
 * The heading references are already maintained in grade4EnglishReference.
 * KICD's full protected text is NOT copied into this component, nor may
 * headings be promoted to verified learning outcomes. The school calendar
 * and local weekly curriculum are separate from the official annual index.
 */
export default function Grade4EnglishMap({
  showExisting,
  onToggleExisting,
  onOpenScheme,
  weeklyCount,
  schemeCount,
  verifiedOutcomeCount,
  selectedUnitId,
  onSelectUnit,
  onPlanUnit,
  mappedUnits={},
  catalogLoading=false,
  catalogError='',
}: Props) {
  const [selectedTheme, setSelectedTheme] = useState<number>(1)
  useEffect(() => {
    const selected = GRADE4_ENGLISH_UNITS.find(unit => unit.id === selectedUnitId)
    if (selected) setSelectedTheme(selected.theme)
  }, [selectedUnitId])
  const [search, setSearch] = useState('')
  const [showIndex, setShowIndex] = useState(false)
  const theme = GRADE4_ENGLISH_THEMES.find(item => item.number === selectedTheme) ?? GRADE4_ENGLISH_THEMES[0]
  const sections = GRADE4_ENGLISH_SUBSTRANDS[theme.number] ?? []
  const mappedSkills = GRADE4_ENGLISH_UNITS.filter(unit=>unit.theme===theme.number)
  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return GRADE4_ENGLISH_THEMES
    return GRADE4_ENGLISH_THEMES.filter(item =>
      item.name.toLowerCase().includes(needle) ||
      String(item.number) === needle ||
      (GRADE4_ENGLISH_SUBSTRANDS[item.number] ?? []).some(section => section.toLowerCase().includes(needle))
    )
  }, [search])

  return <section aria-label="Grade 4 English native curriculum reader" style={{
    background:'#fff',border:'1px solid #dce6e0',borderRadius:17,padding:'clamp(14px,3vw,24px)',marginBottom:18,
    color:'#193a2e',maxWidth:'100%',overflowWrap:'anywhere',
  }}>
    <header>
      <div style={{fontSize:11,fontWeight:800,color:'#28654d',letterSpacing:'.08em'}}>CURRICULUM LIBRARY · GRADE 4 ENGLISH</div>
      <h2 style={{fontSize:'clamp(21px,3vw,28px)',margin:'7px 0 6px',lineHeight:1.2}}>Read the curriculum</h2>
      <p style={{fontSize:13,lineHeight:1.6,color:'#526b5f',margin:'0 0 12px'}}>
        KICD Grade 4 English, revised 2024 · 13 themes · 4 strands. Read this annual reference without selecting a teaching week.
      </p>
      <div style={{background:'#f1f7f3',border:'1px solid #d9e8df',padding:12,borderRadius:11,display:'flex',flexWrap:'wrap',gap:10,alignItems:'center',justifyContent:'space-between'}}>
        <span style={{fontSize:12,lineHeight:1.6,color:'#36584a'}}>
          <strong>Source:</strong> Kenya Institute of Curriculum Development · Revised 2024
        </span>
        <a href={GRADE4_ENGLISH_SOURCE} target="_blank" rel="noopener noreferrer" style={sourceLinkStyle}>
          Original KICD document ↗
        </a>
      </div>
    </header>

    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap',margin:'20px 0 12px'}}>
      <h3 style={{fontSize:17,margin:0}}>Theme {theme.number}: {theme.name}</h3>
      <button type="button" onClick={() => setShowIndex(value => !value)} aria-expanded={showIndex} aria-controls="g4-english-theme-index" style={{
        minHeight:44,border:'1px solid #9bbbac',background:'#fff',color:'#175b43',borderRadius:10,
        padding:'10px 13px',fontSize:13,fontWeight:750,cursor:'pointer',
      }}>{showIndex ? 'Close theme index' : 'Choose another theme'}</button>
    </div>

    {showIndex && <div id="g4-english-theme-index" style={{border:'1px solid #e2eae5',borderRadius:12,padding:12,marginBottom:15}}>
      <label htmlFor="grade4-english-theme-search" style={{display:'block',fontWeight:700,fontSize:12,marginBottom:6}}>Find a theme or topic</label>
      <input id="grade4-english-theme-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search all 13 themes" style={{
        width:'100%',boxSizing:'border-box',minHeight:44,padding:'10px 12px',border:'1px solid #a8c0b2',borderRadius:8,fontSize:15,
      }}/>
      <nav aria-label="Grade 4 English theme list" style={{display:'grid',gap:5,marginTop:10,maxHeight:320,overflowY:'auto'}}>
        {matches.map(item => <button key={item.number} type="button" aria-current={item.number===selectedTheme?'true':undefined} onClick={() => {
          setSelectedTheme(item.number)
          onSelectUnit?.(GRADE4_ENGLISH_UNITS.find(unit=>unit.theme===item.number)?.id ?? '01-LS')
          setShowIndex(false)
          setSearch('')
        }} style={{
          display:'flex',alignItems:'center',gap:12,minHeight:44,padding:'9px 11px',cursor:'pointer',textAlign:'left',
          background:item.number===selectedTheme?'#e6f3eb':'#fff',color:'#1d4937',border:'1px solid #dbe7df',borderRadius:9,
        }}>
          <strong style={{minWidth:24,color:'#28654d'}}>{String(item.number).padStart(2,'0')}</strong>
          <span style={{flex:1,fontSize:13,fontWeight:700}}>{item.name}</span>
          <span aria-hidden="true">›</span>
        </button>)}
        {!matches.length && <p style={{fontSize:13,color:'#5d7367'}}>No matching themes.</p>}
      </nav>
    </div>}

    <article aria-label={'Curriculum theme '+theme.number} style={{border:'1px solid #dde9e1',borderRadius:12,overflow:'hidden'}}>
      <div style={{background:'#f7faf8',padding:'13px 16px',borderBottom:'1px solid #dde9e1'}}>
        <div style={{fontSize:11,color:'#587164',fontWeight:700}}>THEME {String(theme.number).padStart(2,'0')} · KICD SOURCE PAGE {theme.sourcePage}</div>
        <h4 style={{fontSize:18,margin:'5px 0 0'}}>{theme.name}</h4>
      </div>
      <div style={{padding:'14px 16px'}}>
        <p style={{fontSize:12,color:'#4d6659',margin:'0 0 14px',lineHeight:1.6}}>
          Explore each language skill in its theme order. The original KICD document remains the curriculum authority;
          independently written VibeSchool learning guidance appears below when its canonical records are connected.
        </p>
        <div style={{display:'grid',gap:11}}>
          {sections.map((heading,index) => {const unit=mappedSkills[index];const linked=unit ? mappedUnits[unit.id] : undefined;return <section key={heading} aria-label={GRADE4_ENGLISH_STRANDS[index]} style={{
            border:'1px solid #e0e9e2',borderRadius:10,padding:13,background:'#fff',
          }}>
            <div style={{color:'#306d53',fontSize:11,fontWeight:800,marginBottom:5}}>
              {index+1}. {GRADE4_ENGLISH_STRANDS[index]}
            </div>
            <h5 style={{fontSize:15,lineHeight:1.4,margin:'0 0 8px'}}>{heading}</h5>
            <p style={{fontSize:12,color:'#677a6f',margin:0,lineHeight:1.6}}>
              Official outcomes and learning experiences: awaiting source verification.
            </p>
            {catalogLoading && <p role="status" style={{fontSize:12}}>Connecting saved VibeSchool curriculum outcomes…</p>}
            {catalogError && <p role="alert" style={{fontSize:12,color:'#a11b36'}}>{catalogError}</p>}
            {linked?.outcomes?.length ? <div style={{borderTop:'1px solid #e1ebe4',marginTop:10,paddingTop:10}}>
              <p style={{fontSize:12,fontWeight:800,color:'#175b43'}}>VibeSchool learning guidance · {unit.lessons} proposed lessons</p>
              {unit.id==='11-WR' && <p role="note" style={{fontSize:12,lineHeight:1.6,color:'#83531b',background:'#fff8e8',padding:9,borderRadius:8}}>
                KICD 2024, Writing 11.4.1, printed page 74, recommends 2 lessons for spelling commonly misspelt words.
                This VibeSchool annual planner proposes 1 additional optional practice lesson; the third lesson is not a KICD requirement.
                Choose the exact dated Scheme lesson before attaching a teaching plan.
              </p>}
              <ul style={{fontSize:13,lineHeight:1.65,paddingLeft:19}}>{linked.outcomes.map(outcome=><li key={outcome.id}>{outcome.outcome_text}</li>)}</ul>
              <p style={{fontSize:12,lineHeight:1.6}}><strong>Teaching activity:</strong> {unit.experiences[0]}</p>
              <p style={{fontSize:12,lineHeight:1.6}}><strong>Assessment:</strong> {unit.assessment}</p>
              {unit.id==='11-WR' && <details style={{margin:'11px 0',border:'1px solid #cbded1',borderRadius:10,padding:'10px 12px',background:'#f9fbfa'}}>
                <summary style={{fontSize:13,fontWeight:800,cursor:'pointer',color:'#175b43'}}>
                  Preview VibeSchool-original spelling lesson · 30 minutes
                </summary>
                <p role="note" style={{fontSize:12,lineHeight:1.65,color:'#6b521d'}}>
                  This is original teacher preparation, not a saved or certified scheduled lesson.
                  The KICD spelling sub-strand has 2 suggested lessons; this preview is one possible 30-minute lesson.
                  {GRADE4_ENGLISH_SPELLING_PACKAGE.outcomeCodes.every(code=>linked.outcomes.some(o=>o.outcome_code===code))
                    ? ' Its three draft VibeSchool outcome identities are present in the Curriculum Map; actual Scheme and dated-plan links must still be checked.'
                    : ' Current canonical outcomes do not yet match this spelling package. Review the proposed content only; do not mark curriculum reconciliation complete.'}
                </p>
                <div style={{display:'grid',gap:10,fontSize:13,lineHeight:1.6}}>
                  <div>
                    <strong>What learners should demonstrate</strong>
                    <ul style={{paddingLeft:19,margin:'5px 0'}}>{GRADE4_ENGLISH_SPELLING_PACKAGE.objectives.map(objective=><li key={objective}>{objective}</li>)}</ul>
                  </div>
                  <div><strong>Teacher materials</strong><p style={{margin:'5px 0'}}>{GRADE4_ENGLISH_SPELLING_PACKAGE.resources}</p></div>
                  <div>
                    <strong>30-minute teaching sequence</strong>
                    <ol style={{paddingLeft:19,margin:'5px 0'}}>{GRADE4_ENGLISH_SPELLING_PACKAGE.lessonSteps.map(step=><li key={step.title} style={{marginBottom:7}}>
                      <strong>{step.title} · {step.minutes} min</strong>
                      <p style={{margin:'3px 0'}}>{step.directions}</p>
                    </li>)}</ol>
                  </div>
                  {([
                    ['Teacher guide',GRADE4_ENGLISH_SPELLING_PACKAGE.teacherGuide],
                    ['Learner notes',GRADE4_ENGLISH_SPELLING_PACKAGE.learnerNotes],
                    ['Guided oral practice',GRADE4_ENGLISH_SPELLING_PACKAGE.guidedPractice],
                    ['Independent exercise-book practice',GRADE4_ENGLISH_SPELLING_PACKAGE.independentPractice],
                    ['Marking guide and answers',GRADE4_ENGLISH_SPELLING_PACKAGE.answerKey],
                    ['Feedback for mistakes',GRADE4_ENGLISH_SPELLING_PACKAGE.errorFeedback],
                    ['Support and extension',GRADE4_ENGLISH_SPELLING_PACKAGE.differentiation],
                    ['Revision and fresh check',GRADE4_ENGLISH_SPELLING_PACKAGE.revision],
                  ] as const).map(([heading,content])=><div key={heading}>
                    <strong>{heading}</strong>
                    <ul style={{paddingLeft:19,margin:'5px 0'}}>{content.map((item:string)=><li key={item} style={{marginBottom:5}}>{item}</li>)}</ul>
                  </div>)}
                  <p><strong>Individual understanding evidence:</strong> {GRADE4_ENGLISH_SPELLING_PACKAGE.assessment.evidence}</p>
                  <p><strong>Exit check:</strong> {GRADE4_ENGLISH_SPELLING_PACKAGE.assessment.exitMax} marks. {GRADE4_ENGLISH_SPELLING_PACKAGE.assessment.criterion}</p>
                </div>
              </details>}

              {onPlanUnit && !catalogError && <button type="button" onClick={()=>onPlanUnit(unit.id)} style={{minHeight:44,border:0,borderRadius:9,padding:'10px 13px',background:'#175b43',color:'#fff',fontWeight:800,cursor:'pointer'}}>Plan in Scheme of Work</button>}
            </div> : <p style={{fontSize:12,color:'#68796f',marginTop:7}}>VibeSchool teaching outcomes are not yet linked for this skill.</p>}
          </section>})}
        </div>
        <div role="note" style={{fontSize:12,color:'#4c6658',background:'#f3f7f4',padding:11,borderRadius:8,marginTop:14,lineHeight:1.6}}>
          This is a KICD-referenced theme index with VibeSchool-authored teaching outcomes, not the full official curriculum text.
          Read the <a href={GRADE4_ENGLISH_SOURCE} target="_blank" rel="noopener noreferrer" style={sourceLinkStyle}>original KICD document</a> for the complete requirements.
          Full in-app republication needs appropriate permission.
        </div>
      </div>
    </article>

    <div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:8,marginTop:13}}>
      <button type="button" disabled={theme.number===1} onClick={() => setSelectedTheme(theme.number-1)} style={{
        padding:'10px 13px',minHeight:44,borderRadius:9,border:'1px solid #c4d5cb',background:'#fff',color:'#214a39',fontWeight:700,opacity: theme.number === 1 ? 0.45 : 1,
      }}>← Previous theme</button>
      <button type="button" disabled={theme.number===GRADE4_ENGLISH_THEMES.length} onClick={() => setSelectedTheme(theme.number+1)} style={{
        padding:'10px 13px',minHeight:44,borderRadius:9,border:'1px solid #c4d5cb',background:'#e9f5ed',color:'#214a39',fontWeight:700,
        opacity: theme.number === GRADE4_ENGLISH_THEMES.length ? 0.45 : 1,
      }}>Next theme →</button>
    </div>

    <div style={{marginTop:22,paddingTop:15,borderTop:'1px solid #e2ece5'}}>
      <h3 style={{fontSize:16,margin:'0 0 8px'}}>My teaching plan</h3>
      <p style={{fontSize:12,lineHeight:1.6,color:'#526b5f',margin:'0 0 11px'}}>
        {weeklyCount} stored weekly curriculum records · {schemeCount} saved scheme lessons · {verifiedOutcomeCount} linked verified outcomes.
        The existing weekly records are not mapped to this official annual theme index.
      </p>
      <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
        <button type="button" onClick={onOpenScheme} style={{
          padding:'11px 14px',minHeight:44,border:0,borderRadius:10,background:'#175b43',color:'#fff',fontSize:13,fontWeight:750,cursor:'pointer',
        }}>Open Scheme of Work</button>
        <button type="button" onClick={onToggleExisting} aria-expanded={showExisting} style={{
          padding:'11px 14px',minHeight:44,border:'1px solid #a6c1b1',borderRadius:10,background:'#fff',color:'#175b43',fontSize:13,fontWeight:750,cursor:'pointer',
        }}>{showExisting?'Hide stored weekly plan':'View stored weekly plan'}</button>
      </div>
    </div>
  </section>
}

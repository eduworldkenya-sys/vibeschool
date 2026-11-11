'use client'

import { termCreativeSchemeRows } from '@/lib/teaching/creativeSchemeDraft.mjs'

const surface = {border:'1px solid #d4e4d9',borderRadius:14,background:'#f8fbf9',padding:14,marginBottom:14}
const button = {border:'1px solid #c8dbd0',borderRadius:9,background:'#fff',color:'#175b43',minHeight:40,padding:'8px 12px',fontWeight:700,cursor:'pointer'}

export default function AutoCreativeScheme({draft,termId,week,savedLessons,catalog,onWeekChange,onSaveAndPrepare,onViewUnit,savingKey,loading,error,learningArea='Creative Activities'}) {
  const termRows = termCreativeSchemeRows(draft,termId)
  if (!termId) return null
  if (error || draft?.error) return <section aria-label="Curriculum scheme connection" style={surface}>
    <strong>Curriculum-linked scheme</strong>
    <p role="alert" style={{fontSize:13,color:'#9f1239'}}>{error || draft.error}</p>
    <p style={{fontSize:12}}>Saved lessons are unchanged. The calendar must be reconciled before VibeSchool suggests a weekly sequence.</p>
  </section>
  if (loading || !draft?.items) return <section aria-label="Curriculum scheme connection" style={surface}><p role="status">Connecting curriculum to the school calendar…</p></section>

  const weekRows = termRows.filter(item=>item.week===week)
  const termWeeks = draft.weeks.filter(item=>item.termId===termId)
  const savedCount = savedLessons.length
  const used = new Map()
  for (const saved of savedLessons) {
    if (saved.week !== week || !saved.sub_strand_id || !saved.curriculum_outcome_id) continue
    const id = saved.sub_strand_id + ':' + saved.curriculum_outcome_id
    used.set(id,(used.get(id)||0)+1)
  }
  const marked = weekRows.map(row=>{
    const record = catalog?.[row.unitId]
    const outcomes=(row.outcomeIndexes||[row.outcomeIndex]).map(index=>record?.outcomes?.[index]).filter(Boolean)
    const outcomeIds=outcomes.map(outcome=>outcome.id)
    const id=record?.id&&outcomeIds.length?record.id+':'+outcomeIds[0]:null
    const alreadySaved=!!id&&(used.get(id)||0)>0
    if(alreadySaved)used.set(id,used.get(id)-1)
    return {...row,outcomeId:outcomeIds[0],outcomeIds,subStrandId:record?.id,alreadySaved}
  })
  const topics = items => [...new Set(items.map(item=>item.title))].join(' · ')
  return <section aria-label={`Automatically linked Grade 1 ${learningArea} scheme`} style={surface}>
    <div style={{fontSize:11,fontWeight:800,color:'#175b43',letterSpacing:'.04em'}}>CURRICULUM → SCHEME OF WORK</div>
    <h2 style={{fontSize:18,color:'#173f32',margin:'5px 0'}}>Your {learningArea} curriculum-linked scheme</h2>
    <p style={{fontSize:13,color:'#425e50',margin:'0 0 10px'}}>
      All {draft.unitCount} sub-strands · {draft.totalLessons} suggested annual lessons · {draft.weeks.length} instructional weeks.
      This term: {termRows.length} suggested lessons · {savedCount} saved.
    </p>
    <p style={{fontSize:12,color:'#526e60',margin:'0 0 12px'}}>
      This sequence appears automatically from the VibeSchool {learningArea} curriculum and your school calendar.
      {draft.pacingSource==='provisional-calendar-only'?' Weekly subject allocation is not yet configured; pacing is provisional.':' Scheduled against the configured weekly allocation.'}
      {' '}It is VibeSchool-authored guidance, not a certified KICD timetable. Saved teacher lessons are never changed.
    </p>
    <div style={{display:'grid',gap:6,marginBottom:15}}>
      {termWeeks.map(entry=>{
        const rows=termRows.filter(row=>row.week===entry.week)
        const saved=savedLessons.filter(item=>item.week===entry.week).length
        return <button type="button" key={entry.week} onClick={()=>onWeekChange(entry.week)}
          aria-pressed={week===entry.week}
          style={{...button,textAlign:'left',width:'100%',background:week===entry.week?'#e5f3e9':'#fff',borderColor:week===entry.week?'#317b57':'#dce8de'}}>
          <span style={{display:'block',fontSize:13,fontWeight:800}}>Week {entry.week} · {rows.length} suggested · {saved} saved</span>
          <span style={{display:'block',fontSize:12,fontWeight:500,marginTop:2,color:'#465e50'}}>{topics(rows)||'No suggested curriculum lesson'}</span>
        </button>
      })}
    </div>
    <h3 style={{fontSize:15,margin:'0 0 9px'}}>Week {week} — linked lesson drafts</h3>
    {marked.length===0?<p style={{fontSize:13}}>No suggestions for this week.</p>:
      <div style={{display:'grid',gap:8}}>
        {marked.map((item,index)=><div key={item.key} style={{background:'#fff',border:'1px solid #dce8de',borderRadius:10,padding:'10px 12px'}}>
          <div style={{fontSize:12,fontWeight:800,color:'#183e2b'}}>Draft lesson {index+1}: {item.title}</div>
          <ul style={{fontSize:12,lineHeight:1.5,color:'#476050',margin:'5px 0 8px',paddingLeft:20}}>
            {(item.outcomes||[item.outcome]).map((outcome,i)=><li key={i}>{outcome}</li>)}
          </ul>
          <div style={{display:'flex',flexWrap:'wrap',gap:7,alignItems:'center'}}>
            {item.alreadySaved?<span style={{fontSize:12,color:'#176442',fontWeight:700}}>Saved in this week</span>:
              <button type="button" style={{...button,background:'#175b43',color:'#fff'}}
                disabled={!item.subStrandId||item.outcomeIds?.length!==(item.outcomeIndexes||[item.outcomeIndex]).length||!!savingKey}
                onClick={()=>onSaveAndPrepare(item)}>
                {savingKey===item.key?'Saving…':'Save & prepare lesson'}
              </button>}
            <button type="button" style={button} onClick={()=>onViewUnit(item.unitId)}>View curriculum</button>
          </div>
        </div>)}
      </div>}
    <p style={{fontSize:11,color:'#587365',margin:'12px 0 0'}}>Draft suggestions are visible without creating teaching records. Save a lesson when you prepare it; completed and teacher-edited lessons retain their original records.</p>
  </section>
}

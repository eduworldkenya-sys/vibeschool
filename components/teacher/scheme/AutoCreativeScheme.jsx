'use client'

import { termCreativeSchemeRows } from '@/lib/teaching/creativeSchemeDraft.mjs'

const surface = {border:'1px solid #d4e4d9',borderRadius:14,background:'#f8fbf9',padding:14,marginBottom:14}
const button = {border:'1px solid #c8dbd0',borderRadius:9,background:'#fff',color:'#175b43',minHeight:40,padding:'8px 12px',fontWeight:700,cursor:'pointer'}

export default function AutoCreativeScheme({draft,termId,week,savedLessons,catalog,onWeekChange,onSaveAndPrepare,onViewUnit,savingKey,loading,error,subjectName='Creative Activities'}) {
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
  const savedCount = savedLessons.filter(item=>item.status!=='cancelled').length
  const weeklyTarget = draft.weeklyAllocation
  const activeThisWeek = savedLessons.filter(item=>item.week===week && item.status!=='cancelled').length
  const capacityFull = weeklyTarget!==null && activeThisWeek>=weeklyTarget
  const surplusPeriods = draft.annualCapacity === null ? null : Math.max(0,draft.annualCapacity-draft.totalLessons)
  const used = new Map()
  for (const saved of savedLessons) {
    if (saved.week !== week || saved.status==='cancelled' || !saved.sub_strand_id || !saved.curriculum_outcome_id) continue
    const id = saved.sub_strand_id + ':' + saved.curriculum_outcome_id
    used.set(id,(used.get(id)||0)+1)
  }
  const marked = weekRows.map(row=>{
    const record = catalog?.[row.unitId]
    const outcome = record?.outcomes?.[row.outcomeIndex]
    const id = record?.id&&outcome?.id ? record.id+':'+outcome.id : null
    const alreadySaved = !!id && (used.get(id)||0)>0
    if(alreadySaved)used.set(id,used.get(id)-1)
    return {...row,outcomeId:outcome?.id,subStrandId:record?.id,alreadySaved}
  })
  const topics = items => [...new Set(items.map(item=>item.themeTitle?`${item.themeTitle}: ${item.title}`:item.title))].join(' · ')
  return <section aria-label={`Automatically linked Grade 1 ${subjectName} scheme`} style={surface}>
    <div style={{fontSize:11,fontWeight:800,color:'#175b43',letterSpacing:'.04em'}}>CURRICULUM → SCHEME OF WORK</div>
    <h2 style={{fontSize:18,color:'#173f32',margin:'5px 0'}}>Your curriculum-linked scheme</h2>
    <p style={{fontSize:13,color:'#425e50',margin:'0 0 10px'}}>
      {subjectName}: {draft.unitCount} sub-strands · {draft.totalLessons} suggested annual lessons · {draft.weeks.length} instructional weeks.
      This term: {termRows.length} suggested lessons · {savedCount} saved.
    </p>
    <p style={{fontSize:12,color:'#526e60',margin:'0 0 12px'}}>
      This sequence appears automatically from the VibeSchool curriculum and your school calendar.
      {draft.pacingSource==='provisional-calendar-only'?' Weekly subject allocation is not yet configured; pacing is provisional.':` The school allocation is ${weeklyTarget} lessons per instructional week.`}
      {' '}It is VibeSchool-authored guidance, not a certified KICD timetable. Saved teacher lessons are never changed.
    </p>
    {weeklyTarget!==null&&<p style={{fontSize:12,color:'#425e50',margin:'0 0 12px'}}>
      <strong>Annual capacity:</strong> {draft.annualCapacity} school periods. {surplusPeriods===0?'All allocated periods are covered by suggested curriculum lessons.':`${surplusPeriods} periods are not assigned to this curriculum draft; the teacher may use them for revision, assessment or other school-approved work.`}
    </p>}
    <div style={{display:'grid',gap:6,marginBottom:15}}>
      {termWeeks.map(entry=>{
        const rows=termRows.filter(row=>row.week===entry.week)
        const saved=savedLessons.filter(item=>item.week===entry.week && item.status!=='cancelled').length
        return <button type="button" key={entry.week} onClick={()=>onWeekChange(entry.week)}
          aria-pressed={week===entry.week}
          style={{...button,textAlign:'left',width:'100%',background:week===entry.week?'#e5f3e9':'#fff',borderColor:week===entry.week?'#317b57':'#dce8de'}}>
          <span style={{display:'block',fontSize:13,fontWeight:800}}>Week {entry.week} · {rows.length} suggested · {saved}{weeklyTarget!==null?` of ${weeklyTarget}`:''} saved</span>
          <span style={{display:'block',fontSize:12,fontWeight:500,marginTop:2,color:'#465e50'}}>{topics(rows)||'No suggested curriculum lesson'}</span>
        </button>
      })}
    </div>
    <h3 style={{fontSize:15,margin:'0 0 9px'}}>Week {week} — linked lesson drafts</h3>
    <p style={{fontSize:12,color:'#486454',margin:'0 0 9px'}}>{weeklyTarget===null?'Weekly period allocation not configured':`${activeThisWeek} of ${weeklyTarget} weekly periods occupied · ${Math.max(0,weeklyTarget-activeThisWeek)} available`}</p>
    {capacityFull&&<p role="alert" style={{fontSize:12,color:'#8e3e18',fontWeight:700}}>The week already has its allocated lessons. Change week or adjust the existing scheme before saving another.</p>}
    {marked.length===0?<p style={{fontSize:13}}>No suggestions for this week.</p>:
      <div style={{display:'grid',gap:8}}>
        {marked.map((item,index)=><div key={item.key} style={{background:'#fff',border:'1px solid #dce8de',borderRadius:10,padding:'10px 12px'}}>
          <div style={{fontSize:12,fontWeight:800,color:'#183e2b'}}>Draft lesson {index+1}: {item.title}</div>
          {item.themeTitle && <p style={{fontSize:12,fontWeight:700,color:'#276647',margin:'4px 0'}}>Theme {item.themeId}: {item.themeTitle}</p>}
          <p style={{fontSize:12,lineHeight:1.5,color:'#476050',margin:'5px 0 8px'}}>{item.outcome}</p>
          <div style={{display:'flex',flexWrap:'wrap',gap:7,alignItems:'center'}}>
            {item.alreadySaved?<span style={{fontSize:12,color:'#176442',fontWeight:700}}>Saved in this week</span>:
              <button type="button" style={{...button,background:'#175b43',color:'#fff'}}
                disabled={!item.subStrandId||!item.outcomeId||!!savingKey||capacityFull}
                onClick={()=>onSaveAndPrepare(item)}>
                {savingKey===item.key?'Saving…':'Save & prepare lesson'}
              </button>}
            <button type="button" style={button} onClick={()=>onViewUnit(item.unitId,item.themeId)}>View curriculum</button>
          </div>
        </div>)}
      </div>}
    <p style={{fontSize:11,color:'#587365',margin:'12px 0 0'}}>Draft suggestions are visible without creating teaching records. Save a lesson when you prepare it; completed and teacher-edited lessons retain their original records.</p>
  </section>
}

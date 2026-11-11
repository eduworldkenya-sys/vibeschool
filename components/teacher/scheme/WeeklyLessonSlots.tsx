'use client'

type Lesson = { id:string; topic:string|null; status:string; curriculum_id:string|null; sub_strand_id?:string|null; curriculum_outcome_id?:string|null }
type CurriculumTopic = { id:string; week:number|null; topic:string|null; strand:string|null; sub_strand:string|null }
type Props = {
  week:number
  allocation:number|null
  lessons:readonly Lesson[]
  label:string
  curriculumTopics?:readonly CurriculumTopic[]
  compact?:boolean
  previewCount?:number
}

/** Display actual saved lessons only; unused allocation slots are never synthetic lessons. */
export default function WeeklyLessonSlots({week,allocation,lessons,label,curriculumTopics=[],compact=false,previewCount=0}:Props) {
  const target=allocation!==null&&Number.isInteger(allocation)&&allocation>0?allocation:null
  // Cancelled lessons remain in history but no longer occupy an active
  // weekly teaching period; keep the visual capacity consistent with
  // the canonical mapped-Scheme save guard.
  const activeLessons=lessons.filter(item=>item.status!=='cancelled')
  const cancelledLessons=lessons.filter(item=>item.status==='cancelled')
  const count=target===null?activeLessons.length:Math.max(target,activeLessons.length)
  const topics=curriculumTopics.filter(row=>row.week===week)
  const finished=activeLessons.filter(item=>item.status==='done').length
  return <section aria-label={`Week ${week} lesson allocation`} className="studio-weekly-overview">
    <div className="studio-weekly-heading">
      <div>
        <h2>Week {week} · {label}</h2>
        <p>{target===null?`${activeLessons.length} active lessons · weekly allocation unavailable`:`${activeLessons.length} of ${target} lessons allocated · ${Math.max(0,target-activeLessons.length)} unplanned`}{previewCount>0?` · ${previewCount} curriculum-linked draft suggestions below`:''}</p>
      </div>
      <span className="studio-weekly-progress">{finished} taught</span>
    </div>
    {count===0?<p className="studio-weekly-empty">{previewCount>0?'No saved lessons yet. The curriculum-linked draft is shown below.':'No lessons planned for this week.'}</p>:
      <div className={compact?'studio-weekly-slots studio-weekly-slots--compact':'studio-weekly-slots'}>
        {Array.from({length:count},(_,i)=>{
          const item=activeLessons[i]
          return <div key={item?.id||`unplanned-${i}`} className="studio-weekly-slot" data-state={item?.status||'empty'}>
            <span className="studio-weekly-slot-number">Lesson {i+1}</span>
            {item?<div className="studio-weekly-slot-copy">
              {!compact&&<strong>{item.topic||'Untitled lesson'}</strong>}
              <span>{item.status==='done'?'Taught':item.status==='teaching'?'In progress':item.status==='cancelled'?'Cancelled':'Planned'}{!compact&&` · ${(item.curriculum_id||item.sub_strand_id||item.curriculum_outcome_id)?'Curriculum record linked; KICD alignment unverified':'Teacher-created; no curriculum link'}`}</span>
            </div>:<span className="studio-weekly-slot-missing">Not planned yet</span>}
          </div>
        })}
      </div>}
    {!compact&&topics.length>0&&<div className="studio-weekly-topics">
      <strong>Stored weekly curriculum reference</strong>
      {topics.map(row=><p key={row.id}>{row.topic||row.sub_strand||'Untitled topic'} <span>· {[row.strand,row.sub_strand].filter(Boolean).join(' / ')}</span></p>)}
      <small>These weekly records are not yet reconciled to verified KICD 2024 outcomes.</small>
    </div>}
    {cancelledLessons.length>0&&<details className="studio-weekly-cancelled" style={{marginTop:9}}>
      <summary style={{cursor:'pointer',fontSize:12}}>{cancelledLessons.length} cancelled lesson{cancelledLessons.length===1?'':'s'} (history; periods available for replanning)</summary>
      {cancelledLessons.map(item=><p key={item.id} style={{fontSize:12,margin:'5px 0'}}>{item.topic||'Untitled lesson'} · Cancelled</p>)}
    </details>}
    {target!==null&&activeLessons.length>target&&<p role="alert" className="studio-weekly-overallocated">Your scheme exceeds the weekly allocation by {activeLessons.length-target} active lesson(s). No lessons were moved automatically.</p>}
  </section>
}

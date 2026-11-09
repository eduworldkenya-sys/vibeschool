'use client'
type Lesson = { id:string; topic:string|null; status:string; curriculum_id:string|null }
type Props = { week:number; allocation:number|null; lessons:readonly Lesson[]; label:string }
/** Reuses the existing subject allocation. Blank slots are not fabricated curriculum lessons. */
export default function WeeklyLessonSlots({week,allocation,lessons,label}:Props) {
  const target=allocation!==null&&Number.isInteger(allocation)&&allocation>0?allocation:null
  const count=target===null?lessons.length:Math.max(target,lessons.length)
  return <section aria-label={`Week ${week} lesson allocation`} style={{background:'#fff',border:'1px solid #dce6e0',borderRadius:13,padding:14,margin:'0 0 12px'}}>
    <h2 style={{fontSize:16,margin:'0 0 5px',color:'#173d30'}}>Week {week} · {label}</h2>
    <p style={{fontSize:12,color:'#53695f',margin:'0 0 11px'}}>{target===null?`${lessons.length} scheme lessons · allocation unavailable`:`${lessons.length} of ${target} lessons planned · ${Math.max(0,target-lessons.length)} unplanned`}. Your actual term plan, not an official KICD week-by-week sequence.</p>
    {count===0?<p style={{fontSize:13,color:'#53695f'}}>No lessons planned for this week.</p>:<div style={{display:'grid',gap:7}}>
      {Array.from({length:count},(_,i)=>{const item=lessons[i];return <div key={item?.id||`unplanned-${i}`} style={{display:'flex',gap:12,alignItems:'flex-start',border:'1px solid #e0e9e3',borderRadius:9,padding:11,background:item?'#fff':'#f8faf9'}}>
        <strong style={{fontSize:12,color:'#245b44',minWidth:58}}>Lesson {i+1}</strong>
        <div style={{fontSize:13,color:'#264236'}}>{item?<><strong>{item.topic||'Untitled lesson'}</strong><div style={{fontSize:11,color:'#65796e',marginTop:3}}>{item.status} · {item.curriculum_id?'Linked curriculum record':'Teacher-created / not linked'}</div></>:<span style={{color:'#697d71'}}>Not planned yet</span>}</div>
      </div>})}
    </div>}
    {target!==null&&lessons.length>target&&<p role="alert" style={{fontSize:12,color:'#9a3412'}}>Your scheme exceeds this weekly allocation by {lessons.length-target} lesson(s). No lessons were moved automatically.</p>}
  </section>
}

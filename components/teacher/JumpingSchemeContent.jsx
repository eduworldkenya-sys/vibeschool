'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const frame = { border: '1px solid #cbd5e1', borderRadius: 12, padding: 13, background: '#fff', marginTop: 12 }
const button = { border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', padding: '9px 12px', fontSize: 12, cursor: 'pointer', color:'#172d26' }
const asRecord = value => value && typeof value==='object' && !Array.isArray(value) ? value : {}
const str = value => typeof value==='string' ? value.trim() : ''

function Plain({ title, value }) {
  const content = Array.isArray(value) ? value.filter(x => typeof x==='string').join('\n') : str(value)
  return content ? <section style={{marginTop:12}}>
    <div style={{fontSize:12,fontWeight:800,marginBottom:5,color:'#25493d'}}>{title}</div>
    <div style={{whiteSpace:'pre-wrap',fontSize:13,lineHeight:1.65,color:'#273b35'}}>{content}</div>
  </section> : null
}

/**
 * A teacher-authorized review view over canonical resource versions linked
 * to this exact Scheme row. Does not download/duplicate PDFs or bypass
 * certified-content publishing permissions.
 */
/**
 * @typedef {import('@/lib/teaching/jumpingDraftSections').JumpingContentSelection} JumpingContentSelection
 * @param {{schemeId: string, onUse?: (selection: JumpingContentSelection) => void, showGuide?: boolean}} props
 */
export default function JumpingSchemeContent({ schemeId, onUse, showGuide=false }) {
  const [units,setUnits] = useState([])
  const [selected,setSelected] = useState(null)
  const [topicGuide,setTopicGuide] = useState(null)
  const [loading,setLoading] = useState(false)
  const [error,setError] = useState('')

  useEffect(() => {
    let active = true
    setUnits([]);setSelected(null);setTopicGuide(null);setError('')
    if (!schemeId) return undefined
    ;(async () => {
      const {data,error} = await supabase.rpc('vs_read_linked_jumping_scheme_content', {
        p_scheme_id: schemeId, p_lesson_number:null
      })
      if (!active) return
      if (error || !data?.ok) {
        setError('Linked Jumping content is not available for this teaching assignment.')
        return
      }
      setUnits(Array.isArray(data.units) ? data.units : [])
      setTopicGuide(asRecord(data.content?.guide))
    })()
    return () => { active=false }
  },[schemeId])

  async function choose(lessonNumber) {
    setLoading(true);setError('')
    try {
      const {data,error} = await supabase.rpc('vs_read_linked_jumping_scheme_content', {
        p_scheme_id:schemeId, p_lesson_number:lessonNumber
      })
      if (error || !data?.ok || data.selectedLessonNumber!==lessonNumber) {
        throw new Error('This lesson content cannot be opened.')
      }
      const found = units.find(unit=>unit.lessonNumber===lessonNumber)
      const selection = {
        schemeId,lessonNumber,title:found?.title||'Jumping',
        content:asRecord(data.content),
      }
      setSelected(selection)
      // A single explicit unit choice carries the manuscript into the builder.
      // Never infer a unit from the broad Jumping sub-strand.
      if (typeof onUse === 'function') onUse(selection)
    } catch(err){setSelected(null);setError(err instanceof Error?err.message:'Lesson content unavailable.')}
    finally{setLoading(false)}
  }
  const guide=asRecord(topicGuide)
  const teacher=asRecord(selected?.content?.teacher)
  const learner=asRecord(selected?.content?.learner)
  return <section style={frame} aria-label="Jumping lesson content">
    <div style={{fontSize:13,fontWeight:800,color:'#173f32'}}>VibeSchool lesson content</div>
    <p style={{fontSize:12,lineHeight:1.5,color:'#53675c',margin:'5px 0 12px'}}>
      Choose the actual lesson to review. This is teaching content, not a PDF or a timetable assignment.
    </p>
    {error && <p role="alert" style={{fontSize:12,color:'#b91c1c'}}>{error}</p>}
    {str(guide.body) && <details open={showGuide} style={{border:'1px solid #d1fae5',borderRadius:10,padding:12,marginBottom:12,background:'#f7fdf9'}}>
      <summary style={{fontWeight:800,fontSize:13,cursor:'pointer'}}>Read the linked Jumping Teacher Guide (working draft)</summary>
      <Plain title="Original VibeSchool teacher guidance" value={guide.body}/>
      <p style={{fontSize:11,color:'#64748b'}}>Editorial candidate · not yet certified or released for learners</p>
    </details>}
    {units.length>0 && <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
      {units.map(unit=><button key={unit.lessonNumber} type="button"
        aria-pressed={selected?.lessonNumber===unit.lessonNumber}
        onClick={()=>void choose(unit.lessonNumber)} disabled={loading}
        title={unit.title}
        style={{...button,background:selected?.lessonNumber===unit.lessonNumber?'#dcefe4':'#fff',fontWeight:700}}>
        {unit.lessonNumber}. {unit.title}
      </button>)}
    </div>}
    {loading && <p role="status" style={{fontSize:12}}>Opening the lesson content…</p>}
    {selected && <div style={{marginTop:14,borderTop:'1px solid #e2e8f0',paddingTop:12}}>
      <div style={{fontSize:16,fontWeight:800,color:'#173f32'}}>{selected.title}</div>
      <Plain title="Teacher guidance" value={teacher.body}/>
      <Plain title="Learning activities" value={teacher.activities}/>
      <Plain title="Assessment and observation" value={teacher.assessment_guidance}/>
      <Plain title="Support different learners" value={teacher.differentiation}/>
      <Plain title="Learner content" value={learner.body}/>
      <Plain title="Learner activities" value={learner.learnerActivities}/>
      {typeof onUse==='function' && <p role="status" style={{fontSize:12,fontWeight:750,color:'#174f38'}}>Selected for this lesson plan. The builder will use this exact manuscript.</p>}
      <p style={{fontSize:11,color:'#64748b',margin:'10px 0 0'}}>Working teaching draft · review before classroom delivery</p>
    </div>}
  </section>
}

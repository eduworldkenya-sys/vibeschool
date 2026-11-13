'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bell, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, ListTodo, Plus, Trash2, Pencil, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useStudent } from '@/lib/student-context'
import { listMyTasks, resolveTaskLaunch, syncTaskExecutionReceipt, type StudentTask } from '@/lib/student/tasks'

type PlannerItem = {
  id: string; owner_user_id: string; title: string; notes: string;
  kind: 'task' | 'study'; starts_at: string | null; due_at: string | null;
  duration_minutes: number | null; repeat_rule: 'none' | 'daily' | 'weekly';
  completed_at: string | null; reminder_minutes: number | null; reminder_seen_occurrence_at: string | null; created_at: string; updated_at: string
}
type PlannerTab = 'today' | 'calendar' | 'schedule'
type Draft = { title: string; notes: string; kind: 'task' | 'study'; starts: string; due: string; repeat: PlannerItem['repeat_rule']; duration: string; reminder: string }
const blank: Draft = { title: '', notes: '', kind: 'task', starts: '', due: '', repeat: 'none', duration: '30', reminder: '' }
const dayKey = (date: Date) => [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-')
const localInput = (value: string | null) => { if (!value) return ''; const d=new Date(value); return [dayKey(d),String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')].join('T') }
const occurOn = (item: PlannerItem, date: Date) => {
  const base = item.starts_at ?? item.due_at
  if (!base) return false
  const start = new Date(base); const selected = new Date(date.getFullYear(),date.getMonth(),date.getDate())
  const original = new Date(start.getFullYear(),start.getMonth(),start.getDate())
  const delta = Math.round((selected.getTime()-original.getTime())/86400000)
  if (delta<0) return false
  return delta===0 || (item.repeat_rule==='daily' && delta>=0) || (item.repeat_rule==='weekly' && delta%7===0)
}
const fields: React.CSSProperties = { display:'grid', gap:6, fontSize:13, fontWeight:650 }
const input: React.CSSProperties = { minWidth:0, width:'100%', minHeight:44, border:'1px solid #cbd5e1',borderRadius:10,padding:'10px 12px',background:'#fff',color:'#17213b',font:'inherit' }
const button: React.CSSProperties = { minHeight:44, border:'none',borderRadius:10,padding:'10px 14px',background:'#5145e8',color:'#fff',fontWeight:700,cursor:'pointer' }
const secondary: React.CSSProperties = { ...button, background:'#f1f5f9',color:'#243047',border:'1px solid #e2e8f0' }

export default function TasksPage() {
  const router=useRouter()
  const {identity,loading:identityLoading}=useStudent()
  const [items,setItems]=useState<PlannerItem[]>([])
  const [assigned,setAssigned]=useState<StudentTask[]>([])
  const [assignedError,setAssignedError]=useState(false)
  const [tab,setTab]=useState<PlannerTab>('today')
  const [selected,setSelected]=useState(()=>new Date())
  const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1))
  const [editing,setEditing]=useState<string|null>(null)
  const [draft,setDraft]=useState<Draft>(blank)
  const [showForm,setShowForm]=useState(false)
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const [opening,setOpening]=useState<string|null>(null)
  const [notificationPermission,setNotificationPermission]=useState('unsupported')
  const owner=identity?.profileId

  const refresh=useCallback(async()=>{
    if(!owner) return
    setLoading(true);setError('')
    const {data,error:loadError}=await supabase.from('student_personal_planner').select('*').eq('owner_user_id',owner).order('created_at',{ascending:false}).limit(500)
    if(loadError) setError(loadError.message)
    else setItems((data??[]) as PlannerItem[])
    // Use the canonical task feed; keep independent planning usable if it is unavailable.
    try { const feed=await listMyTasks(); setAssigned(feed.tasks); setAssignedError(false) }
    catch { setAssigned([]); setAssignedError(true) }
    setLoading(false)
  },[owner])
  useEffect(()=>{void refresh()},[refresh])
  useEffect(()=>{setNotificationPermission(typeof Notification==='undefined'?'unsupported':Notification.permission)},[])

  function edit(item?:PlannerItem) {
    setEditing(item?.id??null)
    setDraft(item?{title:item.title,notes:item.notes,kind:item.kind,starts:localInput(item.starts_at),due:localInput(item.due_at),repeat:item.repeat_rule,duration:String(item.duration_minutes??30),reminder:item.reminder_minutes===null?'':String(item.reminder_minutes)}:blank)
    setShowForm(true)
  }
  async function save(event:React.FormEvent) {
    event.preventDefault()
    if(!owner || saving) return
    if(!draft.title.trim()) {setError('Enter a task name.');return}
    if(draft.kind==='study'&&!draft.starts) {setError('Choose when your study session starts.');return}
    if(draft.repeat!=='none'&&!draft.starts) {setError('Choose a start date for repeating activities.');return}
    if(draft.reminder!==''&&!draft.starts&&!draft.due) {setError('Choose a start or deadline to enable reminders.');return}
    const start=draft.starts?new Date(draft.starts).toISOString():null
    const due=draft.due?new Date(draft.due).toISOString():null
    if(start&&due&&due<start){setError('The deadline cannot be before the start.');return}
    setSaving(true);setError('')
    const payload={title:draft.title.trim(),notes:draft.notes.trim(),kind:draft.kind,starts_at:start,due_at:due,repeat_rule:draft.repeat,duration_minutes:draft.kind==='study'?Number(draft.duration):null,reminder_minutes:draft.reminder===''?null:Number(draft.reminder),reminder_seen_occurrence_at:null}
    const result=editing
      ? await supabase.from('student_personal_planner').update(payload).eq('id',editing).eq('owner_user_id',owner).select('id').single()
      : await supabase.from('student_personal_planner').insert({...payload,owner_user_id:owner}).select('id').single()
    if(result.error) setError(result.error.message)
    else {setShowForm(false);setEditing(null);setDraft(blank);await refresh()}
    setSaving(false)
  }
  async function complete(item:PlannerItem) {
    if(!owner) return
    const completed_at=item.completed_at?null:new Date().toISOString()
    const {data,error:saveError}=await supabase.from('student_personal_planner').update({completed_at}).eq('id',item.id).eq('owner_user_id',owner).select('id').single()
    if(saveError||!data){setError(saveError?.message??'Could not update this task.');return}
    setItems(previous=>previous.map(row=>row.id===item.id?{...row,completed_at}:row))
  }
  async function remove(item:PlannerItem) {
    if(!owner||!window.confirm('Delete this personal activity?')) return
    const {error:deleteError}=await supabase.from('student_personal_planner').delete().eq('id',item.id).eq('owner_user_id',owner)
    if(deleteError) setError(deleteError.message)
    else setItems(previous=>previous.filter(row=>row.id!==item.id))
  }
  async function openAssigned(task:StudentTask) {
    setOpening(task.taskId);setError('')
    try {const launch=await resolveTaskLaunch(task.taskId);await syncTaskExecutionReceipt(task.taskId);router.push(launch.actionUrl)}
    catch(e){setError(e instanceof Error?e.message:'Could not open this assignment.')}
    finally{setOpening(null)}
  }
  const selectedItems=useMemo(()=>items.filter(item=>!item.completed_at && occurOn(item,selected)),[items,selected])
  const undated=items.filter(item=>item.kind==='task'&&!item.starts_at&&!item.due_at&&!item.completed_at)
  const actionable=useMemo(()=>assigned.filter(task=>['ready','in_progress','overdue','returned','upcoming'].includes(task.status)).sort((a,b)=>{
    const rank:Record<string,number>={overdue:0,returned:1,in_progress:2,ready:3,upcoming:4}
    return (rank[a.status]??5)-(rank[b.status]??5) || (a.dueAt??'9999').localeCompare(b.dueAt??'9999')
  }),[assigned])
  const awaiting=assigned.filter(task=>task.status==='awaiting_marking').length
  const results=assigned.filter(task=>task.status==='released').length
  const pending=items.filter(item=>!item.completed_at).length
  const completed=items.filter(item=>!!item.completed_at).length
  const calendarCells=useMemo(()=>{const first=new Date(month.getFullYear(),month.getMonth(),1); const offset=(first.getDay()+6)%7;return Array.from({length:Math.ceil((offset+new Date(first.getFullYear(),first.getMonth()+1,0).getDate())/7)*7},(_,index)=>new Date(first.getFullYear(),first.getMonth(),index-offset+1))},[month])
  const schedules=items.filter(item=>item.kind==='study'&&item.starts_at).sort((a,b)=>(a.starts_at??'').localeCompare(b.starts_at??''))
  if(identityLoading||!identity) return <p style={{padding:20}}>Loading your learner workspace…</p>
  return <div className="planner" style={{display:'grid',gap:16,color:'#17213b'}}>
    <header className="planner-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
      <div><h1 style={{fontSize:26,margin:0}}>My Tasks</h1><p style={{fontSize:13,color:'#64748b',margin:'4px 0 0'}}>Teacher assignments and your personal study plan</p></div>
      <button type="button" style={button} onClick={()=>edit()}><Plus size={17} style={{verticalAlign:'middle'}}/> Add task</button>
    </header>
    <nav aria-label="Learning priorities" style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      {([['Homework','/student/homework'],['Classwork','/student/assessment'],['Exercises','/student/exercises'],['Projects',identity?.classId?'/student/projects':'/student/projects/independent'],['Practice','/student/vibelearn/topic-practice'],['Exams','/student/vibelearn/exams'],['Revision','/student/vibelearn/revision']] as const).map(([label,href])=><Link key={href} href={href} style={{...secondary,textDecoration:'none',display:'inline-flex',alignItems:'center'}}>{label}</Link>)}
    </nav>
    <section aria-labelledby="assigned-work-heading" style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:14,display:'grid',gap:10}}>
      <div><h2 id="assigned-work-heading" style={{fontSize:18,margin:'0 0 4px'}}>Assigned work {actionable.length>0&&`(${actionable.length})`}</h2><p style={{fontSize:12,color:'#64748b',margin:0}}>Homework, classwork and assessments from your teachers. Open a task here to complete it in its original workspace.</p></div>
      {assignedError ? <p role="status" style={{fontSize:13,margin:0}}>Assigned work is unavailable right now. <Link href="/student/homework">Check homework</Link> or retry by reloading this page. Your personal plan is still available.</p>
       : loading ? <p role="status" style={{fontSize:13,margin:0}}>Loading assigned work…</p>
       : actionable.length===0 ? <p style={{fontSize:13,margin:0,color:'#64748b'}}>Nothing assigned for action right now. <Link href="/learn">Continue learning</Link>.</p>
       : <>{actionable.slice(0,3).map(task=><AssignedTaskRow key={task.taskId} task={task} opening={opening} onOpen={()=>void openAssigned(task)}/>)}
          {actionable.length>3&&<details><summary style={{minHeight:44,cursor:'pointer',padding:8,fontSize:13,fontWeight:650}}>Show {actionable.length-3} more assigned tasks</summary><div style={{display:'grid',gap:9}}>{actionable.slice(3).map(task=><AssignedTaskRow key={task.taskId} task={task} opening={opening} onOpen={()=>void openAssigned(task)}/>)}</div></details>}
        </>}
      {(awaiting>0||results>0)&&<p style={{fontSize:12,color:'#64748b',margin:0}}>{awaiting>0&&`${awaiting} awaiting marking`}{awaiting>0&&results>0?' · ':''}{results>0&&`${results} results available`} · <Link href="/student/homework">View homework and feedback</Link></p>}
    </section>
    <h2 style={{fontSize:17,margin:0}}>My personal plan</h2>
    <section className="planner-stats" style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:9}}>
      {[['To do',pending],['Done',completed],['Scheduled',schedules.length]].map(([label,value])=><div key={label} style={{border:'1px solid #e2e8f0',borderRadius:12,background:'#fff',padding:12}}><strong style={{fontSize:22,display:'block'}}>{value}</strong><span style={{fontSize:12,color:'#64748b'}}>{label}</span></div>)}
    </section>
    <section style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',flexWrap:'wrap',background:'#fff',padding:12,border:'1px solid #e2e8f0',borderRadius:12}}><div style={{display:'flex',alignItems:'center',gap:8}}><Bell size={18} color="#5145e8"/><span style={{fontSize:13}}>Study reminders</span></div>{notificationPermission==='default'?<button type="button" style={secondary} onClick={async()=>{const result=await Notification.requestPermission();setNotificationPermission(result)}}>Enable browser alerts</button>:<span style={{fontSize:12,color:'#64748b'}}>{notificationPermission==='granted'?'Browser alerts enabled':notificationPermission==='denied'?'Browser alerts blocked in browser settings':'In-app reminders available'}</span>}</section>
    <nav aria-label="Planner views" style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:7}}>
      {([{id:'today',label:'Today',Icon:ListTodo},{id:'calendar',label:'Calendar',Icon:CalendarDays},{id:'schedule',label:'Schedule',Icon:Clock3}] as const).map(({id,label,Icon})=><button key={id} type="button" onClick={()=>setTab(id)} aria-current={tab===id?'page':undefined} style={{...secondary,background:tab===id?'#eef2ff':'#fff',borderColor:tab===id?'#5145e8':'#e2e8f0',color:tab===id?'#4338ca':'#334155',padding:'10px 5px',display:'flex',gap:5,alignItems:'center',justifyContent:'center'}}><Icon size={16}/>{label}</button>)}
    </nav>
    {error&&<div role="alert" style={{background:'#fff1f2',border:'1px solid #fecdd3',borderRadius:12,padding:12,color:'#9f1239'}}>{error}<button type="button" style={{...secondary,marginLeft:8}} onClick={()=>setError('')}>Dismiss</button></div>}
    {showForm&&<form onSubmit={e=>void save(e)} style={{background:'#fff',border:'1px solid #cbd5e1',borderRadius:16,padding:16,display:'grid',gap:12}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><h2 style={{fontSize:18,margin:0}}>{editing?'Edit activity':'Add activity'}</h2><button type="button" aria-label="Close editor" style={secondary} onClick={()=>setShowForm(false)}><X size={18}/></button></div>
      <label style={fields}>Activity name<input required maxLength={160} autoFocus style={input} value={draft.title} onChange={e=>setDraft(p=>({...p,title:e.target.value}))} placeholder="e.g. Revise fractions"/></label>
      <label style={fields}>Activity type<select style={input} value={draft.kind} onChange={e=>setDraft(p=>({...p,kind:e.target.value as Draft['kind']}))}><option value="task">To-do task</option><option value="study">Scheduled study session</option></select></label>
      <div className="planner-form-grid" style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10}}>
        <label style={fields}>Start date and time<input style={input} type="datetime-local" value={draft.starts} onChange={e=>setDraft(p=>({...p,starts:e.target.value}))}/></label>
        <label style={fields}>Deadline (optional)<input style={input} type="datetime-local" value={draft.due} onChange={e=>setDraft(p=>({...p,due:e.target.value}))}/></label>
      </div>
      <div className="planner-form-grid" style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10}}>
        <label style={fields}>Repeat<select style={input} value={draft.repeat} onChange={e=>setDraft(p=>({...p,repeat:e.target.value as Draft['repeat']}))}><option value="none">Never</option><option value="daily">Every day</option><option value="weekly">Every week</option></select></label>
        {draft.kind==='study'&&<label style={fields}>Minutes<input style={input} type="number" min={5} max={600} required value={draft.duration} onChange={e=>setDraft(p=>({...p,duration:e.target.value}))}/></label>}
      </div>
      <label style={fields}><span style={{display:'flex',alignItems:'center',gap:7}}><Bell size={16}/> Reminder</span><select style={input} value={draft.reminder} onChange={e=>setDraft(p=>({...p,reminder:e.target.value}))}><option value="">Off</option><option value="0">At the scheduled time</option><option value="5">5 minutes before</option><option value="15">15 minutes before</option><option value="30">30 minutes before</option><option value="60">1 hour before</option><option value="1440">1 day before</option></select></label>
      <p style={{fontSize:12,color:'#64748b',margin:0}}>In-app reminders appear while VibeSchool is open. Browser alerts require permission and an active browser session.</p>
      <label style={fields}>Notes (optional)<textarea style={input} rows={3} maxLength={2000} value={draft.notes} onChange={e=>setDraft(p=>({...p,notes:e.target.value}))}/></label>
      <button type="submit" disabled={saving} style={{...button,opacity:saving?.6:1}}>{saving?'Saving…':'Save activity'}</button>
    </form>}
    {loading?<p role="status">Loading activities…</p>:tab==='today'?<section style={{display:'grid',gap:10}}>
      <h2 style={{fontSize:17,margin:0}}>{selected.toLocaleDateString('en-KE',{weekday:'long',month:'long',day:'numeric'})}</h2>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button type="button" style={secondary} onClick={()=>setSelected(new Date(selected.getFullYear(),selected.getMonth(),selected.getDate()-1))}><ChevronLeft size={16}/></button><button type="button" style={secondary} onClick={()=>setSelected(new Date())}>Today</button><button type="button" style={secondary} onClick={()=>setSelected(new Date(selected.getFullYear(),selected.getMonth(),selected.getDate()+1))}><ChevronRight size={16}/></button></div>
      {[...selectedItems,...undated.filter(item=>!selectedItems.some(row=>row.id===item.id))].length===0?<p style={{background:'#fff',padding:24,borderRadius:14,color:'#64748b'}}>Nothing planned. Add your first activity.</p>:[...selectedItems,...undated.filter(item=>!selectedItems.some(row=>row.id===item.id))].map(item=><Activity key={item.id} item={item} onEdit={()=>edit(item)} onDelete={()=>void remove(item)} onComplete={()=>void complete(item)}/>)}
      {completed>0&&<details><summary style={{cursor:'pointer',padding:8}}>Completed ({completed})</summary><div style={{display:'grid',gap:9,marginTop:8}}>{items.filter(item=>item.completed_at).map(item=><Activity key={item.id} item={item} onEdit={()=>edit(item)} onDelete={()=>void remove(item)} onComplete={()=>void complete(item)}/>)}</div></details>}
    </section>:tab==='calendar'?<section style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:15,padding:12,display:'grid',gap:12}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}><button type="button" aria-label="Previous month" style={secondary} onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><ChevronLeft size={18}/></button><h2 style={{fontSize:17,margin:0}}>{month.toLocaleDateString('en-KE',{month:'long',year:'numeric'})}</h2><button type="button" aria-label="Next month" style={secondary} onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><ChevronRight size={18}/></button></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(0,1fr))',gap:4}}>{['M','T','W','T','F','S','S'].map((day,i)=><span key={i} style={{textAlign:'center',fontSize:12,color:'#64748b'}}>{day}</span>)}{calendarCells.map(date=>{const count=items.filter(item=>!item.completed_at&&occurOn(item,date)).length;const active=dayKey(date)===dayKey(selected);return <button type="button" key={dayKey(date)} aria-label={date.toDateString()+', '+count+' activities'} onClick={()=>{setSelected(date);setTab('today')}} style={{minWidth:0,minHeight:48,border:'1px solid '+(active?'#5145e8':'#e2e8f0'),borderRadius:8,background:active?'#eef2ff':'#fff',color:date.getMonth()===month.getMonth()?'#17213b':'#94a3b8',cursor:'pointer',fontWeight:active?800:500}}>{date.getDate()}{count>0&&<span style={{display:'block',fontSize:10,color:'#5145e8'}}>{count} •</span>}</button>})}</div>
      <p style={{fontSize:12,color:'#64748b',margin:0}}>Select a date to see its planned activities.</p>
    </section>:<section style={{display:'grid',gap:10}}>
      <h2 style={{fontSize:17,margin:0}}>My study schedule</h2>
      {schedules.length===0?<p style={{background:'#fff',padding:24,borderRadius:14,color:'#64748b'}}>No sessions scheduled. Add a study session to create your timetable.</p>:schedules.map(item=><Activity key={item.id} item={item} onEdit={()=>edit(item)} onDelete={()=>void remove(item)} onComplete={()=>void complete(item)}/>)}
    </section>}
    <style>{`
      .planner { min-width:0; width:100%; }
      .planner :is(input,select,textarea,button) { max-width:100%; }
      @media(max-width:480px){.planner-form-grid{grid-template-columns:minmax(0,1fr)!important}.planner-header h1{font-size:23px!important}}
      @media(prefers-reduced-motion:reduce){.planner *{scroll-behavior:auto!important;transition:none!important}}
    `}</style>
  </div>
}

function Activity({item,onEdit,onDelete,onComplete}:{item:PlannerItem;onEdit:()=>void;onDelete:()=>void;onComplete:()=>void}){
  const repeating=item.repeat_rule!=='none'
  return <article style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:13,padding:14,display:'flex',alignItems:'flex-start',gap:10,minWidth:0}}>
    {item.kind==='task'&&!repeating?<button type="button" onClick={onComplete} aria-label={item.completed_at?'Mark incomplete':'Mark complete'} style={{...secondary,minWidth:44,padding:10,background:item.completed_at?'#dcfce7':'#f8fafc'}}><Check size={18} color={item.completed_at?'#15803d':'#94a3b8'}/></button>:<Clock3 size={20} color="#5145e8" style={{marginTop:11,flexShrink:0}}/>}
    <div style={{flex:1,minWidth:0,overflowWrap:'anywhere'}}><strong style={{textDecoration:item.completed_at?'line-through':'none'}}>{item.title}</strong><p style={{fontSize:12,color:'#64748b',margin:'5px 0'}}>{item.starts_at?new Date(item.starts_at).toLocaleString('en-KE',{weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}):item.due_at?'Due '+new Date(item.due_at).toLocaleDateString('en-KE'):'Any time'}{item.duration_minutes?' · '+item.duration_minutes+' min':''}{repeating?' · '+item.repeat_rule:''}</p>{item.reminder_minutes!==null && item.reminder_minutes!==undefined && <p style={{fontSize:11,color:'#5145e8',margin:'4px 0'}}><Bell size={12} style={{verticalAlign:'middle'}}/> {item.reminder_minutes===0?'At scheduled time':item.reminder_minutes===1440?'1 day before':item.reminder_minutes+' min before'}</p>}{item.notes&&<p style={{fontSize:12,color:'#475569',margin:0}}>{item.notes}</p>}</div>
    <div style={{display:'flex',gap:4}}><button type="button" onClick={onEdit} style={{...secondary,padding:9}} aria-label={'Edit '+item.title}><Pencil size={16}/></button><button type="button" onClick={onDelete} style={{...secondary,padding:9}} aria-label={'Delete '+item.title}><Trash2 size={16}/></button></div>
  </article>
}

function AssignedTaskRow({task,opening,onOpen}:{task:StudentTask;opening:string|null;onOpen:()=>void}){
  const future=task.status==='upcoming'
  return <article style={{border:'1px solid #e2e8f0',borderRadius:11,padding:12,display:'flex',gap:10,alignItems:'center',justifyContent:'space-between',flexWrap:'wrap'}}>
    <div style={{flex:'1 1 220px',minWidth:0}}><strong style={{overflowWrap:'anywhere'}}>{task.title}</strong><p style={{fontSize:12,color:'#64748b',margin:'4px 0'}}>{task.subject} · {task.taskType.replaceAll('_',' ')} · {task.status.replaceAll('_',' ')}{task.dueAt?' · Due '+new Date(task.dueAt).toLocaleDateString('en-KE',{timeZone:'Africa/Nairobi',day:'numeric',month:'short'}):''}</p></div>
    <button type="button" disabled={opening!==null||future} onClick={onOpen} style={{...button,opacity:future?.55:1}}>{opening===task.taskId?'Opening…':future?'Not open yet':task.actionLabel}</button>
  </article>
}

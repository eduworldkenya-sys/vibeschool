'use client'
import {useEffect,useState,useRef,useCallback} from 'react'
import {ObjectBoard,SharedObjectBoard} from './LiveObjectBoard'
import styles from './LiveClassroom.module.css'
type Question={id:string;kind:string;body:string}
type Entry={studentId:string;name?:string;revision:number;status:'draft'|'submitted'|'returned'|'accepted';body:string;drawing:string;feedback:string}
type Command=(action:string,id:string|null,version:number|null,payload:Record<string,unknown>)=>Promise<unknown>
type Props={roomId:string;teacher:boolean;status:string;online:boolean;questions:Question[];currentId?:string;command:Command;joined:number}
function isEntry(x:unknown):x is Entry {
 if(!x||typeof x!=='object')return false
 const e=x as Entry
 return typeof e.studentId==='string'&&Number.isInteger(e.revision)&&e.revision>0&&['draft','submitted','returned','accepted'].includes(e.status)&&typeof e.body==='string'&&typeof e.drawing==='string'&&typeof e.feedback==='string'
}
const labels={draft:'Private draft',submitted:'Submitted',returned:'Correction requested',accepted:'Reviewed'}
export function LiveWorkbook(props:Props){
 const questions=props.questions.filter(q=>q.kind==='exercise'||q.kind==='quiz')
 const [selected,setSelected]=useState('')
 const question=questions.find(q=>q.id===selected)??questions.find(q=>q.id===props.currentId)??questions[questions.length-1]
 if(!question)return <section><h3>Exercise book</h3><p>{props.teacher?'Share an exercise or quiz to collect written work.':'Your exercise book opens when the teacher shares a question.'}</p></section>
 return <section aria-label="Exercise book"><h3>Exercise book</h3><label>Exercise<select value={question.id} onChange={e=>setSelected(e.target.value)}>{questions.map((q,i)=><option key={q.id} value={q.id}>{i+1}. {q.body.slice(0,80)}</option>)}</select></label><WorkbookPage key={props.roomId+':'+question.id+':'+props.teacher} {...props} question={question}/></section>
}
function WorkbookPage({roomId,teacher,status,online,question,command,joined,currentId}:Props&{question:Question}){
 const [entries,setEntries]=useState<Entry[]>([]),[body,setBody]=useState(''),[drawing,setDrawing]=useState(''),[feedback,setFeedback]=useState(''),[chosen,setChosen]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[showBoard,setShowBoard]=useState(false),[undo,setUndo]=useState<string[]>([]),[redo,setRedo]=useState<string[]>([])
 const alive=useRef(false),dirty=useRef(false),pending=useRef(false),readSeq=useRef(0),editRevision=useRef<number|null>(null),feedbackRevision=useRef<number|null>(null)
 const refresh=useCallback(async()=>{
  if(pending.current)return
  const seq=++readSeq.current
  try{
   const result=await command('workbook_list',roomId,null,{promptId:question.id}) as {entries?:unknown}
   if(!Array.isArray(result?.entries)||!result.entries.every(isEntry))throw Error('Invalid workbook response')
   if(!alive.current||seq!==readSeq.current||pending.current)return
   setEntries(result.entries);setLoaded(true);setError('')
   if(!teacher&&!dirty.current){const e=result.entries[0];setBody(e?.body??'');setDrawing(e?.drawing??'')}
  }catch(e){if(alive.current&&seq===readSeq.current){setError(e instanceof Error?e.message:'Could not load exercise book');setEntries([]);setLoaded(false)}}
 },[command,roomId,question.id,teacher])
 useEffect(()=>{alive.current=true;if(online)void refresh();const timer=window.setInterval(()=>{if(online&&document.visibilityState==='visible')void refresh()},3000);return()=>{alive.current=false;readSeq.current++;window.clearInterval(timer)}},[refresh,online])
 const own=entries[0],selected=entries.find(e=>e.studentId===chosen)
 const editable=loaded&&status==='active'&&(!own||own.status==='draft'||own.status==='returned')&&(question.id===currentId||own?.status==='returned')
 function markDirty(){if(!dirty.current)editRevision.current=own?.revision??0;dirty.current=true}
 function editBody(v:string){markDirty();setBody(v);setNotice('Unsaved changes')}
 function editDrawing(v:string){markDirty();setUndo(a=>[...a.slice(-29),drawing]);setRedo([]);setDrawing(v);setNotice('Unsaved changes')}
 async function write(action:string){
  if(pending.current||!online||!loaded)return
  const target=teacher?selected:own
  pending.current=true;readSeq.current++;setBusy(true);setError('')
  try{
   const result=await command(action,roomId,null,{promptId:question.id,revision:teacher?(feedbackRevision.current??target?.revision??0):(editRevision.current??target?.revision??0),...(teacher?{studentId:target?.studentId,feedback}:{body,drawing})})
   if(!isEntry(result))throw Error('Invalid save response')
   if(!alive.current)return
   setEntries(old=>[...old.filter(e=>e.studentId!==result.studentId),{...target,...result}])
   if(!teacher){dirty.current=false;editRevision.current=null;setBody(result.body);setDrawing(result.drawing);setUndo([]);setRedo([])}
   setNotice(action==='workbook_save'?'Saved':action==='workbook_submit'?'Submitted to teacher':'Feedback saved');setFeedback('');feedbackRevision.current=null
  }catch(e){if(alive.current)setError(e instanceof Error&&e.message==='live_workbook_conflict'?'Work changed on another device. Copy unsaved changes, then reload the saved version.':e instanceof Error?e.message:'Unable to save. Retry.')}
  finally{pending.current=false;if(alive.current)setBusy(false)}
 }
 return <div className={styles.workpad}>
  <p>{question.body}</p>
  {!online&&<p role="status">Offline. Reconnect before saving or sending feedback.</p>}
  {error&&<p role="alert">{error}</p>}
  {!loaded&&<button type="button" disabled={!online||busy} onClick={()=>void refresh()}>Retry loading</button>}
  {teacher?<><div className={styles.metrics}><span>{joined} joined</span><span>{entries.filter(e=>e.status==='submitted').length} awaiting review</span><span>{entries.filter(e=>e.status==='returned').length} corrections requested</span><span>{entries.filter(e=>e.status==='accepted').length} reviewed</span></div>
   {loaded&&!entries.length&&<p>No work submitted yet.</p>}
   <ul className={styles.participants}>{entries.map(e=><li key={e.studentId}><strong>{e.name??'Learner'}</strong><span>{labels[e.status]}</span><button type="button" aria-pressed={chosen===e.studentId} onClick={()=>{setChosen(e.studentId);setFeedback('');feedbackRevision.current=null}}>Inspect work</button></li>)}</ul>
   {selected&&<section><h4>{selected.name??'Learner'} · {labels[selected.status]}</h4><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{selected.body}</p>{selected.drawing&&<SharedObjectBoard value={selected.drawing}/>}
    {selected.feedback&&<p>Previous feedback: {selected.feedback}</p>}
    {selected.status==='submitted'&&<><label>Individual feedback<textarea rows={4} maxLength={2000} value={feedback} onChange={e=>{if(feedbackRevision.current===null)feedbackRevision.current=selected.revision;setFeedback(e.target.value)}} disabled={busy}/></label><div className={styles.workpadActions}><button type="button" disabled={status!=='active'||busy||!online||!feedback.trim()} onClick={()=>void write('workbook_return')}>Return for correction</button><button type="button" className={styles.primary} disabled={busy||!online||!feedback.trim()} onClick={()=>void write('workbook_accept')}>Accept work</button></div></>}
   </section>}</>:<>
   <p role="status">{own?labels[own.status]:'Not submitted'}</p>
   {own?.feedback&&<p>Teacher feedback: {own.feedback}</p>}
   <label>Show your working<textarea rows={6} maxLength={4000} value={body} disabled={!editable||busy} onChange={e=>editBody(e.target.value)}/></label>
   <button type="button" onClick={()=>setShowBoard(v=>!v)}>{showBoard?'Hide drawing':'Draw or write by hand'}</button>
   {showBoard&&(editable?<ObjectBoard value={drawing} page={1} total={1} onChange={editDrawing} disabled={busy} canUndo={!!undo.length} canRedo={!!redo.length} onUndo={()=>{markDirty();setRedo(v=>[...v,drawing]);setDrawing(undo[undo.length-1]);setUndo(v=>v.slice(0,-1));setNotice('Unsaved changes')}} onRedo={()=>{markDirty();setUndo(v=>[...v,drawing]);setDrawing(redo[redo.length-1]);setRedo(v=>v.slice(0,-1));setNotice('Unsaved changes')}}/>:drawing?<SharedObjectBoard value={drawing}/>:<p>No drawing saved.</p>)}
   <div className={styles.workpadActions}><button type="button" disabled={!editable||busy||!online} onClick={()=>void write('workbook_save')}>Save work</button><button type="button" className={styles.primary} disabled={!editable||busy||!online||(!body.trim()&&!drawing)} onClick={()=>void write('workbook_submit')}>Submit work</button><button type="button" disabled={busy||!online} onClick={()=>{if(!dirty.current||window.confirm('Discard unsaved edits and reload saved work?')){dirty.current=false;editRevision.current=null;setNotice('');void refresh()}}}>Reload saved work</button></div>
   <small>Save to keep work across devices. Submit to share it with the teacher; saved corrections to returned work remain visible to your teacher.</small>
  </>}
  {notice&&<p role="status">{notice}</p>}
 </div>
}

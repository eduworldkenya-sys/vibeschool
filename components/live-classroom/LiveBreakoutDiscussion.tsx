'use client'
import {useEffect,useRef,useState} from 'react'
import styles from './LiveClassroom.module.css'

type Command=(action:string,id?:string|null,version?:number|null,payload?:Record<string,unknown>)=>Promise<unknown>
type Group={id:string;title:string;closed:boolean;size:number;members:string[]}
type Member={id:string;name:string}
type Message={id:string;body:string;author:string;own:boolean;hidden:boolean;reported:boolean;sentAt:string}
export function LiveBreakoutDiscussion({roomId,teacher,status,command}:{roomId:string;teacher:boolean;status:'active'|'paused'|'ended';command:Command}){
 const [open,setOpen]=useState(false)
 const [groups,setGroups]=useState<Group[]>([])
 const [roster,setRoster]=useState<Member[]>([])
 const [selected,setSelected]=useState('')
 const [members,setMembers]=useState<string[]>([])
 const [title,setTitle]=useState('')
 const [draft,setDraft]=useState('')
 const [messages,setMessages]=useState<Message[]>([])
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 const [reported,setReported]=useState<string[]>([])
 const refreshRef=useRef<()=>Promise<void>>(async()=>{})
 const pending=useRef<{action:string;key:string;id:string}|null>(null)
 const mutation=useRef(false)
 const generation=useRef(0)
 const selectedGroup=groups.find(g=>g.id===selected)
 useEffect(()=>{
  setGroups([]);setRoster([]);setSelected('');setMembers([]);setMessages([]);setReported([]);setDraft('');setTitle('');setError('');setBusy(false);pending.current=null
 },[roomId,teacher])
 useEffect(()=>{
  if(!open||status==='ended'){setMessages([]);setGroups([]);setRoster([]);return}
  let active=true,reading=false
  const refresh=async()=>{
   if(!active||reading||document.visibilityState==='hidden'||!navigator.onLine)return
   reading=true
   try{
    const result=await command('breakout_list',roomId) as {groups:Group[];roster:Member[]}
    if(!active)return
    if(!Array.isArray(result.groups)||!Array.isArray(result.roster))throw Error('Invalid discussion list')
    setGroups(result.groups);setRoster(result.roster)
    const next=result.groups.find(g=>g.id===selected)??result.groups.find(g=>!g.closed)
    if(!next){setSelected('');setMessages([]);setError('');return}
    if(next.id!==selected){setSelected(next.id);setMessages([]);return}
    const thread=await command('breakout_read',roomId,null,{groupId:next.id}) as {messages:Message[]}
    if(!active)return
    if(!Array.isArray(thread.messages))throw Error('Invalid discussion messages')
    setMessages(thread.messages);setError('')
   }catch{if(active){setGroups([]);setRoster([]);setMessages([]);setError('Group discussions could not sync. Check your access or connection.')}}
   finally{reading=false}
  }
  refreshRef.current=refresh
  void refresh()
  const timer=window.setInterval(()=>void refresh(),3000)
  const wake=()=>void refresh()
  window.addEventListener('online',wake);document.addEventListener('visibilitychange',wake)
  return()=>{active=false;window.clearInterval(timer);window.removeEventListener('online',wake);document.removeEventListener('visibilitychange',wake);refreshRef.current=async()=>{}}
 },[open,roomId,selected,status,command])
 useEffect(()=>{const epoch=++generation.current;return()=>{if(generation.current===epoch)generation.current++}},[roomId,teacher,open,status])
 async function mutate(action:string,payload:Record<string,unknown>,onSuccess?:()=>void){
  if(mutation.current||status==='ended'||!navigator.onLine)return
  mutation.current=true;setBusy(true);setError('')
  const epoch=generation.current
  try{
   const key=JSON.stringify(payload)
   if(action==='breakout_send'||action==='breakout_create'){
    if(pending.current?.action!==action||pending.current.key!==key)pending.current={action,key,id:crypto.randomUUID()}
    payload={...payload,requestId:pending.current.id}
   }
   await command(action,roomId,null,payload)
   if(generation.current!==epoch)return
   pending.current=null;onSuccess?.();await refreshRef.current()
  }catch(e){
   if(generation.current===epoch){
    const msg=e instanceof Error?e.message:''
    setError(msg.includes('member_busy')?'A selected learner is already in an active group.':msg.includes('rate_limit')?'Send less often.':msg.includes('limit')?'Discussion limit reached.':'Could not save. Retry when connected.')
   }
  }finally{mutation.current=false;setBusy(false)}
 }
 const assigned=new Set(groups.filter(g=>!g.closed).flatMap(g=>g.members))
 return <div className={styles.classChatEntry}>
  <button type="button" aria-expanded={open} disabled={status==='ended'} onClick={()=>setOpen(v=>!v)}>{open?'Close group discussions':'Group discussions'}</button>
  {open&&status!=='ended'&&<>
   <small>Temporary, teacher-supervised text groups. Discussions stop when the lesson ends.</small>
   {error&&<p role="alert">{error}</p>}
   {teacher&&status==='active'&&<form onSubmit={e=>{e.preventDefault();void mutate('breakout_create',{title:title.trim(),members:[...members].sort()},()=>{setTitle('');setMembers([])})}}>
    <label>Group name<input required maxLength={60} value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <fieldset><legend>Choose 2–12 joined learners</legend>
     {roster.map(m=><label key={m.id}><input type="checkbox" disabled={busy||assigned.has(m.id)||(!members.includes(m.id)&&members.length>=12)} checked={members.includes(m.id)&&!assigned.has(m.id)} onChange={e=>setMembers(v=>e.target.checked?[...v,m.id]:v.filter(x=>x!==m.id))}/>{m.name}{assigned.has(m.id)?' (assigned)':''}</label>)}
    </fieldset>
    <button type="submit" disabled={busy||!title.trim()||members.length<2||members.some(id=>assigned.has(id))}>Create discussion group</button>
   </form>}
   {!groups.length&&<p>{teacher?'No discussion groups yet.':'Waiting for your teacher to assign a group.'}</p>}
   {groups.length>0&&<label>Discussion<select value={selected} onChange={e=>{setSelected(e.target.value);setMessages([]);setDraft('');setReported([])}}>{groups.map(g=><option key={g.id} value={g.id}>{g.title} ({g.size}){g.closed?' · Closed':''}</option>)}</select></label>}
   {selectedGroup&&<>
    {teacher&&!selectedGroup.closed&&<button type="button" disabled={busy} onClick={()=>{if(window.confirm('Close this discussion for all learners?'))void mutate('breakout_close',{groupId:selected})}}>Close group</button>}
    <div className={styles.chatMessages} role="log" aria-live="polite">
     {messages.map(m=><div className={styles.classChatEntry} key={m.id}><strong>{m.author}{m.own?' · You':''}</strong><p>{m.hidden?'Hidden by teacher':m.body}</p>
      {teacher&&m.reported&&<small>Reported for review</small>}
      {teacher&&!m.hidden&&<button type="button" disabled={busy} onClick={()=>{if(window.confirm('Hide this message?'))void mutate('breakout_hide',{groupId:selected,messageId:m.id})}}>Hide</button>}
      {!teacher&&!m.own&&!reported.includes(m.id)&&<button type="button" disabled={busy} onClick={()=>void mutate('breakout_report',{groupId:selected,messageId:m.id},()=>setReported(v=>[...v,m.id]))}>Report</button>}
      {!teacher&&reported.includes(m.id)&&<small>Reported</small>}
     </div>)}
    </div>
    {!selectedGroup.closed&&status==='active'&&<form onSubmit={e=>{e.preventDefault();void mutate('breakout_send',{groupId:selected,body:draft.trim()},()=>setDraft(''))}}>
     <label>Message your group<textarea required maxLength={500} disabled={busy} value={draft} onChange={e=>setDraft(e.target.value)}/></label>
     <button type="submit" disabled={busy||!draft.trim()}>Send to group</button>
    </form>}
   </>}
  </>}
 </div>
}

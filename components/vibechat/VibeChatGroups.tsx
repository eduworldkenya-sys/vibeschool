'use client'

import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {getSupabaseClient} from '@/lib/supabase'
import type {useVibeChatOutbox} from './useVibeChatOutbox'
import styles from './VibeChat.module.css'

type Group={id:string;name:string;owner:boolean;members:number;updated:string;preview:string;unread:number;pinned:boolean;archived:boolean;muted:boolean}
type Candidate={id:string;name:string;handle:string|null}
type Invitation={id:string;group_name:string;inviter_name:string;created_at:string}
type Message={id:string;body:string;mine:boolean;sender:string;created_at:string}
const stamp=(s:string)=>new Date(s).toLocaleString('en-KE',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZone:'Africa/Nairobi'})

export default function VibeChatGroups({owner,refreshVersion,refresh,outbox}:{owner:string;refreshVersion:number;refresh:()=>void;outbox:ReturnType<typeof useVibeChatOutbox>}){
 const [groups,setGroups]=useState<Group[]>([])
 const [candidates,setCandidates]=useState<Candidate[]>([])
 const [invitations,setInvitations]=useState<Invitation[]>([])
 const [active,setActive]=useState<string|null>(null)
 const [messages,setMessages]=useState<Message[]>([])
 const [name,setName]=useState('')
 const [chosen,setChosen]=useState<string[]>([])
 const [creating,setCreating]=useState(false)
 const [inviting,setInviting]=useState(false)
 const [archived,setArchived]=useState(false)
 const [body,setBody]=useState('')
 const [query,setQuery]=useState('')
 const [appliedQuery,setAppliedQuery]=useState('')
 const [done,setDone]=useState(false)
 const [busy,setBusy]=useState(false)
 const [pageBusy,setPageBusy]=useState(false)
 const [loaded,setLoaded]=useState(false)
 const [error,setError]=useState('')
 const [confirmLeave,setConfirmLeave]=useState(false)
 const [reporting,setReporting]=useState(false)
 const [reason,setReason]=useState('safety')
 const listSeq=useRef(0)
 const messageSeq=useRef(0)
 const createId=useRef<string|null>(null)
 const activeRef=useRef(active)
 activeRef.current=active
 const group=groups.find(g=>g.id===active)??null
 const pending=useMemo(()=>outbox.items.filter(m=>m.kind==='group'&&m.room===active),[outbox.items,active])

 const load=useCallback(async()=>{
  const seq=++listSeq.current
  try{
   const db=getSupabaseClient()
   const [g,c,i]=await Promise.all([db.rpc('vibechat_group_list'),db.rpc('vibechat_group_candidates'),db.rpc('vibechat_group_invitations')])
   if(seq!==listSeq.current)return
   if(g.error||c.error||i.error)throw Error('Group service unavailable')
   setGroups(g.data??[]);setCandidates(c.data??[]);setInvitations(i.data??[]);setLoaded(true)
   if(activeRef.current&&!g.data?.some(x=>x.id===activeRef.current)){setActive(null);setMessages([])}
  }catch{if(seq===listSeq.current){setLoaded(true);setError('Groups are unavailable. Retry after the server update.')}}
 },[])
 useEffect(()=>{void load();return()=>{listSeq.current++}},[owner,refreshVersion,load])
 useEffect(()=>{
  messageSeq.current++
  setMessages([]);setDone(false);setPageBusy(false);setBody('');setQuery('');setAppliedQuery('');setInviting(false);setChosen([]);setConfirmLeave(false);setReporting(false)
 },[active,owner])
 const loadMessages=useCallback(async(room:string,search:string,before?:Message)=>{
  const seq=++messageSeq.current
  setPageBusy(true)
  try{
   const db=getSupabaseClient()
   const {data,error}=await db.rpc('vibechat_group_messages',{p_room:room,p_before:before?.created_at??null,p_before_id:before?.id??null,p_query:search||null})
   if(seq!==messageSeq.current||activeRef.current!==room)return
   if(error||!Array.isArray(data))throw Error('Group history unavailable')
   setMessages(previous=>before?[...new Map([...data,...previous].map(m=>[m.id,m])).values()].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id)):data)
   setDone(data.length<50)
   if(!search&&!before&&document.visibilityState==='visible'&&document.hasFocus()){
    const latest=data[data.length-1]
    if(latest){
     const ack=await db.rpc('vibechat_group_ack',{p_room:room,p_message:latest.id})
     if(!ack.error&&ack.data&&activeRef.current===room)setGroups(previous=>previous.map(g=>g.id===room?{...g,unread:0}:g))
    }
   }
  }catch{if(seq===messageSeq.current&&activeRef.current===room){setMessages([]);setError('Could not load this group conversation.')}}
  finally{if(seq===messageSeq.current)setPageBusy(false)}
 },[])
 useEffect(()=>{if(active)void loadMessages(active,appliedQuery);return()=>{messageSeq.current++}},[active,appliedQuery,refreshVersion,loadMessages])
 function toggleCandidate(id:string){
  createId.current=null
  setChosen(previous=>previous.includes(id)?previous.filter(x=>x!==id):previous.length<19?[...previous,id]:previous)
 }
 async function action(work:()=>Promise<void>){
  if(busy)return
  setBusy(true);setError('')
  try{await work();refresh();await load()}
  catch{setError('Could not complete this group action. Check the connection or permissions and retry.')}
  finally{setBusy(false)}
 }
 async function create(){
  if(!name.trim()||!chosen.length)return
  await action(async()=>{
   const id=createId.current??crypto.randomUUID();createId.current=id
   const {data,error}=await getSupabaseClient().rpc('vibechat_group_create',{p_room:id,p_name:name.trim(),p_recipients:chosen})
   if(error||!data)throw error
   createId.current=null;setCreating(false);setName('');setChosen([]);setActive(data)
  })
 }
 const candidatesView=<div className={styles.contactBlock}>{candidates.length===0?<p className={styles.subtitle}>No eligible accepted contacts yet. Find and connect with an adult account in Contacts first.</p>:candidates.map(c=><label key={c.id} className={styles.contactRow}><input type="checkbox" checked={chosen.includes(c.id)} onChange={()=>toggleCandidate(c.id)} disabled={busy}/><span>{c.name} {c.handle&&<small>{c.handle}</small>}</span></label>)}</div>
 return <section className={styles.layout} aria-label="VibeChat groups">
  <aside className={styles.sidebar}>
   <div className={styles.actionRow}><button type="button" className={styles.primary} onClick={()=>{setCreating(v=>!v);setInviting(false);setChosen([]);createId.current=null}}>New group</button><button type="button" className={styles.back} aria-pressed={archived} onClick={()=>setArchived(v=>!v)}>{archived?'Active groups':'Archived'}</button></div>
   {error&&<div className={styles.error} role="alert">{error} <button type="button" onClick={()=>void load()}>Retry</button></div>}
   {creating&&<form className={styles.actionPanel} onSubmit={e=>{e.preventDefault();void create()}}>
    <label htmlFor="vc-group-name">Group name</label>
    <input id="vc-group-name" className={styles.search} value={name} maxLength={80} onChange={e=>{setName(e.target.value);createId.current=null}} required/>
    {candidatesView}<button type="submit" disabled={busy||!name.trim()||!chosen.length}>Create and invite</button>
    <button type="button" onClick={()=>setCreating(false)}>Cancel</button>
   </form>}
   {!!invitations.length&&<section className={styles.contactBlock}><strong>Invitations</strong>{invitations.map(i=><div key={i.id} className={styles.contactRow}><span style={{flex:1}}>{i.group_name}<small className={styles.subtitle}> · {i.inviter_name}</small></span>
    <button type="button" className={styles.back} disabled={busy} onClick={()=>void action(async()=>{const {data,error}=await getSupabaseClient().rpc('vibechat_group_respond',{p_invite:i.id,p_accept:true});if(error||!data)throw error;setActive(data)})}>Join</button>
    <button type="button" className={styles.back} disabled={busy} onClick={()=>void action(async()=>{const {error}=await getSupabaseClient().rpc('vibechat_group_respond',{p_invite:i.id,p_accept:false});if(error)throw error})}>Decline</button></div>)}</section>}
   {!loaded?<p role="status" className={styles.empty}>Loading groups…</p>:groups.filter(g=>g.archived===archived).length===0?<p className={styles.empty}>No {archived?'archived ':''}groups yet.</p>:groups.filter(g=>g.archived===archived).map(g=><button type="button" className={styles.thread+(active===g.id?' '+styles.selected:'')} key={g.id} onClick={()=>{setActive(g.id);setCreating(false)}}><span className={styles.threadText}><strong>{g.pinned?'Pinned · ':''}{g.name}{g.unread>0&&<span className={styles.unreadDot}>{g.unread}</span>}</strong><small>{g.preview||g.members+' members'}{g.muted?' · Muted':''}</small></span></button>)}
  </aside>
  <div className={styles.conversation} data-open={group?'true':'false'}>
   {group?<><header className={styles.conversationHeader}><div><strong>{group.name}</strong><div className={styles.subtitle}>{group.members} members</div></div><button type="button" className={styles.back} onClick={()=>setActive(null)}>Back</button></header>
    <div className={styles.actionPanel}>{group.owner&&<button type="button" onClick={()=>{setInviting(v=>!v);setCreating(false);setChosen([])}}>Invite</button>}
     {(['pinned','muted','archived'] as const).map(setting=><button key={setting} type="button" disabled={busy} onClick={()=>void action(async()=>{const {data,error}=await getSupabaseClient().rpc('vibechat_group_preference',{p_room:group.id,p_setting:setting,p_value:!group[setting]});if(error||!data)throw error;if(setting==='archived'){setArchived(!group.archived);setActive(null)}})}>{setting==='pinned'?(group.pinned?'Unpin':'Pin'):setting==='muted'?(group.muted?'Unmute':'Mute'):(group.archived?'Unarchive':'Archive')}</button>)}
     <button type="button" onClick={()=>setReporting(v=>!v)}>Report</button><button type="button" onClick={()=>setConfirmLeave(v=>!v)}>{group.owner?'Close group':'Leave'}</button>
    </div>
    {inviting&&<form className={styles.actionPanel} onSubmit={e=>{e.preventDefault();void action(async()=>{const {data,error}=await getSupabaseClient().rpc('vibechat_group_invite',{p_room:group.id,p_recipients:chosen});if(error||!data)throw error;setInviting(false);setChosen([])})}}>{candidatesView}<button type="submit" disabled={busy||!chosen.length}>Send invitations</button><button type="button" onClick={()=>setInviting(false)}>Cancel</button></form>}
    {confirmLeave&&<div className={styles.actionPanel} role="alert">{group.owner?'Close this group for all members?':'Leave this group?'} <button type="button" disabled={busy} onClick={()=>void action(async()=>{const {data,error}=await getSupabaseClient().rpc('vibechat_group_leave',{p_room:group.id});if(error||!data)throw error;setActive(null)})}>Confirm</button><button type="button" onClick={()=>setConfirmLeave(false)}>Cancel</button></div>}
    {reporting&&<form className={styles.actionPanel} onSubmit={e=>{e.preventDefault();void action(async()=>{const {data,error}=await getSupabaseClient().rpc('vibechat_group_report',{p_room:group.id,p_reason:reason});if(error||!data)throw error;setReporting(false)})}}><select aria-label="Report reason" value={reason} onChange={e=>setReason(e.target.value)}>{['safety','harassment','spam','other'].map(x=><option key={x} value={x}>{x}</option>)}</select><button type="submit" disabled={busy}>Submit report</button><button type="button" onClick={()=>setReporting(false)}>Cancel</button></form>}
    <form className={styles.actionPanel} role="search" onSubmit={e=>{e.preventDefault();setAppliedQuery(query.trim())}}><input className={styles.search} type="search" aria-label="Find in group" placeholder="Find in group" value={query} maxLength={100} onChange={e=>setQuery(e.target.value)}/><button type="submit">Find</button>{appliedQuery&&<button type="button" onClick={()=>{setQuery('');setAppliedQuery('')}}>Clear</button>}</form>
    <div className={styles.messages} aria-live="polite">
     {!done&&messages.length>0&&<button type="button" className={styles.back} disabled={pageBusy} onClick={()=>void loadMessages(group.id,appliedQuery,messages[0])}>{appliedQuery?'More results':'Load older messages'}</button>}
     {messages.length===0&&<p className={styles.empty}>{pageBusy?'Loading…':appliedQuery?'No results':'No messages yet.'}</p>}
     {messages.map(m=><div key={m.id} className={styles.bubble+(m.mine?' '+styles.mine:'')}>{!m.mine&&<strong className={styles.subtitle}>{m.sender}</strong>}<div>{m.body}</div><time className={styles.time}>{stamp(m.created_at)}{m.mine?' · Sent':''}</time></div>)}
     {!appliedQuery&&pending.map(m=><div key={m.id} className={styles.bubble+' '+styles.mine}>{m.body}<time className={styles.time}>{m.failed?'Needs attention':!outbox.online?'Queued offline':m.attempts?'Retrying…':'Sending…'}</time>{m.failed&&<div className={styles.actionRow}><button type="button" onClick={()=>outbox.retry(m.id)}>Retry</button><button type="button" onClick={()=>outbox.discard(m.id)}>Remove</button></div>}</div>)}
    </div>
    <form className={styles.compose} onSubmit={e=>{e.preventDefault();if(outbox.enqueue('group',group.id,body)){setBody('');setError('')}else setError('Could not queue message. Your draft is preserved.')}}><textarea aria-label="Group message" value={body} maxLength={1500} onChange={e=>setBody(e.target.value)} placeholder="Write a message" required/><button className={styles.primary} disabled={!body.trim()} type="submit">Send</button></form>
   </>:<div className={styles.empty}>Select a group.</div>}
  </div>
 </section>
}

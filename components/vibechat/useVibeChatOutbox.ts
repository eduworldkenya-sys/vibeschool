'use client'

import {useCallback,useEffect,useRef,useState} from 'react'
import {getSupabaseClient} from '@/lib/supabase'

export type QueuedMessage={
  id:string; owner:string; kind:'vc'|'tuition'; room:string; body:string;
  createdAt:number; attempts:number; nextAt:number; failed:boolean;
}
const storageKey='vibechat:outbox:v1'
const maxAge=24*60*60*1000
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8a-f0-9][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const retryDelay=(attempt:number)=>Math.min(60000,1000*2**Math.min(attempt,6))
function valid(x:unknown,owner:string):x is QueuedMessage{
  if(!x||typeof x!=='object')return false
  const m=x as QueuedMessage
  return m.owner===owner && uuid.test(m.id)&&uuid.test(m.room)&&
    (m.kind==='vc'||m.kind==='tuition')&&typeof m.body==='string'&&m.body.trim().length>0&&m.body.length<=1500&&
    Number.isFinite(m.createdAt)&&Date.now()-m.createdAt<maxAge&&m.createdAt<=Date.now()+60000&&
    Number.isInteger(m.attempts)&&m.attempts>=0&&Number.isFinite(m.nextAt)&&typeof m.failed==='boolean'
}
function read(owner:string):QueuedMessage[]{
  try{
    const raw=sessionStorage.getItem(storageKey)
    const value=raw?JSON.parse(raw):null
    if(value?.owner!==owner){sessionStorage.removeItem(storageKey);return []}
    return Array.isArray(value.items)?value.items.filter((m:unknown)=>valid(m,owner)).slice(0,100):[]
  }catch{return []}
}
function persist(owner:string,items:QueuedMessage[]){
  try{
    if(items.length)sessionStorage.setItem(storageKey,JSON.stringify({owner,items}))
    else sessionStorage.removeItem(storageKey)
    return true
  }catch{return false}
}

export function useVibeChatOutbox(owner:string,onCommitted:(item:QueuedMessage)=>void){
  const [items,setItems]=useState<QueuedMessage[]>([])
  const [online,setOnline]=useState(true)
  const [storageAvailable,setStorageAvailable]=useState(true)
  const queue=useRef<QueuedMessage[]>([])
  const currentOwner=useRef('')
  const commitRef=useRef(onCommitted)
  commitRef.current=onCommitted
  const inFlight=useRef<string|null>(null)
  const publish=useCallback((next:QueuedMessage[])=>{
    queue.current=next
    setItems(next)
    setStorageAvailable(persist(currentOwner.current,next))
  },[])
  useEffect(()=>{
    currentOwner.current=owner
    inFlight.current=null
    if(!owner){queue.current=[];setItems([]);return}
    const restored=read(owner)
    publish(restored)
    const db=getSupabaseClient()
    const {data:{subscription}}=db.auth.onAuthStateChange((event,session)=>{
      if(event==='SIGNED_OUT'||(session?.user&&session.user.id!==owner)){
        currentOwner.current=''
        queue.current=[]
        setItems([])
        try{sessionStorage.removeItem(storageKey)}catch{}
      }
    })
    return ()=>{subscription.unsubscribe();currentOwner.current='';inFlight.current=null}
  },[owner,publish])
  useEffect(()=>{
    const update=()=>setOnline(navigator.onLine)
    update()
    window.addEventListener('online',update);window.addEventListener('offline',update)
    return ()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update)}
  },[])
  const flush=useCallback(async()=>{
    const actor=currentOwner.current
    if(!actor||!navigator.onLine||inFlight.current)return
    // A failed entry does not prevent other conversations from progressing.
    // Preserve FIFO order within each conversation.
    const now=Date.now()
    const fresh=queue.current.filter(m=>now-m.createdAt<maxAge)
    if(fresh.length!==queue.current.length)publish(fresh)
    const firstByRoom=new Map<string,QueuedMessage>()
    for(const item of fresh){const key=item.kind+':'+item.room;if(!firstByRoom.has(key))firstByRoom.set(key,item)}
    const item=[...firstByRoom.values()].find(m=>!m.failed&&m.nextAt<=now)
    if(!item)return
    inFlight.current=item.id
    const abort=new AbortController()
    const deadline=window.setTimeout(()=>abort.abort(),15000)
    try{
      const {data,error}=await getSupabaseClient().rpc('vibechat_send_once',{p_owner:actor,p_kind:item.kind,p_room:item.room,p_operation:item.id,p_body:item.body}).abortSignal(abort.signal)
      if(currentOwner.current!==actor||inFlight.current!==item.id)return
      if(error){
        const rate=error.details==='VIBECHAT_RATE_LIMIT'||/message (?:rate )?limit reached/i.test(error.message)
        const transient=abort.signal.aborted||rate||!error.code||['PGRST000','PGRST001','PGRST002','PGRST003','PGRST202','57014','40001','40P01','08006','08000'].includes(error.code)
        const attempts=item.attempts+1
        publish(queue.current.map(m=>m.id===item.id?{...m,attempts,failed:!transient||attempts>=12,nextAt:Date.now()+(rate?65000:retryDelay(attempts))}:m))
      }else if(data){
        publish(queue.current.filter(m=>m.id!==item.id))
        commitRef.current(item)
      }else{
        const attempts=item.attempts+1
        publish(queue.current.map(m=>m.id===item.id?{...m,attempts,failed:attempts>=12,nextAt:Date.now()+retryDelay(attempts)}:m))
      }
    }catch{
      if(currentOwner.current===actor&&inFlight.current===item.id){
        const attempts=item.attempts+1
        publish(queue.current.map(m=>m.id===item.id?{...m,attempts,failed:attempts>=12,nextAt:Date.now()+retryDelay(attempts)}:m))
      }
    }finally{window.clearTimeout(deadline);if(inFlight.current===item.id)inFlight.current=null}
  },[publish])
  useEffect(()=>{
    if(!owner||!online)return
    void flush()
    const timer=window.setInterval(()=>void flush(),1000)
    return ()=>window.clearInterval(timer)
  },[owner,online,flush])
  const enqueue=useCallback((kind:'vc'|'tuition',room:string,body:string)=>{
    const actor=currentOwner.current
    const text=body.trim()
    if(!actor||!uuid.test(room)||!text||text.length>1500||queue.current.length>=100)return false
    const item:QueuedMessage={id:crypto.randomUUID(),owner:actor,kind,room,body:text,createdAt:Date.now(),attempts:0,nextAt:0,failed:false}
    publish([...queue.current,item])
    void flush()
    return true
  },[publish,flush])
  const retry=useCallback((id:string)=>{
    if(inFlight.current===id)return
    publish(queue.current.map(m=>m.id===id?{...m,failed:false,attempts:0,nextAt:0}:m))
    void flush()
  },[publish,flush])
  const discard=useCallback((id:string)=>{
    // Do not cancel an operation whose server commit may already have occurred.
    if(inFlight.current===id)return
    publish(queue.current.filter(m=>m.id!==id))
  },[publish])
  return {items:items.filter(m=>m.owner===owner),online,storageAvailable,enqueue,retry,discard}
}

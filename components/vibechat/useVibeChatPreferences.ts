'use client'
import {useCallback,useEffect,useRef,useState} from 'react'
import {getSupabaseClient} from '@/lib/supabase'
type Preference={kind:'vc'|'tuition';room_id:string;pinned:boolean;archived:boolean;muted:boolean}
type Setting='pinned'|'archived'|'muted'
type Incoming={key:string;unread:number;latestIncomingId?:string|null;muted?:boolean}

export function useVibeChatPreferences(owner:string,refreshVersion:number){
 const [preferences,setPreferences]=useState<Preference[]>([])
 const [enabled,setEnabled]=useState(false)
 const [ready,setReady]=useState(false)
 const [error,setError]=useState('')
 const seq=useRef(0)
 const ownerRef=useRef(owner)
 ownerRef.current=owner
 const load=useCallback(async()=>{
  if(!owner)return
  const request=++seq.current
  try{
   const db=getSupabaseClient()
   const [p,n]=await Promise.all([db.rpc('vibechat_my_conversation_preferences'),db.rpc('vibechat_notification_preferences',{})])
   if(request!==seq.current||ownerRef.current!==owner)return
   if(p.error||n.error){setReady(false);setError('Conversation settings are unavailable.');return}
   setPreferences(p.data??[]);setEnabled(n.data===true);setReady(true);setError('')
  }catch{if(request===seq.current&&ownerRef.current===owner){setReady(false);setError('Could not load conversation settings.')}}
 },[owner])
 useEffect(()=>{setPreferences([]);setEnabled(false);setReady(false);setError('');return()=>{seq.current++}},[owner])
 useEffect(()=>{void load()},[load,refreshVersion])
 const update=useCallback(async(kind:'vc'|'tuition',room:string,setting:Setting,value:boolean)=>{
  if(!owner||!ready)return false
  try{
   const {data,error}=await getSupabaseClient().rpc('vibechat_set_conversation_preference',{p_kind:kind,p_room:room,p_setting:setting,p_value:value})
   if(error||data!==true)throw error
   if(ownerRef.current===owner)await load()
   return true
  }catch{if(ownerRef.current===owner)setError('Could not save conversation settings.');return false}
 },[owner,ready,load])
 const toggleNotifications=useCallback(async()=>{
  if(!owner||!ready)return
  try{
   if(!enabled){
    if(!('Notification' in window)||!('serviceWorker' in navigator)){setError('This browser does not support device notifications.');return}
    if(await Notification.requestPermission()!=='granted'){setError('Notification permission was not granted.');return}
   }
   const {data,error}=await getSupabaseClient().rpc('vibechat_notification_preferences',{p_enabled:!enabled})
   if(error||typeof data!=='boolean')throw error
   if(ownerRef.current===owner)await load()
  }catch{if(ownerRef.current===owner)setError('Could not save notification preference.')}
 },[owner,ready,enabled,load])
 return {preferences,enabled,ready,error,update,toggleNotifications}
}

export function useVibeChatOpenAppNotifications(owner:string,enabled:boolean,inbox:Incoming[],ready:boolean){
 const seen=useRef<Map<string,string>>(new Map())
 const initialized=useRef(false)
 useEffect(()=>{seen.current=new Map();initialized.current=false},[owner,enabled])
 useEffect(()=>{
  if(!owner||!enabled||!ready)return
  const changed=inbox.filter(c=>c.latestIncomingId&&c.unread>0&&!c.muted&&seen.current.get(c.key)!==c.latestIncomingId)
  for(const c of inbox)if(c.latestIncomingId)seen.current.set(c.key,c.latestIncomingId)
  const first=!initialized.current
  initialized.current=true
  // Never show a backlog on first load. Keep lock-screen text generic.
  if(first||!changed.length||document.visibilityState==='visible'||!('Notification' in window)||Notification.permission!=='granted'||!('serviceWorker' in navigator))return
  void navigator.serviceWorker.getRegistration().then(registration=>registration?.showNotification('VibeChat',{body:'You have a new message.',tag:'vibechat-new-message',data:{path:'/vibechat'}})).catch(()=>{})
 },[owner,enabled,inbox,ready])
}

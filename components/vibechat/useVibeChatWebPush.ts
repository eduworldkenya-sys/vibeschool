'use client'
import {useEffect,useRef,useState} from 'react'
import {getSupabaseClient} from '@/lib/supabase'

export const PUSH_OWNER_KEY='vibechat:push-owner:v1'
export const PUSH_CHANGED_EVENT='vibechat-push-changed'
const vapid=process.env.NEXT_PUBLIC_VIBECHAT_VAPID_PUBLIC_KEY??''
function publicKey(value:string):ArrayBuffer{
 const bytes=Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'=')),c=>c.charCodeAt(0))
 if(bytes.length!==65||bytes[0]!==4)throw Error('Invalid application key')
 return bytes.buffer as ArrayBuffer
}
export async function removeLocalPush(owner?:string){
 try{
  const saved=localStorage.getItem(PUSH_OWNER_KEY)
  if(!saved||owner&&saved!==owner)return
  const registration=await navigator.serviceWorker.getRegistration()
  const subscription=await registration?.pushManager.getSubscription()
  if(subscription)await subscription.unsubscribe()
  localStorage.removeItem(PUSH_OWNER_KEY)
  window.dispatchEvent(new Event(PUSH_CHANGED_EVENT))
 }catch{/* server also checks session revocation */}
}
export function useVibeChatWebPush(owner:string,onEnabled:()=>void){
 const [registered,setRegistered]=useState(false)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const actor=useRef(owner)
 actor.current=owner
 const configured=Boolean(vapid)
 useEffect(()=>{
  let active=true
  setRegistered(false)
  if(!owner||!('serviceWorker' in navigator))return
  const inspect=async()=>{
   try{
    const registration=await navigator.serviceWorker.getRegistration()
    const subscription=await registration?.pushManager.getSubscription()
    if(active)setRegistered(Boolean(subscription&&localStorage.getItem(PUSH_OWNER_KEY)===owner))
   }catch{if(active)setRegistered(false)}
  }
  void inspect()
  window.addEventListener(PUSH_CHANGED_EVENT,inspect)
  return()=>{active=false;window.removeEventListener(PUSH_CHANGED_EVENT,inspect)}
 },[owner])
 async function toggle(){
  if(!owner||busy||!configured)return
  setBusy(true);setError('')
  const current=owner
  let created:PushSubscription|null=null
  try{
   if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))throw Error('Unsupported browser')
   const registration=await navigator.serviceWorker.getRegistration()
   if(!registration?.active)throw Error('Service worker not ready')
   let subscription=await registration.pushManager.getSubscription()
   if(registered){
    if(subscription){
     const {error}=await getSupabaseClient().rpc('vibechat_unregister_push',{p_endpoint:subscription.endpoint})
     if(error)throw error
     await subscription.unsubscribe()
    }
    localStorage.removeItem(PUSH_OWNER_KEY);setRegistered(false)
    window.dispatchEvent(new Event(PUSH_CHANGED_EVENT))
    return
   }
   if(await Notification.requestPermission()!=='granted')throw Error('Permission not granted')
   if(actor.current!==current)return
   if(subscription&&localStorage.getItem(PUSH_OWNER_KEY)!==current){await subscription.unsubscribe();subscription=null}
   if(!subscription){subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:publicKey(vapid)});created=subscription}
   const json=subscription.toJSON()
   if(!json.keys?.p256dh||!json.keys?.auth||actor.current!==current)throw Error('Subscription unavailable')
   const db=getSupabaseClient()
   const result=await db.rpc('vibechat_register_push',{p_endpoint:subscription.endpoint,p_p256dh:json.keys.p256dh,p_auth:json.keys.auth})
   if(result.error||!result.data)throw Error('Device registration failed')
   if(actor.current!==current)throw Error('Account changed')
   const enabled=await db.rpc('vibechat_notification_preferences',{p_enabled:true})
   if(enabled.error||enabled.data!==true){await db.rpc('vibechat_unregister_push',{p_endpoint:subscription.endpoint});throw Error('Notification preference failed')}
   if(actor.current!==current)throw Error('Account changed')
   localStorage.setItem(PUSH_OWNER_KEY,current)
   setRegistered(true);window.dispatchEvent(new Event(PUSH_CHANGED_EVENT));onEnabled()
  }catch{
   if(created)try{await created.unsubscribe()}catch{}
   if(actor.current===current)setError('Could not update background alerts. Check browser notification permission and retry.')
  }finally{if(actor.current===current)setBusy(false)}
 }
 return {configured,registered,busy,error,toggle}
}

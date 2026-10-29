'use client'
import {broadcastReceiverLogout} from './receiver-browser-session'
const CHANNEL='vs-wishes-pin'
const TAB_ID=Math.random().toString(36).slice(2)
export const learnerName=(value:string)=>value.trim().replace(/\s+/g,' ').toLowerCase()
/** Signals contain no names, PINs, links or account credentials. */
export function broadcastKeepsakeChange(){broadcastReceiverLogout();try{const c=new BroadcastChannel(CHANNEL);c.postMessage({source:TAB_ID});c.close()}catch{/* Storage fallback below. */}try{localStorage.setItem(CHANNEL,Date.now()+':'+Math.random())}catch{/* Verify with the server when returning to a tab. */}}
export function watchKeepsakeChange(clear:()=>void){let c:BroadcastChannel|undefined;try{c=new BroadcastChannel(CHANNEL);c.onmessage=event=>{if(event.data?.source!==TAB_ID)clear()}}catch{/* Storage fallback below. */}const storage=(e:StorageEvent)=>{if(e.key===CHANNEL)clear()};window.addEventListener('storage',storage);return()=>{c?.close();window.removeEventListener('storage',storage)}}
export type KnownInbox={id:string;name:string}
export function knownInboxes():KnownInbox[]{try{const value:unknown=JSON.parse(localStorage.getItem('vs-wish-inboxes-v1')||'[]');return Array.isArray(value)?value.filter((v):v is KnownInbox=>!!v&&typeof v==='object'&&typeof v.id==='string'&&/^[a-f0-9-]{36}$/i.test(v.id)&&typeof v.name==='string').slice(0,10):[]}catch{return []}}
export function rememberInbox(id:string,name:string){try{localStorage.setItem('vs-wish-inbox-id-v1',id);localStorage.setItem('vs-wish-inboxes-v1',JSON.stringify([{id,name},...knownInboxes().filter(v=>v.id!==id)].slice(0,10)))}catch{/* Non-secret labels are optional; the recovery link works independently. */}}

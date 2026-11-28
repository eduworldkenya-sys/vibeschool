'use client'
import {useEffect,useState} from 'react'

function clock(seconds:number){
 const n=Math.max(0,Math.floor(seconds))
 return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')
}
function useClock(){
 const [now,setNow]=useState(()=>Date.now())
 useEffect(()=>{const tick=()=>setNow(Date.now());tick();const id=window.setInterval(tick,1000);window.addEventListener('focus',tick);return()=>{window.clearInterval(id);window.removeEventListener('focus',tick)}},[])
 return now
}
// The first shared page is a server timestamp, not the time the room was opened.
export function TeachingElapsed({firstSharedAt}:{firstSharedAt?:string}){
 const now=useClock(),start=firstSharedAt?Date.parse(firstSharedAt):NaN
 return <span aria-label="Teaching elapsed" title="Wall-clock time since the first shared page, including pauses">Teaching elapsed: {Number.isFinite(start)?clock((now-start)/1000):'Not started'}</span>
}
const storageKey='vibe:live:activity-timer:v1'
type SavedTimer={roomId:string;promptId:string;deadline:number;minutes:number}
function load(roomId:string,promptId:string,minutes:number):number|null{
 try{
  const raw=sessionStorage.getItem(storageKey)
  if(!raw)return null
  const t=JSON.parse(raw) as SavedTimer
  return t.roomId===roomId&&t.promptId===promptId&&t.minutes===minutes&&Number.isFinite(t.deadline)&&t.deadline>0&&t.deadline<=Date.now()+minutes*60000+1000?t.deadline:null
 }catch{return null}
}
// Teacher-only, same-tab convenience. Never publishes, closes responses or advances slides.
export function ActivityCountdown({roomId,promptId,minutes,disabled}:{roomId:string;promptId:string;minutes:number;disabled:boolean}){
 const now=useClock()
 const [deadline,setDeadline]=useState<number|null>(null)
 useEffect(()=>{setDeadline(load(roomId,promptId,minutes))},[roomId,promptId,minutes])
 function start(){
  if(disabled||!Number.isFinite(minutes)||minutes<=0)return
  const value=Date.now()+minutes*60000
  setDeadline(value)
  try{sessionStorage.setItem(storageKey,JSON.stringify({roomId,promptId,minutes,deadline:value}))}catch{}
 }
 function clear(){
  setDeadline(null)
  try{const raw=sessionStorage.getItem(storageKey);if(raw){const t=JSON.parse(raw) as SavedTimer;if(t.roomId===roomId&&t.promptId===promptId)sessionStorage.removeItem(storageKey)}}catch{}
 }
 const remaining=deadline===null?null:Math.max(0,Math.ceil((deadline-now)/1000))
 return <span style={{display:'inline-flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
  {remaining===null?<button type="button" disabled={disabled} onClick={start}>Start activity timer · {minutes} min</button>:<>
   <span role="timer" aria-label="Activity countdown">{clock(remaining)}</span>
   {remaining===0&&<span role="status">Time is up. Continue when ready.</span>}
   <button type="button" onClick={clear}>{remaining===0?'Dismiss timer':'Stop timer'}</button>
  </>}
 </span>
}

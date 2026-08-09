"use client"

import { useEffect, useState } from "react"

export default function HQOfflineStatus(){
  const[offline,setOffline]=useState(false);const[lastOnline,setLastOnline]=useState<number|null>(null)
  useEffect(()=>{let timer:ReturnType<typeof setInterval>|null=null;async function probe(){if(!navigator.onLine){setOffline(true);return}try{await fetch('/api/ping',{method:'HEAD',signal:AbortSignal.timeout(4000),cache:'no-store'});setOffline(false);setLastOnline(Date.now())}catch{setOffline(true)}}void probe();timer=setInterval(()=>void probe(),30000);const on=()=>void probe();const off=()=>setOffline(true);window.addEventListener('online',on);window.addEventListener('offline',off);return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off);if(timer)clearInterval(timer)}},[])
  if(!offline)return null
  return <div role="status" aria-live="polite" style={{position:'sticky',top:45,zIndex:95,padding:'8px 12px',background:'#7c2d12',color:'#ffedd5',borderBottom:'1px solid rgba(255,255,255,.12)',textAlign:'center',font:'700 11px Inter,system-ui,sans-serif'}}>Offline mode · showing last-known HQ data where available. Authority-changing actions require connection.{lastOnline?` Last online ${new Date(lastOnline).toLocaleTimeString('en-KE')}.`:''}</div>
}

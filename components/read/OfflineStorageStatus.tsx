'use client'

import { useEffect, useState } from 'react'

type StorageInfo = {used:number;quota:number;persistent:boolean|null}
const formatBytes=(value:number)=>value>=1024*1024*1024?`${(value/1024/1024/1024).toFixed(1)} GB`:`${Math.round(value/1024/1024)} MB`

export default function OfflineStorageStatus(){
  const [online,setOnline]=useState(true)
  const [storage,setStorage]=useState<StorageInfo|null>(null)
  const [status,setStatus]=useState('')
  const refresh=async()=>{
    if (!navigator.storage?.estimate) return
    try {
      const estimate=await navigator.storage.estimate()
      const persistent=typeof navigator.storage.persisted==='function'?await navigator.storage.persisted():null
      setStorage({used:estimate.usage||0,quota:estimate.quota||0,persistent})
    } catch {setStorage(null)}
  }
  useEffect(()=>{
    const update=()=>setOnline(navigator.onLine)
    update()
    void refresh()
    window.addEventListener('online',update)
    window.addEventListener('offline',update)
    return ()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update)}
  },[])
  const protect=async()=>{
    if (typeof navigator.storage?.persist!=='function') {
      setStatus('This browser does not offer persistent storage. Keep important work synced online.')
      return
    }
    try {
      const granted=await navigator.storage.persist()
      setStatus(granted?'Storage protection enabled on this device.':'Browser declined persistent storage. Downloaded books may be cleared if storage is low.')
      await refresh()
    } catch {setStatus('Storage protection could not be enabled on this device.')}
  }
  return <section aria-label="Offline storage" style={{border:'1px solid #344053',borderRadius:14,padding:14,background:'#121c2c',margin:'12px 0 18px'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
      <strong style={{fontSize:13}}>Device downloads</strong>
      <span style={{fontSize:12,color:online?'#b9ebc7':'#f5ca88'}}>{online?'Connected':'Offline — saved books available'}</span>
    </div>
    {storage&&<p style={{fontSize:12,color:'#b6c8dc',margin:'7px 0'}}>App storage: {formatBytes(storage.used)} used{storage.quota>0?` of roughly ${formatBytes(storage.quota)} allowed`:''} · {storage.persistent?'Protected from automatic storage cleanup':'Browser may clear downloads'}</p>}
    {!storage?.persistent&&<button type="button" onClick={()=>void protect()} style={{background:'#233952',color:'#f3fbff',border:'1px solid #49637d',borderRadius:9,minHeight:40,padding:'8px 12px',fontWeight:700}}>Protect downloads on this phone</button>}
    {status&&<p role="status" style={{fontSize:12,color:'#d0dbe9',margin:'8px 0 0'}}>{status}</p>}
  </section>
}

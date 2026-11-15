'use client'

import { useEffect, useState } from 'react'

type State = 'idle' | 'downloading' | 'ready' | 'error'
export default function OfflineGamesPack() {
  const [state, setState] = useState<State>('idle')
  const [online, setOnline] = useState(true)
  const [detail, setDetail] = useState('')
  useEffect(() => {
    setOnline(navigator.onLine)
    const sync = () => setOnline(navigator.onLine)
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => { window.removeEventListener('online', sync); window.removeEventListener('offline', sync) }
  }, [])
  const prepare = async () => {
    if (!navigator.onLine || !('serviceWorker' in navigator)) {
      setState('error'); setDetail('Connect to the internet and use a browser that supports offline apps.')
      return
    }
    setState('downloading'); setDetail('Saving public game pages and files on this device.')
    try {
      const registration = await navigator.serviceWorker.ready
      const worker = registration.active
      if (!worker) throw new Error('Offline service is not active. Refresh the page.')
      const channel = new MessageChannel()
      const result = await new Promise<{type:string;message?:string;routes?:number} >((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('Download did not finish. Check your connection.')), 120000)
        channel.port1.onmessage = event => { window.clearTimeout(timeout); resolve(event.data) }
        worker.postMessage({ type:'PREPARE_OFFLINE_GAMES' }, [channel.port2])
      })
      if (result.type !== 'OFFLINE_GAMES_READY') throw new Error(result.message || 'Offline preparation failed.')
      setState('ready')
      setDetail('Saved public games on this device. Test in airplane mode before relying on them. Projects remain in this browser.')
    } catch (error) {
      setState('error')
      setDetail(error instanceof Error ? error.message : 'Download failed.')
    }
  }
  return <section aria-label="Offline games" style={{margin:'18px 0',border:'1px solid #4e6580',borderRadius:18,padding:18,background:'#0d1b31',color:'#f3faff'}}>
    <div style={{fontSize:12,letterSpacing:'.1em',color:'#7de5d3',fontWeight:800}}>OFFLINE GAMES</div>
    <h2 style={{fontSize:20,margin:'6px 0'}}>Play without an internet bundle</h2>
    <p style={{fontSize:13,lineHeight:1.6,color:'#bed0e5'}}>While connected, save VibeSpin, VibeCoin, VibeSphere and VibeGames for offline use. This stores public game files only, not student accounts, private lessons, or payments.</p>
    <button type="button" disabled={state==='downloading'||!online} onClick={()=>void prepare()} style={{marginTop:12,padding:'12px 18px',background:'#7de5d3',color:'#082033',border:0,borderRadius:10,fontWeight:850,cursor:state==='downloading'?'wait':'pointer'}}>
      {state==='downloading'?'Preparing offline games…':state==='ready'?'Refresh offline games':'Save games for offline'}
    </button>
    <div role="status" aria-live="polite" style={{marginTop:10,color:state==='error'?'#ffb7b7':'#bed0e5',fontSize:12}}>{!online?'Offline now · Use already saved games.':detail}</div>
  </section>
}

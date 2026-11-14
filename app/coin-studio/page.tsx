'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { DirectorControls, DirectorStageEffects, focalStyle, useShowDirector } from '../../components/games/ShowDirector'
import styles from './coin-studio.module.css'

type Side = 'heads' | 'tails'
type Phase = 'idle' | 'countdown' | 'flipping' | 'ready' | 'reveal'
type Theme = 'royal' | 'neon' | 'arena' | 'sunset'
type Aspect = 'portrait' | 'landscape' | 'square'
type CoinStyle = 'gold' | 'silver' | 'copper' | 'neon'
type TossAxis = 'vertical' | 'horizontal'
type Tab = 'matchup' | 'appearance' | 'show' | 'director' | 'production'
type Option = { name: string; subtitle: string; logo: string; symbol: string; color: string }
type Setup = {
  id: string; name: string; headline: string; cta: string; heads: Option; tails: Option;
  theme: Theme; coinStyle: CoinStyle; aspect: Aspect; tossAxis: TossAxis; autoStart: boolean; duration: number; countdown: number;
  automatic: boolean; batch: boolean; hold: number; sound: boolean; volume: number;
  confetti: boolean; spotlight: boolean; showBrand: boolean; showLogos: boolean; showSafeArea: boolean;
  episode: number; backgroundImage: string
}
const STORE = 'vibeschool.vibecoin.studio.v1'
const makeId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const initial = (): Setup => ({
  id: makeId(), name: 'The Football Coin Toss', headline: 'ARSENAL OR MAN UNITED?', cta: 'Did the coin agree with you? Comment below.',
  heads: { name: 'ARSENAL', subtitle: 'HEADS', logo: '', symbol: 'A', color: '#ff315c' },
  tails: { name: 'MANCHESTER UNITED', subtitle: 'TAILS', logo: '', symbol: 'M', color: '#00c9f0' },
  theme: 'royal', coinStyle: 'gold', aspect: 'portrait', tossAxis: 'vertical', autoStart: true, duration: 4, countdown: 2,
  automatic: true, batch: false, hold: 3, sound: true, volume: 65, confetti: true,
  spotlight: true, showBrand: true, showLogos: true, showSafeArea: false, episode: 1, backgroundImage: ''
})
const templates: { title: string; headline: string; a: string; b: string; symbols: [string,string] }[] = [
  { title: 'Football rivalry', headline: 'WHO TAKES THE WIN?', a: 'ARSENAL', b: 'MANCHESTER UNITED', symbols: ['A','M'] },
  { title: 'This or that', headline: 'YOU CAN ONLY PICK ONE', a: 'THIS', b: 'THAT', symbols: ['1','2'] },
  { title: 'Yes or no', headline: 'LET THE COIN DECIDE', a: 'YES', b: 'NO', symbols: ['✓','✕'] },
  { title: 'Kenya challenge', headline: 'KENYA OR UGANDA?', a: 'KENYA', b: 'UGANDA', symbols: ['KE','UG'] },
  { title: 'Learning challenge', headline: 'WHAT WILL YOU PRACTISE?', a: 'MATHEMATICS', b: 'ENGLISH', symbols: ['∑','Aa'] }
]
const randomSide = (): Side => {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(1)
    crypto.getRandomValues(bytes)
    return bytes[0] % 2 === 0 ? 'heads' : 'tails'
  }
  return Math.random() < .5 ? 'heads' : 'tails'
}
function valid(input: unknown): input is Setup {
  if (!input || typeof input !== 'object') return false
  const s = input as Record<string,unknown>
  const side = (v: unknown) => !!v && typeof v === 'object' && ['name','subtitle','logo','symbol','color'].every(k => typeof (v as Record<string,unknown>)[k] === 'string')
  return typeof s.id === 'string' && typeof s.name === 'string' && typeof s.headline === 'string' &&
    typeof s.cta === 'string' && side(s.heads) && side(s.tails) &&
    ['royal','neon','arena','sunset'].includes(String(s.theme)) && ['gold','silver','copper','neon'].includes(String(s.coinStyle)) &&
    ['portrait','landscape','square'].includes(String(s.aspect)) && typeof s.duration === 'number' &&
    typeof s.countdown === 'number' && typeof s.automatic === 'boolean' && typeof s.hold === 'number' &&
    typeof s.sound === 'boolean' && typeof s.volume === 'number' && typeof s.episode === 'number'
}
const safe = (s: Setup): Setup => ({
  ...s, duration: Math.max(2,Math.min(9,s.duration)), countdown: Math.max(0,Math.min(10,s.countdown)),
  hold: Math.max(1,Math.min(12,s.hold)), volume: Math.max(0,Math.min(100,s.volume)),
  episode: Math.max(1,Math.min(9999,s.episode)), batch: Boolean(s.batch), confetti: Boolean(s.confetti),
  spotlight: Boolean(s.spotlight), tossAxis: s.tossAxis === 'horizontal' ? 'horizontal' : 'vertical', autoStart: s.autoStart !== false, showBrand: s.showBrand !== false,
  showLogos: s.showLogos !== false, showSafeArea: Boolean(s.showSafeArea),
  backgroundImage: typeof s.backgroundImage === 'string' && s.backgroundImage.length < 350000 ? s.backgroundImage : ''
})
function ping(type: 'tick' | 'toss' | 'win', volume: number) {
  try {
    const ctx = new AudioContext()
    const frequencies = type === 'tick' ? [420] : type === 'toss' ? [235,305] : [520,660,880]
    frequencies.forEach((hz,i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain()
      const t = ctx.currentTime + i * .11
      osc.type = type === 'toss' ? 'triangle' : 'sine'
      osc.frequency.setValueAtTime(hz,t)
      gain.gain.setValueAtTime(.0001,t)
      gain.gain.exponentialRampToValueAtTime((volume/100) * (type === 'tick' ? .026 : .085) + .0001,t+.015)
      gain.gain.exponentialRampToValueAtTime(.0001,t+.15)
      osc.connect(gain); gain.connect(ctx.destination); osc.start(t); osc.stop(t+.17)
    })
    window.setTimeout(() => { void ctx.close().catch(() => {}) }, 1000)
  } catch { /* audio is optional */ }
}
export default function CoinStudio() {
  const { settings: director, patch: updateDirector } = useShowDirector('coin')
  const [setups,setSetups] = useState<Setup[]>([])
  const [selectedId,setSelectedId] = useState('')
  const [loaded,setLoaded] = useState(false)
  const [tab,setTab] = useState<Tab>('matchup')
  const [showMode,setShowMode] = useState(false)
  const [phase,setPhase] = useState<Phase>('idle')
  const [seconds,setSeconds] = useState<number | null>(null)
  const [winner,setWinner] = useState<Side | null>(null)
  const [rotation,setRotation] = useState(0)
  const [dragging,setDragging] = useState(false)
  const [history,setHistory] = useState<{name:string;side:Side}[]>([])
  const [recording,setRecording] = useState(false)
  const [notice,setNotice] = useState('')
  const [reduceMotion,setReduceMotion] = useState(false)
  const [autoRuns,setAutoRuns] = useState(0)
  const stageRef = useRef<HTMLDivElement>(null)
  const coinRef = useRef<HTMLDivElement>(null)
  const flightRef = useRef<HTMLDivElement>(null)
  const motionRef = useRef<Animation[]>([])
  const dragRef = useRef<{pointerId:number;startX:number;startY:number;angle:number;moved:boolean}|null>(null)
  const suppressClickRef = useRef(false)
  const pendingRef = useRef<Side | null>(null)
  const timers = useRef<number[]>([])
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const current = setups.find(s => s.id === selectedId) || setups[0]
  const idle = phase === 'idle' || phase === 'reveal'
  const schedule = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn,ms)) }
  const cancel = () => {
    timers.current.forEach(window.clearTimeout); timers.current = []
    motionRef.current.forEach(animation => animation.cancel()); motionRef.current = []
    if (flightRef.current) flightRef.current.style.transform = ''
  }
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('a') && params.has('b')) {
      const setup = initial()
      setup.heads.name = (params.get('a') || setup.heads.name).slice(0,46)
      setup.tails.name = (params.get('b') || setup.tails.name).slice(0,46)
      setup.headline = (params.get('hook') || setup.headline).slice(0,100)
      setup.name = setup.heads.name + ' vs ' + setup.tails.name
      setSetups([setup]); setSelectedId(setup.id); setLoaded(true); return
    }
    try {
      const raw = localStorage.getItem(STORE)
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') {
          const data = parsed as { setups?:unknown; selectedId?:unknown }
          if (Array.isArray(data.setups)) {
            const good = data.setups.filter(valid).map(safe).slice(0,30)
            if (good.length) { setSetups(good); setSelectedId(good.some(s => s.id === data.selectedId) ? String(data.selectedId) : good[0].id); setLoaded(true); return }
          }
        }
      }
    } catch { /* corrupt or blocked browser storage */ }
    const setup = initial(); setSetups([setup]); setSelectedId(setup.id); setLoaded(true)
  },[])
  useEffect(() => { if (!loaded) return; try { localStorage.setItem(STORE,JSON.stringify({setups,selectedId})) } catch { setNotice('Browser storage unavailable. Export the setup to keep a backup.') } },[setups,selectedId,loaded])
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => setReduceMotion(query.matches)
    change(); query.addEventListener('change',change)
    return () => query.removeEventListener('change',change)
  },[])
  useEffect(() => () => { cancel(); if (recorderRef.current?.state === 'recording') recorderRef.current.stop(); streamRef.current?.getTracks().forEach(t => t.stop()) },[])
  const patch = (change: Partial<Setup>) => setSetups(old => old.map(s => s.id === selectedId ? {...s,...change} : s))
  const patchOption = (side: Side, change: Partial<Option>) => { if (current) patch({ [side]: { ...current[side], ...change } }) }
  const reset = () => { cancel(); dragRef.current=null; setDragging(false); pendingRef.current=null; setPhase('idle'); setSeconds(null); setWinner(null); setRotation(0); setAutoRuns(0) }
  const selectSetup = (id: string) => { reset(); setSelectedId(id); setHistory([]) }
  const revealChoice = (choice: Side) => {
    if (!current || pendingRef.current !== choice) return
    setWinner(choice); setPhase('reveal')
    setHistory(old => [{side:choice,name:current[choice].name},...old].slice(0,60))
    if (current.sound) ping('win',current.volume)
    pendingRef.current = null
  }
  const onCoinPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (phase==='flipping' || phase==='countdown' || phase==='ready') return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,angle:rotation,moved:false}
    suppressClickRef.current=false
    setDragging(true)
  }
  const onCoinPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag=dragRef.current
    if (!drag || drag.pointerId!==e.pointerId) return
    const dx=e.clientX-drag.startX, dy=e.clientY-drag.startY
    // Both horizontal and vertical swipes work in either toss direction.
    const delta=Math.abs(dx)>Math.abs(dy)?dx:dy
    if(Math.abs(delta)>5) drag.moved=true
    if(drag.moved) {
      e.preventDefault()
      // Roughly half a coin-diameter of movement reveals the reverse face.
      setRotation(drag.angle+delta*1.55)
    }
  }
  const onCoinPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag=dragRef.current
    if (!drag || drag.pointerId!==e.pointerId) return
    suppressClickRef.current=drag.moved
    dragRef.current=null
    setDragging(false)
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)
  }
  const viewCoinSide = (side:Side) => {
    if(!idle) return
    cancel()
    pendingRef.current=null
    setWinner(null);setPhase('idle')
    // Previewing a side is a camera operation, not a game outcome.
    setRotation(value=>value+((side==='heads'?0:180)-((value%360)+360)%360+360)%360)
  }
  const toss = useCallback(() => {
    if (!current || (phase !== 'idle' && phase !== 'reveal')) return
    cancel(); dragRef.current=null; setDragging(false); setWinner(null); setSeconds(null)
    const choice = randomSide()
    pendingRef.current = choice
    const finish = () => {
      setPhase('flipping')
      const axis = current.tossAxis === 'horizontal' ? 'Y' : 'X'
      const turns = 6 + Math.floor(Math.random()*2)
      const desiredFace = choice === 'heads' ? 0 : 180
      const alignment = (desiredFace - ((rotation % 360) + 360) % 360 + 360) % 360
      const targetAngle = rotation + turns * 360 + alignment
      const rotate = (angle: number) => 'rotate' + axis + '(' + angle + 'deg)'
      const duration = reduceMotion ? 0 : current.duration * 1000
      if (coinRef.current && !reduceMotion) {
        // Web Animations start immediately from the actual DOM node; no React
        // repaint race can silently skip the launch or intermediate coin faces.
        const spin = coinRef.current.animate(
          [{ transform: rotate(rotation) }, { transform: rotate(targetAngle) }],
          { duration, easing: 'cubic-bezier(.14,.62,.22,1)', fill: 'forwards' }
        )
        motionRef.current.push(spin)
        spin.onfinish = () => {
          if (coinRef.current) coinRef.current.style.transform = rotate(targetAngle)
          setRotation(targetAngle)
          spin.cancel()
          motionRef.current = motionRef.current.filter(animation => animation !== spin)
        }
        if (flightRef.current) {
          const travel = current.tossAxis === 'horizontal'
            ? [
                {transform:'translate3d(0,22%,0) scale(.88)',offset:0},
                {transform:'translate3d(-55%,-42%,0) scale(1.13)',offset:.34},
                {transform:'translate3d(28%,-26%,0) scale(1.06)',offset:.62},
                {transform:'translate3d(0,8%,0) scale(1.02)',offset:.84},
                {transform:'translate3d(0,-8%,0) scale(.99)',offset:.93},
                {transform:'translate3d(0,0,0) scale(1)',offset:1}
              ]
            : [
                {transform:'translate3d(0,28%,0) scale(.88)',offset:0},
                {transform:'translate3d(0,-85%,0) scale(1.14)',offset:.37},
                {transform:'translate3d(0,-34%,0) scale(1.08)',offset:.67},
                {transform:'translate3d(0,8%,0) scale(1.03)',offset:.84},
                {transform:'translate3d(0,-10%,0) scale(.99)',offset:.93},
                {transform:'translate3d(0,0,0) scale(1)',offset:1}
              ]
          const flight = flightRef.current.animate(travel,{duration, easing:'ease-in-out',fill:'forwards'})
          motionRef.current.push(flight)
          flight.onfinish = () => {
            if (flightRef.current) flightRef.current.style.transform = ''
            flight.cancel()
            motionRef.current = motionRef.current.filter(animation => animation !== flight)
          }
        }
      } else {
        setRotation(targetAngle)
      }
      if (current.sound) ping('toss',current.volume)
      schedule(() => {
        if (current.automatic) revealChoice(choice)
        else setPhase('ready')
      },duration + 350)
    }
    if (current.countdown === 0) { finish(); return }
    setPhase('countdown'); setSeconds(current.countdown)
    for (let i=0;i<current.countdown;i++) schedule(() => { setSeconds(current.countdown-i); if(current.sound) ping('tick',current.volume) },i*1000)
    schedule(finish,current.countdown*1000)
  },[current,phase,reduceMotion,rotation])
  const tossRef = useRef(toss)
  useEffect(() => { tossRef.current = toss },[toss])
  // Start the first show toss without any extra button press when enabled.
  // Browsers may suppress automatic sound until the viewer interacts.
  useEffect(() => {
    if (!showMode || !current?.autoStart || phase !== 'idle') return
    const timer = window.setTimeout(() => tossRef.current(), 950)
    return () => window.clearTimeout(timer)
  },[showMode, current?.autoStart, selectedId, phase])
  // Automatic replay is deliberately bounded for a single batch (max 20).
  useEffect(() => {
    if (!current?.automatic || !current.batch || phase !== 'reveal' || autoRuns >= 19 || recording) return
    const timer = window.setTimeout(() => { setAutoRuns(i=>i+1); tossRef.current() },current.hold*1000)
    return () => window.clearTimeout(timer)
  },[current,phase,autoRuns,recording])
  const upload = (file: File | undefined, side?: Side) => {
    if (!file) return
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 180000) { setNotice('Use PNG, JPG or WebP under 180 KB.'); return }
    const reader = new FileReader()
    reader.onload = () => { if(typeof reader.result !== 'string') return; if(side) patchOption(side,{logo:reader.result}); else patch({backgroundImage:reader.result}) }
    reader.readAsDataURL(file)
  }
  const duplicate = () => { if(!current) return; const copy = {...current,id:makeId(),name:current.name+' — Copy'}; setSetups(old=>[...old,copy].slice(-30)); selectSetup(copy.id) }
  const applyTemplate = (i:number) => {
    const t = templates[i]; if(!t || !current) return
    reset(); patch({name:t.title,headline:t.headline,heads:{...current.heads,name:t.a,symbol:t.symbols[0],logo:''},tails:{...current.tails,name:t.b,symbol:t.symbols[1],logo:''}})
  }
  const downloadSetup = () => { if(!current)return;const url=URL.createObjectURL(new Blob([JSON.stringify(current,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='vibecoin-'+current.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000) }
  const importSetup = async (file?:File) => {
    if(!file)return
    try {
      if(file.size>500000)throw Error('Setup file is too large.')
      const parsed: unknown=JSON.parse(await file.text())
      if(!valid(parsed))throw Error('Unsupported VibeCoin setup.')
      const copy={...safe(parsed),id:makeId()}
      setSetups(old=>[...old,copy].slice(-30));selectSetup(copy.id);setNotice('Imported as a separate editable version.')
    } catch(error) {setNotice(error instanceof Error?error.message:'Could not import setup.')}
  }
  const record = async () => {
    if(recording) { if(recorderRef.current?.state==='recording')recorderRef.current.stop();return }
    try {
      if(!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder==='undefined') throw Error('Tab recording is unsupported in this browser.')
      const stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:30},audio:true})
      streamRef.current=stream;chunksRef.current=[]
      const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(x=>MediaRecorder.isTypeSupported(x))
      const recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined)
      recorderRef.current=recorder
      recorder.ondataavailable=e=>{if(e.data.size)chunksRef.current.push(e.data)}
      recorder.onstop=()=>{
        const video=new Blob(chunksRef.current,{type:recorder.mimeType || 'video/webm'})
        if(video.size){const url=URL.createObjectURL(video);const a=document.createElement('a');a.href=url;a.download='vibecoin-episode-'+(current?.episode||1)+'.webm';a.click();setTimeout(()=>URL.revokeObjectURL(url),15000)}
        stream.getTracks().forEach(t=>t.stop());streamRef.current=null;recorderRef.current=null;setRecording(false)
      }
      stream.getVideoTracks().forEach(t=>{t.onended=()=>{if(recorder.state!=='inactive')recorder.stop()}})
      recorder.start(250);setRecording(true);setNotice('Recording. Select this browser tab and enable tab audio for sound.')
    } catch(error) {setNotice(error instanceof Error?error.message:'Recording could not start.')}
  }
  const share = async () => {
    if(!current)return
    const url = new URL(window.location.href)
    url.searchParams.set('a',current.heads.name)
    url.searchParams.set('b',current.tails.name)
    url.searchParams.set('hook',current.headline)
    try { await navigator.clipboard.writeText(url.toString());setNotice('Studio link copied. Matchup names and headline are in the URL; images and other settings stay in this browser.') }
    catch {setNotice(url.toString())}
  }
  const renderOption = (side:Side) => {
    if(!current)return null
    const option=current[side]
    return <div className={styles.optionEditor}><div className={styles.optionTitle}><span className={styles.sideDot} style={{background:option.color}}/>{side==='heads'?'SIDE A · HEADS':'SIDE B · TAILS'}</div>
      <label>Name<input maxLength={46} value={option.name} onChange={e=>patchOption(side,{name:e.target.value})}/></label>
      <label>Small caption<input maxLength={50} value={option.subtitle} onChange={e=>patchOption(side,{subtitle:e.target.value})}/></label>
      <div className={styles.two}><label>Coin symbol<input maxLength={3} value={option.symbol} onChange={e=>patchOption(side,{symbol:e.target.value})}/></label><label>Accent<input type="color" value={option.color} onChange={e=>patchOption(side,{color:e.target.value})}/></label></div>
      <label>Upload logo <small>(PNG / JPG / WebP, 180 KB)</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{upload(e.target.files?.[0],side);e.target.value=''}}/></label>
      {option.logo && <button className={styles.small} onClick={()=>patchOption(side,{logo:''})}>Remove logo</button>}
    </div>
  }
  if(!loaded || !current) return <main className={styles.page}>Loading VibeCoin Studio…</main>
  const showRotation = rotation
  const phaseStyle = phase==='flipping'?'action':phase==='reveal'?'reveal':'idle'
  return <main className={styles.page}>
    <div className={styles.shell}>
      {!showMode && <header className={styles.header}>
        <div><span className={styles.kicker}>VIBESCHOOL ORIGINALS / GAME CREATOR</span><h1>Vibe<span>Coin</span><em>STUDIO</em></h1><p>Two sides. One unforgettable reveal.</p></div>
        <div className={styles.headActions}><a href="/marketing-studio" style={{color:'#80f3d8',fontWeight:850,fontSize:12}}>All Marketing Studio tools</a><span>UNLISTED · SAVED IN YOUR BROWSER</span><button className={styles.primary} onClick={()=>setShowMode(true)}>Launch show ↗</button></div>
      </header>}
      <div className={showMode?styles.showLayout:styles.layout}>
        {!showMode && <aside className={styles.sidebar}>
          <nav className={styles.tabs} aria-label="VibeCoin editor">
            {(['matchup','appearance','show','director','production'] as const).map(t=><button key={t} className={tab===t?styles.active:''} onClick={()=>setTab(t)}>{t==='matchup'?'Matchup':t==='appearance'?'Design':t==='show'?'Effects':t==='director'?'Camera':'Produce'}</button>)}
          </nav>
          <div className={styles.controls}>
            {tab==='matchup' && <>
              <h2>Build your matchup</h2>
              <label>Saved games<select value={selectedId} onChange={e=>selectSetup(e.target.value)}>{setups.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              <div className={styles.two}><button onClick={duplicate}>+ Save version</button><button disabled={setups.length<2} onClick={()=>{const next=setups.filter(s=>s.id!==selectedId);setSetups(next);selectSetup(next[0].id)}}>Delete version</button></div>
              <label>Choose a starter scene<select value="" onChange={e=>applyTemplate(Number(e.target.value))}><option value="" disabled>Pick a template…</option>{templates.map((t,i)=><option value={i} key={t.title}>{t.title}</option>)}</select></label>
              <label>Episode title<input maxLength={90} value={current.name} onChange={e=>patch({name:e.target.value})}/></label>
              <label>Big opening hook<input maxLength={100} value={current.headline} onChange={e=>patch({headline:e.target.value})}/></label>
              {renderOption('heads')}{renderOption('tails')}
              <label>Closing call to action<input maxLength={110} value={current.cta} onChange={e=>patch({cta:e.target.value})}/></label>
            </>}
            {tab==='appearance' && <>
              <h2>Art direction</h2>
              <label>Stage theme<select value={current.theme} onChange={e=>patch({theme:e.target.value as Theme})}><option value="royal">Midnight Royale</option><option value="neon">Electric Neon</option><option value="arena">Sports Arena</option><option value="sunset">Sunset Pop</option></select></label>
              <label>Distinct coin-face palettes</label>
              <div className={styles.paletteRow} role="group" aria-label="Two-sided coin colour presets">
                {([{name:'Crimson / Cyan',a:'#ff315c',b:'#00c9f0'},{name:'Gold / Violet',a:'#ffb900',b:'#7040e8'},{name:'Lime / Magenta',a:'#a9f51b',b:'#ff30c8'},{name:'Orange / Ocean',a:'#ff7300',b:'#0679e7'}] as const).map(pair=><button type="button" key={pair.name} className={styles.paletteButton} onClick={()=>patch({heads:{...current.heads,color:pair.a},tails:{...current.tails,color:pair.b}})} title={pair.name}><span style={{background:pair.a}}/><span style={{background:pair.b}}/><small>{pair.name}</small></button>)}
              </div>
              <p className={styles.hint}>Each face has its own solid colour identity and decorative pattern. You can still choose custom colours under Matchup.</p>
              <label>Coin material<select value={current.coinStyle} onChange={e=>patch({coinStyle:e.target.value as CoinStyle})}><option value="gold">24K Gold</option><option value="silver">Chrome Silver</option><option value="copper">Warm Copper</option><option value="neon">Electric Glass</option></select></label>
              <label>Video canvas<select value={current.aspect} onChange={e=>patch({aspect:e.target.value as Aspect})}><option value="portrait">9:16 TikTok / Shorts</option><option value="landscape">16:9 YouTube / TV</option><option value="square">1:1 Square</option></select></label>
              <label>Custom background <small>(180 KB max)</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{upload(e.target.files?.[0]);e.target.value=''}}/></label>
              {current.backgroundImage && <button onClick={()=>patch({backgroundImage:''})}>Remove background</button>}
              <label>Episode number<input type="number" min="1" max="9999" value={current.episode} onChange={e=>patch({episode:Math.max(1,Math.min(9999,Number(e.target.value)||1))})}/></label>
              <label className={styles.check}><input type="checkbox" checked={current.showBrand} onChange={e=>patch({showBrand:e.target.checked})}/> Show VibeSchool branding</label>
              <label className={styles.check}><input type="checkbox" checked={current.showLogos} onChange={e=>patch({showLogos:e.target.checked})}/> Show uploaded logos</label>
              <label className={styles.check}><input type="checkbox" checked={current.showSafeArea} onChange={e=>patch({showSafeArea:e.target.checked})}/> Editing-only safe area guide</label>
            </>}
            {tab==='show' && <>
              <h2>Motion & suspense</h2>
              <label>Toss direction<select value={current.tossAxis} disabled={phase==='flipping'||phase==='countdown'} onChange={e=>{reset();patch({tossAxis:e.target.value as TossAxis})}}><option value="vertical">Up / down · vertical flip</option><option value="horizontal">Left / right · side flip</option></select></label>
              <label className={styles.check}><input type="checkbox" checked={current.autoStart} onChange={e=>patch({autoStart:e.target.checked})}/> Start automatically when Show Mode opens</label>
              <p className={styles.hint}>You can also tap the coin stage to toss. Automatic start may be silent until the first user interaction due to browser audio restrictions.</p>
              <label>Toss duration: {current.duration}s<input type="range" min="2" max="9" value={current.duration} onChange={e=>patch({duration:Number(e.target.value)})}/></label>
              <label>Countdown: {current.countdown}s<input type="range" min="0" max="10" value={current.countdown} onChange={e=>patch({countdown:Number(e.target.value)})}/></label>
              <label>Result hold: {current.hold}s<input type="range" min="1" max="12" value={current.hold} onChange={e=>patch({hold:Number(e.target.value)})}/></label>
              <label className={styles.check}><input type="checkbox" checked={current.automatic} onChange={e=>patch({automatic:e.target.checked})}/> Automatic result reveal</label>
              <label className={styles.check}><input type="checkbox" checked={current.batch} onChange={e=>{setAutoRuns(0);patch({batch:e.target.checked})}}/> Auto-repeat after reveal (max 20)</label>
              <label className={styles.check}><input type="checkbox" checked={current.sound} onChange={e=>patch({sound:e.target.checked})}/> Sound design</label>
              <label>Sound volume: {current.volume}%<input type="range" min="0" max="100" value={current.volume} onChange={e=>patch({volume:Number(e.target.value)})}/></label>
              <label className={styles.check}><input type="checkbox" checked={current.spotlight} onChange={e=>patch({spotlight:e.target.checked})}/> Winner spotlight</label>
              <label className={styles.check}><input type="checkbox" checked={current.confetti} onChange={e=>patch({confetti:e.target.checked})}/> Celebration confetti</label>
              <button onClick={()=>ping('win',current.volume)}>Preview reveal sound</button>
            </>}
            {tab==='director' && <><h2>Camera & Show Director</h2><DirectorControls settings={director} onChange={updateDirector}/><p className={styles.hint}>Auto mode stages the toss from wide → tracking → close. Camera changes never influence the fair outcome.</p></>}
            {tab==='production' && <>
              <h2>Record & publish</h2>
              <p className={styles.hint}>Launch Show for an uncluttered recording. Select the current browser tab and allow tab audio to include effects.</p>
              <button className={styles.primary} onClick={()=>setShowMode(true)}>Open recording stage</button>
              <button onClick={()=>{void record()}}>{recording?'Stop & download video':'● Start tab recording'}</button>
              <button onClick={downloadSetup}>Export setup JSON</button>
              <label className={styles.fileButton}>Import VibeCoin setup<input type="file" accept=".json,application/json" onChange={e=>{void importSetup(e.target.files?.[0]);e.target.value=''}}/></label>
              <button onClick={()=>{void share()}}>Copy studio URL</button>
              <button onClick={()=>{void navigator.clipboard.writeText(current.headline+'\n'+current.cta+'\n#VibeSchool #VibeCoin #CoinToss').then(()=>setNotice('Caption copied.')).catch(()=>setNotice('Copy unavailable in this browser.'))}}>Copy video caption</button>
              <h3>Session results</h3><p className={styles.hint}>{history.length} tosses · Heads {history.filter(h=>h.side==='heads').length} · Tails {history.filter(h=>h.side==='tails').length}</p>
              <div className={styles.history}>{history.slice(0,12).map((h,i)=><div key={i}><b>{h.name}</b><span>{h.side}</span></div>)}</div>
              <button onClick={()=>setHistory([])} disabled={!history.length}>Clear session history</button>
            </>}
          </div>
        </aside>}
        <section className={styles.preview} aria-label="VibeCoin stage">
          {!showMode && <div className={styles.previewBar}><span><i/> LIVE EDITING PREVIEW</span><span>{current.aspect==='portrait'?'9:16':current.aspect==='landscape'?'16:9':'1:1'} · FAIR 50/50 TOSS</span></div>}
          <div ref={stageRef} className={[styles.stage,styles[current.theme],styles[current.aspect]].join(' ')} role={showMode?'button':undefined} tabIndex={showMode?0:undefined} aria-label={showMode?'Tap to toss or replay coin':undefined} onClick={()=>{if(showMode)tossRef.current()}} onKeyDown={e=>{if(showMode&&(e.key==='Enter'||e.key===' ')){e.preventDefault();tossRef.current()}}} style={current.backgroundImage?{backgroundImage:'linear-gradient(#050d26ad,#050d26bd),url('+current.backgroundImage+')',backgroundSize:'cover',backgroundPosition:'center'}:undefined}>
            <DirectorStageEffects settings={director} phase={phaseStyle} prompt="CHOOSE A SIDE · COMMENT YOUR PICK"/>
            <div className={styles.stageInner}>
              {current.showBrand && <div className={styles.brand}><span className={styles.brandMark}>V</span><span><strong>VIBECOIN</strong><small>BY VIBESCHOOL</small></span><em>EP {String(current.episode).padStart(2,'0')}</em></div>}
              <div className={styles.hero}><span className={styles.heroEyebrow}>THE ULTIMATE 50/50 CHALLENGE</span><h2>{current.headline}</h2><p>{current.name}</p></div>
              <div className={styles.duel}>
                {(['heads','tails'] as const).map(side=><div key={side} className={[styles.challenger,winner===side&&phase==='reveal'&&current.spotlight?styles.chosen:''].join(' ')} style={{'--accent':current[side].color} as CSSProperties}>
                  {current.showLogos&&current[side].logo?<img src={current[side].logo} alt="" className={styles.challengerLogo}/>:<span className={styles.challengerSymbol}>{current[side].symbol || (side==='heads'?'H':'T')}</span>}
                  <small>{current[side].subtitle}</small><strong>{current[side].name}</strong>
                  {winner===side&&phase==='reveal'&&<b className={styles.winLabel}>SELECTED</b>}
                </div>)}
              </div>
              <div className={styles.coinArea} style={focalStyle(director,phaseStyle,reduceMotion)}>
                <div className={styles.dragHint}>DRAG ← → OR ↑ ↓ TO TURN · HEADS / TAILS</div>
                <div className={styles.coinHalo} style={{background:'radial-gradient(circle,'+current.heads.color+'44 0%,'+current.tails.color+'45 42%,transparent 72%)'}}/>
                {phase==='flipping'&&!reduceMotion&&<div className={styles.launchStreak} aria-hidden="true"/>}
                <div ref={flightRef} className={styles.tossTrajectory} onPointerDown={onCoinPointerDown} onPointerMove={onCoinPointerMove} onPointerUp={onCoinPointerEnd} onPointerCancel={onCoinPointerEnd} onClick={event=>{event.stopPropagation();if(showMode&&!suppressClickRef.current)tossRef.current();suppressClickRef.current=false}} role="slider" tabIndex={0} aria-label="Rotate the two-sided coin; drag to show heads or tails" aria-valuemin={0} aria-valuemax={359} aria-valuenow={Math.round(((rotation%360)+360)%360)} onKeyDown={event=>{if(event.key==='ArrowRight'||event.key==='ArrowUp'||event.key==='ArrowLeft'||event.key==='ArrowDown'){event.preventDefault();setRotation(angle=>angle+(event.key==='ArrowRight'||event.key==='ArrowUp'?30:-30))}}} data-dragging={dragging?'true':'false'}>
                  <div ref={coinRef} className={[styles.coin,styles[current.coinStyle],current.tossAxis==='horizontal'?styles.horizontal:''].join(' ')} style={{transform:(current.tossAxis==='horizontal'?'rotateY(':'rotateX(')+showRotation+'deg)'}}>
                    <div className={[styles.face,styles.front].join(' ')} style={{'--face-color':current.heads.color,background:'radial-gradient(circle at 22% 14%,#ffffffd0,transparent 42%),linear-gradient(145deg,'+current.heads.color+' 15%,#2b0b31 125%)',color:'#fff'} as CSSProperties}>
                      <span className={styles.facePattern} aria-hidden="true"/>
                      <div className={styles.coinRing}>{current.showLogos&&current.heads.logo?<img src={current.heads.logo} alt="Heads logo"/>:<span>{current.heads.symbol||'H'}</span>}</div>
                      <b>{current.heads.name}</b><small>HEADS · VIBECOIN</small>
                    </div>
                    <div className={[styles.face,styles.back].join(' ')} style={{'--face-color':current.tails.color,background:'radial-gradient(circle at 22% 14%,#ffffffb9,transparent 43%),linear-gradient(145deg,'+current.tails.color+' 15%,#07304f 125%)',color:'#fff'} as CSSProperties}>
                      <span className={styles.facePattern} aria-hidden="true"/>
                      <div className={styles.coinRing}>{current.showLogos&&current.tails.logo?<img src={current.tails.logo} alt="Tails logo"/>:<span>{current.tails.symbol||'T'}</span>}</div>
                      <b>{current.tails.name}</b><small>TAILS · VIBECOIN</small>
                    </div>
                  </div>
                </div>
                <div className={styles.coinShadow}/>
                {phase==='reveal'&&!reduceMotion&&<div className={styles.landingRipple} aria-hidden="true"/>}
              </div>
              {phase==='countdown'&&<div className={styles.timer}><span>READY?</span><strong>{seconds}</strong></div>}
              {phase==='reveal'&&winner&&<div className={styles.reveal} role="status" aria-live="polite"><small>THE COIN HAS CHOSEN</small><strong>{current[winner].name}</strong><span>{winner.toUpperCase()} · RANDOM 50/50 RESULT</span></div>}
              {phase==='reveal'&&current.confetti&&!reduceMotion&&<div className={styles.confetti} aria-hidden="true">{Array.from({length:28},(_,i)=><i key={i} style={{left:(i*37)%100+'%',background:i%2?current.heads.color:current.tails.color,animationDelay:(i%8)*.08+'s'}}/>)}</div>}
              <p className={styles.cta}>{current.cta}</p>
              <small className={styles.disclaimer}>ENTERTAINMENT · RANDOM SELECTION · NOT A FORECAST</small>
              {!showMode&&current.showSafeArea&&<div className={styles.safeArea}>9:16 SAFE AREA · PREVIEW ONLY</div>}
            </div>
          </div>
          <div className={styles.controlBar}>
            <div className={styles.status}><span>{phase==='idle'?'READY':phase==='countdown'?'COUNTDOWN':phase==='flipping'?'IN THE AIR':phase==='ready'?'READY TO REVEAL':'REVEALED'}</span><span>{recording?'● RECORDING':history.length+' TOSSES'}</span></div>
            <div className={styles.actions}>
              <button className={styles.primary} disabled={!idle} onClick={toss}>{phase==='flipping'?'FLIPPING…':phase==='reveal'?'↻ TOSS AGAIN':'✦ TOSS THE COIN'}</button>
              {phase==='ready' && pendingRef.current && <button className={styles.primary} onClick={()=>{if(pendingRef.current)revealChoice(pendingRef.current)}}>Reveal result</button>}
              <button disabled={!idle} onClick={()=>viewCoinSide('heads')}>View Heads</button>
              <button disabled={!idle} onClick={()=>viewCoinSide('tails')}>View Tails</button>
              <button onClick={reset}>Reset</button>
              <button onClick={()=>setShowMode(v=>!v)}>{showMode?'Exit show':'Show mode'}</button>
              <button onClick={()=>{void record()}}>{recording?'■ Stop & save':'● Record'}</button>
            </div>
          </div>
          {notice&&<div className={styles.notice} role="status">{notice}<button aria-label="Dismiss" onClick={()=>setNotice('')}>×</button></div>}
          {!showMode&&<p className={styles.note}>Tap Launch Show, record this tab, and use the 9:16 layout for Shorts, Reels and TikTok. Random selection is independent of the animation.</p>}
        </section>
      </div>
    </div>
  </main>
}

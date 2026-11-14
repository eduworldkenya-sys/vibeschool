'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './pendulum-studio.module.css'
import SphereSurface from './SphereSurface'
import { useShowDirector, DirectorControls, DirectorStageEffects, focalStyle } from '../../components/games/ShowDirector'

type Side='left'|'right'
type Phase='idle'|'countdown'|'swinging'|'reveal'
type Theme='classic'|'neon'|'gold'
type Camera='front'|'angled'|'close'
type Aspect='portrait'|'landscape'|'square'
type Outcome={name:string;detail:string;logo:string;color:string}
type Setup={
 id:string;title:string;left:Outcome;right:Outcome;theme:Theme;camera:Camera;aspect:Aspect;
 duration:number;amplitude:number;showNames:boolean;showLogos:boolean;showBrand:boolean;
 sound:boolean;confetti:boolean;spotlight:boolean;countdown:boolean;volume:number;
 resultText:string;episode:number; catcher?:boolean; landingAngle?:number
}
const STORAGE='vibeschool.vibependulum.studio.v1' // Keep legacy storage so all matchups, logos, and presets migrate automatically
const makeId=()=>Math.random().toString(36).slice(2)+Date.now().toString(36)
const defaultSetup=():Setup=>({
 id:makeId(),title:'Arsenal vs Manchester United',left:{name:'ARSENAL',detail:'Option A',logo:'',color:'#e95465'},
 right:{name:'MANCHESTER\nUNITED',detail:'Option B',logo:'',color:'#62a6f4'},
 theme:'classic',camera:'angled',aspect:'portrait',duration:7,amplitude:43,
 showNames:true,showLogos:true,showBrand:true,sound:true,confetti:true,spotlight:true,
 countdown:true,volume:55,resultText:'THE SPHERE CHOSE',episode:1,catcher:true,landingAngle:56
})
const templates:{label:string;title:string;left:string;right:string;colors:[string,string]}[]=[
 {label:'Football rivalry',title:'Arsenal vs Manchester United',left:'ARSENAL',right:'MANCHESTER\nUNITED',colors:['#e95465','#62a6f4']},
 {label:'National challenge',title:'Kenya vs Uganda',left:'KENYA',right:'UGANDA',colors:['#28c78b','#f2b34d']},
 {label:'This or that',title:'This or That?',left:'THIS',right:'THAT',colors:['#a09afa','#f890bc']},
 {label:'Yes or no',title:'Yes or No?',left:'YES',right:'NO',colors:['#47d8aa','#f27791']}
]
const valid=(input:unknown):input is Setup=>{
 if(!input||typeof input!=='object')return false
 const s=input as Record<string,unknown>
 const outcome=(x:unknown)=>Boolean(x&&typeof x==='object'&&typeof (x as Outcome).name==='string'&&typeof (x as Outcome).color==='string'&&typeof (x as Outcome).logo==='string'&&typeof (x as Outcome).detail==='string')
 return typeof s.id==='string'&&typeof s.title==='string'&&outcome(s.left)&&outcome(s.right)&&['classic','neon','gold'].includes(String(s.theme))&&typeof s.duration==='number'
}
function randomSide():Side {
 const a=new Uint32Array(1)
 if(typeof crypto!=='undefined'&&crypto.getRandomValues){crypto.getRandomValues(a);return (a[0]&1)===0?'left':'right'}
 return Math.random()<0.5?'left':'right'
}
function tone(freq:number,volume:number,duration=.14){
 try {
  const ctx=new AudioContext(),o=ctx.createOscillator(),gain=ctx.createGain()
  o.type='sine';o.frequency.setValueAtTime(freq,ctx.currentTime)
  gain.gain.setValueAtTime(Math.max(.001,Math.min(.1,volume/100*.1)),ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+duration)
  o.connect(gain);gain.connect(ctx.destination);o.start();o.stop(ctx.currentTime+duration+.02)
  o.onended=()=>{void ctx.close()}
 }catch{/* audio can be restricted */}
}
export default function VibeSphereStudio(){
 const {settings:director,patch:updateDirector}=useShowDirector('pendulum') // Preserve creator preferences from the former pendulum stage
 const [setups,setSetups]=useState<Setup[]>([])
 const [selectedId,setSelectedId]=useState('')
 const [loaded,setLoaded]=useState(false)
 const [tab,setTab]=useState<'matchup'|'stage'|'motion'|'effects'|'record'>('matchup')
 const [phase,setPhase]=useState<Phase>('idle')
 const [rotation,setRotation]=useState(0)
 const [winner,setWinner]=useState<Side|null>(null)
 const [seconds,setSeconds]=useState(3)
 const [showMode,setShowMode]=useState(false)
 const [capturing,setCapturing]=useState(false)
 const [notice,setNotice]=useState('')
 const [history,setHistory]=useState<{title:string;winner:string;time:string}[]>([])
 const stageRef=useRef<HTMLDivElement>(null)
 const frameRef=useRef<number|null>(null)
 const countdownRef=useRef<number|null>(null)
 const recorderRef=useRef<MediaRecorder|null>(null)
 const streamRef=useRef<MediaStream|null>(null)
 const chunksRef=useRef<Blob[]>([])
 const winnerRef=useRef<Side|null>(null)
 const setup=setups.find(s=>s.id===selectedId)??setups[0]
 const stagePhaseRef=useRef<Phase>('idle')
 const setStagePhase=(next:Phase)=>{stagePhaseRef.current=next;setPhase(next)}
 useEffect(()=>{
  try{
   const raw=localStorage.getItem(STORAGE)
   if(raw){
    const p:unknown=JSON.parse(raw)
    if(p&&typeof p==='object'){
     const data=p as {setups?:unknown;selectedId?:unknown}
     if(Array.isArray(data.setups)){
      const good=data.setups.filter(valid).slice(0,30)
      if(good.length){setSetups(good);setSelectedId(good.some(s=>s.id===data.selectedId)?String(data.selectedId):good[0].id);setLoaded(true);return}
     }
    }
   }
  }catch{/* use starter */}
  const fresh=defaultSetup();setSetups([fresh]);setSelectedId(fresh.id);setLoaded(true)
 },[])
 useEffect(()=>{if(!loaded)return;try{localStorage.setItem(STORAGE,JSON.stringify({setups,selectedId}))}catch{setNotice('Browser storage is full. Export a setup to back up your work.')}},[setups,selectedId,loaded])
 useEffect(()=>{return ()=>{
  if(frameRef.current!==null)cancelAnimationFrame(frameRef.current)
  if(countdownRef.current!==null)clearInterval(countdownRef.current)
  streamRef.current?.getTracks().forEach(t=>t.stop())
 }},[])
 useEffect(()=>{
  if(frameRef.current!==null)cancelAnimationFrame(frameRef.current)
  if(countdownRef.current!==null)clearInterval(countdownRef.current)
  winnerRef.current=null;setWinner(null);setRotation(0);setStagePhase('idle');setNotice('')
 },[selectedId])
 const update=(patch:Partial<Setup>)=>{setSetups(a=>a.map(s=>s.id===selectedId?{...s,...patch}:s))}
 const editOutcome=(side:Side,patch:Partial<Outcome>)=>{if(setup)update({[side]:{...setup[side],...patch}})}
 const applyTemplate=(i:number)=>{
  const t=templates[i];if(!t)return
  const fresh=defaultSetup()
  fresh.title=t.title;fresh.left.name=t.left;fresh.right.name=t.right;fresh.left.color=t.colors[0];fresh.right.color=t.colors[1]
  setSetups(s=>[...s,fresh].slice(-30));setSelectedId(fresh.id);setTab('matchup')
  setNotice('New editable copy saved. Existing setups are unchanged.')
 }
 const duplicate=()=>{
  if(!setup)return
  const copy={...setup,id:makeId(),title:setup.title+' — Copy',left:{...setup.left},right:{...setup.right}}
  setSetups(s=>[...s,copy].slice(-30));setSelectedId(copy.id);setNotice('Version copied. Your original is preserved.')
 }
 const readLogo=(side:Side,file?:File)=>{
  if(!file)return
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>160000){setNotice('Use PNG, JPG or WebP under 160 KB.');return}
  const reader=new FileReader()
  reader.onload=()=>{if(typeof reader.result==='string')editOutcome(side,{logo:reader.result})}
  reader.readAsDataURL(file)
 }
 const download=()=>{
  if(!setup)return
  const url=URL.createObjectURL(new Blob([JSON.stringify(setup,null,2)],{type:'application/json'}))
  const a=document.createElement('a');a.href=url;a.download='vibesphere-'+setup.title.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.json';a.click()
  window.setTimeout(()=>URL.revokeObjectURL(url),1000)
 }
 const importFile=async(file?:File)=>{
  if(!file)return
  try{
   if(file.size>500000)throw Error('File too large.')
   const parsed:unknown=JSON.parse(await file.text())
   if(!valid(parsed))throw Error('This is not a VibeSphere setup.')
   const copy:Setup={...parsed,id:makeId(),title:parsed.title.slice(0,110),left:{...parsed.left},right:{...parsed.right}}
   setSetups(s=>[...s,copy].slice(-30));setSelectedId(copy.id);setNotice('Setup imported as a separate copy.')
  }catch(e){setNotice(e instanceof Error?e.message:'Unable to import setup.')}
 }
 const animate=(target:Side)=>{
  if(!setup)return
  const began=performance.now()
  const duration=Math.max(3000,setup.duration*1000)
  // Two opposite sphere faces: A faces the fixed pointer at 0°, B at 180°.
  // Whole revolutions make the first choice invisible to the viewer until the stop.
  const base=rotation
  const loops=4+Math.max(0,Math.round(setup.amplitude/15))
  const finish=360*loops+(target==='left'?0:180)
  const destination=base+finish-(((base%360)+360)%360)
  winnerRef.current=target;setWinner(null);setStagePhase('swinging')
  const tick=(now:number)=>{
   const t=Math.min(1,(now-began)/duration)
   // Ease-out quintic slows the sphere progressively and lands the selected face exactly at the fixed pointer.
   const eased=1-Math.pow(1-t,5)
   setRotation(base+(destination-base)*eased)
   if(setup.sound && t<.72 && Math.floor(t*18)!==Math.floor(((now-began-16)/duration)*18)&&Math.floor(t*18)%3===0)tone(220+Math.floor(t*10)*22,setup.volume,.04)
   if(t<1){frameRef.current=requestAnimationFrame(tick);return}
   frameRef.current=null
   setRotation(destination);setWinner(target);setStagePhase('reveal')
   if(setup.sound){tone(740,setup.volume,.3);window.setTimeout(()=>tone(980,setup.volume,.35),130)}
   setHistory(h=>[{title:setup.title,winner:setup[target].name.replace(/\s+/g,' '),time:new Date().toLocaleString()},...h].slice(0,20))
  }
  frameRef.current=requestAnimationFrame(tick)
 }
 const start=()=>{
  if(!setup||stagePhaseRef.current==='swinging'||stagePhaseRef.current==='countdown')return
  if(frameRef.current!==null)cancelAnimationFrame(frameRef.current)
  if(countdownRef.current!==null)clearInterval(countdownRef.current)
  const choice=randomSide()
  setWinner(null);winnerRef.current=choice
  if(!setup.countdown){animate(choice);return}
  setSeconds(3);setStagePhase('countdown')
  let remaining=3
  countdownRef.current=window.setInterval(()=>{
   remaining-=1
   if(remaining<=0){
    if(countdownRef.current!==null)clearInterval(countdownRef.current)
    countdownRef.current=null
    animate(choice)
   }else{setSeconds(remaining);if(setup.sound)tone(440,setup.volume,.09)}
  },750)
 }
 const reset=()=>{
  if(frameRef.current!==null)cancelAnimationFrame(frameRef.current)
  if(countdownRef.current!==null)clearInterval(countdownRef.current)
  countdownRef.current=null;frameRef.current=null;winnerRef.current=null
  setWinner(null);setRotation(0);setStagePhase('idle')
 }
 const startRecording=async()=>{
  if(capturing)return
  try{
   if(!navigator.mediaDevices?.getDisplayMedia||typeof MediaRecorder==='undefined')throw Error('Recording is not supported in this browser.')
   const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true})
   streamRef.current=stream
   const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(x=>MediaRecorder.isTypeSupported(x))
   const recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);recorderRef.current=recorder;chunksRef.current=[]
   recorder.ondataavailable=e=>{if(e.data.size>0)chunksRef.current.push(e.data)}
   recorder.onstop=()=>{
    const blob=new Blob(chunksRef.current,{type:recorder.mimeType||'video/webm'})
    if(blob.size){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='vibesphere-'+Date.now()+'.webm';a.click();window.setTimeout(()=>URL.revokeObjectURL(url),3000)}
    stream.getTracks().forEach(t=>t.stop());setCapturing(false);streamRef.current=null;recorderRef.current=null
   }
   stream.getVideoTracks().forEach(t=>{t.onended=()=>{if(recorder.state!=='inactive')recorder.stop()}})
   recorder.start(300);setCapturing(true);setNotice('Recording started. Share a tab with audio for sound.')
  }catch(e){setNotice(e instanceof Error?e.message:'Could not start recording.')}
 }
 const stopRecording=()=>{if(recorderRef.current?.state==='recording')recorderRef.current.stop()}
 const stageTap=()=>{if(!showMode)return;if(stagePhaseRef.current==='idle'||stagePhaseRef.current==='reveal')start()}
 const uploadRow=(side:Side)=>{
  if(!setup)return null
  const item=setup[side]
  return <div className={styles.optionEditor}>
   <div className={styles.editorTop}><span className={styles.editorDot} style={{background:item.color}}/><strong>{side==='left'?'OUTCOME A · LEFT':'OUTCOME B · RIGHT'}</strong></div>
   <label>Display name<textarea rows={2} value={item.name} maxLength={90} onChange={e=>editOutcome(side,{name:e.target.value})}/></label>
   <div className={styles.buttonRow}><button type="button" onClick={()=>editOutcome(side,{name:item.name.replace(/\s+(?=[^\s]+$)/,'\n')})}>Split last word</button><button type="button" onClick={()=>editOutcome(side,{name:item.name.replace(/\n/g,' ')})}>Single line</button></div>
   <label>Small caption<input value={item.detail} maxLength={55} onChange={e=>editOutcome(side,{detail:e.target.value})}/></label>
   <label>Team colour<input type="color" value={item.color} onChange={e=>editOutcome(side,{color:e.target.value})}/></label>
   <label>Logo (JPG / PNG / WebP, max 160 KB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{readLogo(side,e.target.files?.[0]);e.target.value=''}}/></label>
   {item.logo && <div className={styles.logoRow}><img src={item.logo} alt="" width="40" height="40"/><button onClick={()=>editOutcome(side,{logo:''})}>Remove logo</button></div>}
  </div>
 }
 if(!loaded||!setup)return <main className={styles.page}>Loading VibeSphere…</main>
 const revealed=winner!==null&&phase==='reveal'
 return <main className={styles.page}>
  <div className={[styles.shell,showMode?styles.showShell:''].join(' ')}>
   {!showMode&&<header className={styles.header}>
    <div><p className={styles.kicker}>VIBESCHOOL ORIGINALS / CREATOR LAB</p><h1>Vibe<span>Sphere</span><b>3D</b></h1><p>Two faces. One fixed pointer. A cinematic choice.</p></div>
    <div className={styles.headButtons}><span>UNLISTED STUDIO · SAVED IN YOUR BROWSER</span><button className={styles.primary} onClick={()=>setShowMode(true)}>Launch show ↗</button></div>
   </header>}
   <div className={styles.workspace}>
    {!showMode&&<aside className={styles.sidebar}>
     <nav className={styles.tabs} aria-label="VibeSphere editor">
      {(['matchup','stage','motion','effects','record'] as const).map(x=><button key={x} className={x===tab?styles.tabActive:''} onClick={()=>setTab(x)}>{x==='matchup'?'Matchup':x==='stage'?'Stage':x==='motion'?'Motion':x==='effects'?'Effects':'Record'}</button>)}
     </nav>
     <div className={styles.controls}>
      {tab==='matchup'&&<>
       <div className={styles.sectionHead}><h2>Matchup creator</h2><button onClick={duplicate}>Save as new</button></div>
       <label>Saved versions<select value={selectedId} onChange={e=>setSelectedId(e.target.value)}>{setups.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
       <label>Episode title<input value={setup.title} maxLength={110} onChange={e=>update({title:e.target.value})}/></label>
       <div className={styles.templateGrid}>{templates.map((t,i)=><button key={t.label} onClick={()=>applyTemplate(i)}>{t.label}</button>)}</div>
       <p className={styles.help}>Presets create editable copies. Your originals stay available.</p>
       {uploadRow('left')}{uploadRow('right')}
       <button onClick={()=>{if(setups.length>1){const rest=setups.filter(x=>x.id!==setup.id);setSetups(rest);setSelectedId(rest[0].id)}}} disabled={setups.length<2}>Delete current version</button>
      </>}
      {tab==='stage'&&<>
       <h2>Studio atmosphere</h2>
       <DirectorControls settings={director} onChange={updateDirector}/>
       <label>Scene<select value={setup.theme} onChange={e=>update({theme:e.target.value as Theme})}><option value="classic">Classic metal studio</option><option value="neon">Neon prediction arena</option><option value="gold">Black & gold premium</option></select></label>
       <label>Camera angle<select value={setup.camera} onChange={e=>update({camera:e.target.value as Camera})}><option value="front">Front view</option><option value="angled">3D angled</option><option value="close">Cinematic close</option></select></label>
       <label>Video frame<select value={setup.aspect} onChange={e=>update({aspect:e.target.value as Aspect})}><option value="portrait">9:16 Shorts / Reels</option><option value="landscape">16:9 YouTube</option><option value="square">1:1 Social</option></select></label>
       <label>Episode number<input type="number" min="1" max="9999" value={setup.episode} onChange={e=>update({episode:Math.max(1,Math.min(9999,Number(e.target.value)||1))})}/></label>
       <label className={styles.check}><input type="checkbox" checked={setup.showBrand} onChange={e=>update({showBrand:e.target.checked})}/> Show VibeSchool branding</label>
       <label className={styles.check}><input type="checkbox" checked={setup.showNames} onChange={e=>update({showNames:e.target.checked})}/> Show option names</label>
       <label className={styles.check}><input type="checkbox" checked={setup.showLogos} onChange={e=>update({showLogos:e.target.checked})}/> Show uploaded logos</label>
      </>}
      {tab==='motion'&&<>
       <h2>Spinning sphere controls</h2>
       <label>Spin duration · {setup.duration}s<input type="range" min="4" max="14" step="1" value={setup.duration} onChange={e=>update({duration:Number(e.target.value)})}/></label>
       <label>Number of revolutions · {4+Math.max(0,Math.round(setup.amplitude/15))}<input type="range" min="15" max="90" step="15" value={setup.amplitude} onChange={e=>update({amplitude:Number(e.target.value)})}/></label>
       <label className={styles.check}><input type="checkbox" checked={setup.countdown} onChange={e=>update({countdown:e.target.checked})}/> Three-beat countdown before spin</label>
       <p className={styles.help}>The ball rotates on its vertical axis while a stationary pointer marks the visible face. A and B occupy opposite sides of the sphere. The face shown at the exact stop is always the announced result. The choice is random entertainment, not an actual match forecast.</p>
      </>}
      {tab==='effects'&&<>
       <h2>Sound & reveal effects</h2>
       <label className={styles.check}><input type="checkbox" checked={setup.sound} onChange={e=>update({sound:e.target.checked})}/> Rotation & reveal sounds</label>
       <label>Sound volume · {setup.volume}%<input type="range" min="0" max="100" value={setup.volume} onChange={e=>update({volume:Number(e.target.value)})}/></label>
       <label className={styles.check}><input type="checkbox" checked={setup.spotlight} onChange={e=>update({spotlight:e.target.checked})}/> Spotlight winner</label>
       <label className={styles.check}><input type="checkbox" checked={setup.confetti} onChange={e=>update({confetti:e.target.checked})}/> Celebration particles</label>
       <label>Reveal heading<input maxLength={70} value={setup.resultText} onChange={e=>update({resultText:e.target.value})}/></label>
       <button onClick={()=>{if(setup.sound)tone(780,setup.volume,.35)}}>Preview result sound</button>
      </>}
      {tab==='record'&&<>
       <h2>Recording & saving</h2>
       <p className={styles.help}>Select Launch show for an uncluttered stage. Tap the stage to spin and replay the sphere. Record the browser tab using the button below, and enable tab audio if needed.</p>
       <div className={styles.buttonRow}><button onClick={startRecording} disabled={capturing}>Start screen recording</button><button onClick={stopRecording} disabled={!capturing}>Stop & download</button></div>
       <div className={styles.buttonRow}><button onClick={download}>Export setup JSON</button><label className={styles.fileButton}>Import setup<input type="file" accept=".json,application/json" onChange={e=>{void importFile(e.target.files?.[0]);e.target.value=''}}/></label></div>
       <h3>Recent spins</h3>
       <div className={styles.history}>{history.length?history.map((h,i)=><p key={i}><strong>{h.winner}</strong><span>{h.time}</span></p>):<p>No spins yet in this session.</p>}</div>
      </>}
     </div>
    </aside>}
    <section className={styles.preview}>
     {!showMode&&<div className={styles.previewBar}><span><i/> LIVE STAGE · YOUR EDITS APPEAR IMMEDIATELY</span><span>{setup.aspect==='portrait'?'9:16':setup.aspect==='landscape'?'16:9':'1:1'} · {setup.camera.toUpperCase()} VIEW</span></div>}
     <div ref={stageRef} className={[styles.stage,styles[setup.theme],styles[setup.aspect],styles[setup.camera],showMode?styles.interactive:''].join(' ')} role={showMode?'button':undefined} tabIndex={showMode?0:undefined} onClick={stageTap} onKeyDown={e=>{if(showMode&&(e.key==='Enter'||e.key===' ')){e.preventDefault();stageTap()}}} aria-label={showMode?'Tap to spin or replay the sphere':undefined}>
      <div className={styles.stadiumLights} aria-hidden="true"><span/><span/><span/><span/><span/></div>
      <DirectorStageEffects settings={director} phase={revealed?'reveal':phase==='swinging'?'action':'idle'} prompt="PICK YOUR SIDE · COMMENT BELOW"/>
      <div className={styles.scene}>
       {setup.showBrand&&<div className={styles.brand}><span className={styles.brandIcon}>V</span><strong>VibeSphere</strong><small>BY VIBESCHOOL</small><em>EP. {String(setup.episode).padStart(2,'0')}</em></div>}
       <div className={styles.heading}><div className={styles.headingPill}>THE TWO-CHOICE CHALLENGE</div><h2>{setup.title}</h2><p>WHICH FACE WILL THE POINTER PICK?</p></div>
       <div className={styles.sphereArena} style={focalStyle(director,revealed?'reveal':phase==='swinging'?'action':'idle')}>
        <div className={styles.sphereShadow} aria-hidden="true"/>
        <div className={styles.orbPerspective}>
         <SphereSurface rotation={rotation} left={setup.left} right={setup.right} showNames={setup.showNames} showLogos={setup.showLogos} className={styles.sphereCanvas}/>
         <div className={styles.orbGlass} aria-hidden="true"/>
         <div className={styles.pointerAssembly} aria-hidden="true">
          <div className={styles.pointerMount}/><div className={styles.pointerNeedle}/><span>FIXED POINTER · FRONT FACE</span>
         </div>
        </div>
        <div className={styles.arenaBase} aria-hidden="true"><span>VIBESPHERE · RANDOM SELECTOR</span></div>
       </div>
       <div className={styles.outcomes}>
        {(['left','right'] as const).map(side=>{
         const o=setup[side],active=revealed&&winner===side
         return <div key={side} className={[styles.outcome,active?styles.outcomeWinner:''].join(' ')} style={{borderColor:active?o.color:undefined,boxShadow:active&&setup.spotlight?'0 0 42px '+o.color+'99':undefined}}>
          <div className={styles.optionOverline}>{side==='left'?'A · LEFT':'B · RIGHT'}</div>
          {setup.showLogos&&o.logo?<img className={styles.outcomeLogo} src={o.logo} alt={o.name.replace(/\n/g,' ')+' logo'}/>:<div className={styles.outcomeSymbol} style={{background:o.color+'44',borderColor:o.color}}>{side==='left'?'A':'B'}</div>}
          {setup.showNames&&<strong className={styles.outcomeName}>{o.name}</strong>}
          <span className={styles.outcomeDetail}>{o.detail}</span>
          {active&&<span className={styles.selectedTag}>SELECTED</span>}
         </div>
        })}
       </div>
       <div className={styles.sceneBottom}><span>SPIN. SLOW. SELECT.</span><span>ENTERTAINMENT · RANDOM SELECTION</span></div>
       {phase==='countdown'&&<div className={styles.countdown}><small>READY TO SPIN?</small><b>{seconds}</b></div>}
       {revealed&&winner&&<div className={styles.sphereResultInline}>
        <small>{setup.resultText}</small><strong>{setup[winner].name}</strong><p>Random entertainment result · Not a match prediction</p>
       </div>}
       {revealed&&setup.confetti&&<div className={styles.particles} aria-hidden="true">{Array.from({length:26},(_,i)=><i key={i} style={{left:((i*37)%99)+'%',animationDelay:((i%7)*.11)+'s',background:i%2?setup.left.color:setup.right.color}}/>)}</div>}
      </div>
     </div>
     <div className={styles.stageControls}>
      <div className={styles.status}><b>{phase==='idle'?'READY':phase==='countdown'?'COUNTDOWN':phase==='swinging'?'IN MOTION':'REVEALED'}</b><span>{capturing?'● RECORDING':'POINTER-BASED RANDOM SELECTOR'}</span></div>
      <div className={styles.actionButtons}>
       <button className={styles.primary} onClick={start} disabled={phase==='swinging'||phase==='countdown'}>{revealed?'Spin again ↻':'Spin sphere ↗'}</button>
       <button onClick={reset}>Reset</button>
       <button onClick={()=>setShowMode(v=>!v)}>{showMode?'Exit show':'Show mode'}</button>
       <button onClick={capturing?stopRecording:startRecording}>{capturing?'Stop & save video':'● Record'}</button>
      </div>
     </div>
     {notice&&<div className={styles.notice} role="status">{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss notice">×</button></div>}
    </section>
   </div>
   {!showMode&&<footer className={styles.footer}>VIBESPHERE · A VIBESCHOOL ORIGINAL <span>For entertainment. A random sphere result is not a sports forecast, poll or endorsement.</span></footer>}
  </div>
 </main>
}

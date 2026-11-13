'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styles from './spin-studio.module.css'

type Entry = { id: string; label: string; question: string; answer: string; image?: string }
type ShowFormat = 'challenge' | 'lucky' | 'trending' | 'learn'
type SegmentStyle = 'text' | 'photo' | 'both'
type ProductionStatus = 'idea' | 'recorded' | 'edited' | 'scheduled' | 'published' | 'reviewed'
type ProductionItem = { id:string; wheelId:string; title:string; platform:string; status:ProductionStatus; plannedDate:string; url:string; views:number; likes:number; shares:number; comments:number; followers:number; notes:string }
const PRODUCTION_STORAGE='vibeschool.vibespin.production.v1'
const formatNames:Record<ShowFormat,string>={challenge:'VibeSpin Challenge',lucky:'VibeSpin Lucky Draw',trending:'VibeSpin Trending',learn:'VibeSpin Learn'}
const socialPlatforms=['YouTube Shorts','TikTok','Facebook Reels','Instagram Reels','WhatsApp Status','Other']
const initialProduction=():ProductionItem=>({id:uid(),wheelId:'',title:'',platform:'YouTube Shorts',status:'idea',plannedDate:'',url:'',views:0,likes:0,shares:0,comments:0,followers:0,notes:''})
type Wheel = { showFormat?: ShowFormat; segmentStyle?: SegmentStyle; introEnabled?: boolean; outroEnabled?: boolean; introDuration?: number; outroDuration?: number; musicEnabled?: boolean; musicStyle?: 'ambient' | 'pulse' | 'suspense' | 'comedy' | 'calm'; musicVolume?: number; batchMode?: boolean; logoImage?: string; automatic?: boolean; revealHold?: number; stageBackground?: string; backgroundImage?: string; fontStyle?: 'modern' | 'classic' | 'playful'; celebration?: 'confetti' | 'glow' | 'none'; volumes?: { spin:number; reveal:number }; episode?: number; id: string; name: string; entries: Entry[]; maxSpins: number; noRepeat: boolean; duration: number; countdown: number; sound: boolean; theme: 'electric' | 'sunset' | 'neon'; headline: string; cta: string }
type Format = 'portrait' | 'landscape' | 'square'
type Saved = { wheels: Wheel[]; selectedId: string }
const STORAGE = 'vibeschool.spin-studio.v1'
const stageThemes: Record<string,string> = {
  game:'radial-gradient(ellipse at 50% 28%, #134d8b 0%, #08152d 67%, #030816 100%)',
  gold:'radial-gradient(ellipse at 50% 28%, #795b2b 0%, #241b1c 60%, #070a12 100%)',
  pop:'linear-gradient(145deg, #e46d75 0%, #7033b8 50%, #20275c 100%)',
  midnight:'radial-gradient(ellipse at 50% 25%, #49339d 0%, #09152f 70%, #040716 100%)',
  clean:'linear-gradient(145deg,#1c4968 0%,#08172c 100%)'
}
const templates: {name:string; entries:[string,string,string][]}[] = [
  {name:'African Capitals',entries:[['Kenya','What is the capital of Kenya?','Nairobi'],['Uganda','What is the capital of Uganda?','Kampala'],['Tanzania','What is the capital of Tanzania?','Dodoma'],['Rwanda','What is the capital of Rwanda?','Kigali'],['Ghana','What is the capital of Ghana?','Accra'],['Nigeria','What is the capital of Nigeria?','Abuja']]},
  {name:'Mental Maths',entries:[['12 × 8','What is 12 multiplied by 8?','96'],['15 + 27','What is 15 plus 27?','42'],['3/4','What is 3/4 of 20?','15'],['25%','What is 25% of 200?','50']]},
  {name:'Science Quiz',entries:[['Mars','Which planet is called the Red Planet?','Mars'],['Plants','How do green plants make food?','Photosynthesis'],['Water','What is the chemical formula for water?','H₂O'],['Gravity','Which force attracts objects towards Earth?','Gravity']]}
]
const colors = {
  electric: ['#1ac6c2','#ffbd37','#fe577e','#6d6dfc','#4cdb91','#ff8552','#aa6df3','#349dee'],
  sunset: ['#e85540','#ffc34a','#fd7391','#904ee0','#fb9242','#eebc65','#e35693','#bc5a47'],
  neon: ['#45ecaf','#bd72ff','#f4e85e','#4e9bf6','#ff609c','#35d4d3','#f09c4b','#8ced67'],
}
const uid = () => Math.random().toString(36).slice(2,11)
const sample: Entry[] = [
  ['Kenya','What is the capital of Kenya?','Nairobi'],
  ['Uganda','What is the capital of Uganda?','Kampala'],
  ['Tanzania','What is the capital of Tanzania?','Dodoma'],
  ['Rwanda','What is the capital of Rwanda?','Kigali'],
  ['Nigeria','What is the capital of Nigeria?','Abuja'],
  ['Ghana','What is the capital of Ghana?','Accra'],
  ['Egypt','What is the capital of Egypt?','Cairo'],
  ['Brazil','What is the capital of Brazil?','Brasília'],
  ['Japan','What is the capital of Japan?','Tokyo'],
  ['Australia','What is the capital of Australia?','Canberra'],
  ['Canada','What is the capital of Canada?','Ottawa'],
  ['France','What is the capital of France?','Paris'],
].map(([label,question,answer])=>({id:uid(),label,question,answer}))
const starter = (): Wheel => ({
  id: uid(), name:'Capital City Challenge', headline:'CAN YOU BEAT THE WHEEL?',
  cta:'Comment your answer • Follow VibeSchool',
  entries: sample.map(item=>({...item,id:uid()})), maxSpins:0, noRepeat:false,
  duration:6, countdown:5, sound:true, theme:'electric',automatic:true,revealHold:3,stageBackground:'game',fontStyle:'modern',celebration:'confetti',volumes:{spin:55,reveal:75},episode:1,batchMode:false,musicEnabled:false,musicStyle:'ambient',musicVolume:18,showFormat:'challenge',segmentStyle:'both',introEnabled:true,outroEnabled:true,introDuration:2,outroDuration:3
})
function validEntry(x: unknown): x is Entry {
  if (!x || typeof x !== 'object') return false
  const e=x as Record<string,unknown>
  return typeof e.id==='string' && typeof e.label==='string' && typeof e.question==='string' && typeof e.answer==='string'
    && (e.image===undefined || (typeof e.image==='string' && (e.image==='' || (e.image.startsWith('data:image/') && e.image.length<220000))))
}
function validWheel(x: unknown): x is Wheel {
  if (!x || typeof x!=='object') return false
  const w=x as Record<string,unknown>
  return typeof w.id==='string' && typeof w.name==='string' && Array.isArray(w.entries) && w.entries.length<=100 && w.entries.every(validEntry)
    && typeof w.headline==='string' && typeof w.cta==='string' && typeof w.maxSpins==='number'
    && typeof w.duration==='number' && typeof w.countdown==='number' && typeof w.sound==='boolean'
    && typeof w.noRepeat==='boolean' && ['electric','sunset','neon'].includes(String(w.theme))
}
function pos(cx:number,cy:number,r:number,angle:number) {
  const radians=(angle-90)*Math.PI/180
  return {x:cx+r*Math.cos(radians),y:cy+r*Math.sin(radians)}
}
function wedge(i:number,count:number) {
  const step=360/count, start=i*step, end=(i+1)*step
  const a=pos(200,200,187,start), b=pos(200,200,187,end)
  return 'M 200 200 L '+a.x+' '+a.y+' A 187 187 0 '+(step>180?1:0)+' 1 '+b.x+' '+b.y+' Z'
}
function soundEffect(kind:'tick'|'win'|'fail',enabled:boolean,volume=70) {
  if (!enabled || typeof window==='undefined') return
  try {
    const ctx=new AudioContext()
    const notes=kind==='win'?[523,659,784]:kind==='fail'?[270,220]:[420]
    notes.forEach((hz,index)=>{
      const osc=ctx.createOscillator(),gain=ctx.createGain()
      const start=ctx.currentTime+index*.12
      osc.type=kind==='tick'?'triangle':'sine'
      osc.frequency.setValueAtTime(hz,start)
      gain.gain.setValueAtTime(.0001,start)
      gain.gain.exponentialRampToValueAtTime((kind==='tick'?.018:.1)*(Math.max(0,Math.min(100,volume))/100),start+.01)
      gain.gain.exponentialRampToValueAtTime(.0001,start+.13)
      osc.connect(gain);gain.connect(ctx.destination);osc.start(start);osc.stop(start+.14)
    })
    window.setTimeout(()=>{void ctx.close().catch(()=>{})},800)
  }catch { /* Audio is optional and can be blocked by the browser. */ }
}
export default function SpinStudio() {
  const [wheels,setWheels]=useState<Wheel[]>([])
  const [selectedId,setSelectedId]=useState('')
  const [loaded,setLoaded]=useState(false)
  const [recording,setRecording]=useState(false)
  const [production,setProduction]=useState<ProductionItem[]>([])
  const [productionLoaded,setProductionLoaded]=useState(false)
  const [captionCopied,setCaptionCopied]=useState(false)
  const [safeZone,setSafeZone]=useState(true)
  const [setupTab,setSetupTab]=useState<'wheels'|'content'|'appearance'|'effects'|'settings'|'production'>('wheels')
  const [showPhase,setShowPhase]=useState<'idle'|'intro'|'spinning'|'question'|'countdown'|'reveal'|'outro'>('idle')
  const [showOverlay,setShowOverlay]=useState(false)
  const [capturing,setCapturing]=useState(false)
  const [musicPlaying,setMusicPlaying]=useState(false)
  const [episodeLog,setEpisodeLog]=useState<string[]>([])
  const [reducedMotion,setReducedMotion]=useState(false)
  const [undoCount,setUndoCount]=useState(0)
  const [redoCount,setRedoCount]=useState(0)
  const [format,setFormat]=useState<Format>('portrait')
  const [rotation,setRotation]=useState(0)
  const [spinning,setSpinning]=useState(false)
  const [result,setResult]=useState<number|null>(null)
  const [reveal,setReveal]=useState(false)
  const [verdict,setVerdict]=useState<'correct'|'wrong'|null>(null)
  const [used,setUsed]=useState<string[]>([])
  const [spinCount,setSpinCount]=useState(0)
  const [seconds,setSeconds]=useState<number|null>(null)
  const [paste,setPaste]=useState('')
  const [showBulk,setShowBulk]=useState(false)
  const [feedback,setFeedback]=useState('')
  const [fullScreen,setFullScreen]=useState(false)
  const stageRef=useRef<HTMLDivElement>(null)
  const musicRef=useRef<{ctx:AudioContext; gain:GainNode; oscillators:OscillatorNode[]} | null>(null)
  const spinTimer=useRef<number|null>(null)
  const pastRef=useRef<Wheel[]>([])
  const futureRef=useRef<Wheel[]>([])
  const pendingSpin=useRef(false)
  const countdownRef=useRef<number|null>(null)
  const sceneRef=useRef<number|null>(null)
  const recorderRef=useRef<MediaRecorder|null>(null)
  const captureStreamRef=useRef<MediaStream|null>(null)
  const chunksRef=useRef<Blob[]>([])
  const spinRef=useRef<()=>void>(()=>{})
  const revealActionRef=useRef<()=>void>(()=>{})
  const nextRef=useRef<()=>void>(()=>{})
  const wheel=wheels.find(w=>w.id===selectedId) || wheels[0]
  const stopMusic=()=>{
    const audio=musicRef.current
    if(!audio)return
    musicRef.current=null
    audio.oscillators.forEach(osc=>{try{osc.stop()}catch{}})
    void audio.ctx.close().catch(()=>{})
    setMusicPlaying(false)
  }
  const playMusic=()=>{
    if(musicRef.current || !wheel?.musicEnabled)return
    try{
      const ctx=new AudioContext(),gain=ctx.createGain()
      gain.gain.value=Math.min(0.12,Math.max(0,(wheel.musicVolume??18)/100)*0.12)
      gain.connect(ctx.destination)
      const frequencies=wheel.musicStyle==='pulse'?[130.81,196,261.63]:wheel.musicStyle==='suspense'?[110,146.83,164.81]:wheel.musicStyle==='comedy'?[196,246.94,293.66]:wheel.musicStyle==='calm'?[174.61,220,261.63]:[130.81,164.81,196]
      const oscillators=frequencies.map((hz,index)=>{
        const osc=ctx.createOscillator(),voice=ctx.createGain()
        osc.type=wheel.musicStyle==='pulse'?'triangle':'sine'
        osc.frequency.value=hz
        voice.gain.value=index===0?0.42:0.25
        osc.connect(voice);voice.connect(gain);osc.start()
        return osc
      })
      // Quiet, original synthesized bed; a slow fade adds motion without obscuring speech.
      gain.gain.setValueAtTime(0.0001,ctx.currentTime)
      gain.gain.linearRampToValueAtTime(Math.min(0.12,Math.max(0,(wheel.musicVolume??18)/100)*0.12),ctx.currentTime+0.5)
      musicRef.current={ctx,gain,oscillators}
      void ctx.resume()
      setMusicPlaying(true)
    }catch{setFeedback('Background audio is unavailable in this browser.')}
  }
  const entries=wheel?.entries || []
  const batchMode=wheel?.batchMode??false
  const available=entries.map((entry,index)=>({entry,index})).filter(({entry})=>!wheel?.noRepeat || !used.includes(entry.id))
  const remaining=wheel?.maxSpins ? Math.max(0,wheel.maxSpins-spinCount) : null
  const locked=spinning || showPhase==='question' || showPhase==='countdown' || entries.length<2 || (remaining!==null && remaining===0) || available.length===0

  useEffect(()=>{
    try{
      const raw=localStorage.getItem(PRODUCTION_STORAGE)
      const parsed:unknown=raw?JSON.parse(raw):[]
      if(Array.isArray(parsed)){
        setProduction(parsed.filter(item=>item&&typeof item==='object'&&typeof item.id==='string'&&typeof item.title==='string'&&typeof item.wheelId==='string').slice(0,100))
      }
    }catch{/* Browser storage may be unavailable. */}
    setProductionLoaded(true)
  },[])
  useEffect(()=>{
    if(!productionLoaded)return
    try{localStorage.setItem(PRODUCTION_STORAGE,JSON.stringify(production))}
    catch{setFeedback('Production tracker storage is full; export or remove older records.')}
  },[production,productionLoaded])
  useEffect(()=>{
    try {
      const raw=localStorage.getItem(STORAGE)
      const data=raw?JSON.parse(raw) as Partial<Saved>:null
      if(data && Array.isArray(data.wheels)){
        const good=data.wheels.filter(validWheel).slice(0,50)
        if(good.length){setWheels(good);setSelectedId(good.some(w=>w.id===data.selectedId)?String(data.selectedId):good[0].id);setLoaded(true);return}
      }
    }catch {/* Corrupt or unavailable local storage is not fatal. */}
    const fresh=starter();setWheels([fresh]);setSelectedId(fresh.id);setLoaded(true)
  },[])
  useEffect(()=>{
    if(!loaded)return
    try{localStorage.setItem(STORAGE,JSON.stringify({wheels,selectedId}))}
    catch{setFeedback('Browser storage is full or blocked. Export your wheel to back up changes.')}
  },[wheels,selectedId,loaded])
  useEffect(()=>{
    pastRef.current=[];futureRef.current=[];setUndoCount(0);setRedoCount(0)
    if(spinTimer.current!==null)window.clearTimeout(spinTimer.current)
    if(countdownRef.current!==null)window.clearTimeout(countdownRef.current)
    if(sceneRef.current!==null)window.clearTimeout(sceneRef.current)
    pendingSpin.current=false
    setRotation(0);setSpinning(false);setResult(null);setReveal(false);setUsed([]);setSpinCount(0);setEpisodeLog([]);setSeconds(null);setVerdict(null);setShowOverlay(false);setShowPhase('idle')
  },[selectedId])
  useEffect(()=>{
    if(seconds===null || seconds<=0 || spinning || showPhase!=='countdown')return
    const timer=window.setTimeout(()=>{setSeconds(value=>value===null?null:Math.max(0,value-1));soundEffect('tick',Boolean(wheel?.sound),Math.round((wheel?.volumes?.spin??55)*.5))},1000)
    return ()=>window.clearTimeout(timer)
  },[seconds,spinning,showPhase,wheel])
  useEffect(()=>{
    if(showPhase!=='countdown'||seconds!==0||!wheel?.automatic)return
    setReveal(true);setShowPhase('reveal')
    soundEffect('win',wheel.sound,wheel.volumes?.reveal??75)
  },[seconds,showPhase,wheel])
  useEffect(()=>{
    if(showPhase!=='reveal'||!wheel?.automatic||!batchMode)return
    const timer=window.setTimeout(()=>{
      setShowOverlay(false);setShowPhase('idle');setResult(null);setReveal(false)
      nextRef.current()
    },Math.max(1,wheel.revealHold??3)*1000)
    return ()=>clearTimeout(timer)
  },[showPhase,wheel,batchMode])
  useEffect(()=>()=>{if(spinTimer.current!==null)window.clearTimeout(spinTimer.current);if(countdownRef.current!==null)window.clearTimeout(countdownRef.current);if(sceneRef.current!==null)window.clearTimeout(sceneRef.current);captureStreamRef.current?.getTracks().forEach(t=>t.stop());const audio=musicRef.current;if(audio){audio.oscillators.forEach(osc=>{try{osc.stop()}catch{}});void audio.ctx.close().catch(()=>{})}},[])
  useEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(media.matches)
    const change=()=>setReducedMotion(media.matches)
    media.addEventListener('change',change)
    return ()=>media.removeEventListener('change',change)
  },[])
  useEffect(()=>{
    const change=()=>setFullScreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange',change)
    return ()=>document.removeEventListener('fullscreenchange',change)
  },[])
  const update=useCallback((patch:Partial<Wheel>)=>{
    const current=wheels.find(w=>w.id===selectedId)
    if(!current)return
    pastRef.current=[...pastRef.current.slice(-29),{...current,entries:current.entries.map(e=>({...e}))}]
    futureRef.current=[]
    setUndoCount(pastRef.current.length);setRedoCount(0)
    setWheels(all=>all.map(w=>w.id===selectedId?{...w,...patch}:w))
  },[selectedId,wheels])
  const undoEdit=()=>{
    const previous=pastRef.current.pop()
    if(!previous||previous.id!==selectedId)return
    const current=wheels.find(w=>w.id===selectedId)
    if(current)futureRef.current.push(current)
    setWheels(all=>all.map(w=>w.id===selectedId?previous:w))
    setUndoCount(pastRef.current.length);setRedoCount(futureRef.current.length)
  }
  const redoEdit=()=>{
    const next=futureRef.current.pop()
    if(!next||next.id!==selectedId)return
    const current=wheels.find(w=>w.id===selectedId)
    if(current)pastRef.current.push(current)
    setWheels(all=>all.map(w=>w.id===selectedId?next:w))
    setUndoCount(pastRef.current.length);setRedoCount(futureRef.current.length)
  }
  const editEntry=(id:string,patch:Partial<Entry>)=>update({entries:entries.map(e=>e.id===id?{...e,...patch}:e)})
  const resetRun=()=>{
    if(spinning)return
    if(countdownRef.current!==null)clearTimeout(countdownRef.current)
    setUsed([]);setSpinCount(0);setEpisodeLog([]);setResult(null);setReveal(false);setVerdict(null);setSeconds(null);setShowOverlay(false);setShowPhase('idle');setFeedback('Spin session reset.')
  }
  const spin=()=>{
    if(locked || !wheel || pendingSpin.current)return
    if(countdownRef.current!==null){clearTimeout(countdownRef.current);countdownRef.current=null}
    const chosen=available[Math.floor(Math.random()*available.length)]
    if(!chosen)return
    pendingSpin.current=true
    setSpinning(true);setShowPhase('spinning');setShowOverlay(false);setResult(null);setReveal(false);setVerdict(null);setSeconds(null);setFeedback('')
    const step=360/entries.length, target=(360-(chosen.index+.5)*step)%360
    const current=((rotation%360)+360)%360
    const delta=((target-current+360)%360)
    const next=rotation+360*(5+Math.floor(wheel.duration/2))+delta
    setRotation(next)
    soundEffect('tick',wheel.sound,wheel.volumes?.spin??55)
    spinTimer.current=window.setTimeout(()=>{
      setSpinning(false);setResult(chosen.index);setUsed(old=>[...old,chosen.entry.id])
      setSpinCount(n=>n+1);pendingSpin.current=false
      setShowOverlay(true);setShowPhase('question')
      setEpisodeLog(old=>[...old,chosen.entry.label].slice(-150))
      soundEffect('tick',wheel.sound,wheel.volumes?.spin??55)
      countdownRef.current=window.setTimeout(()=>{
        if(wheel.countdown===0){
          setShowPhase(wheel.automatic?'reveal':'countdown');setSeconds(0)
          if(wheel.automatic){setReveal(true);soundEffect('win',wheel.sound,wheel.volumes?.reveal??75)}
        }else{setShowPhase('countdown');setSeconds(wheel.countdown)}
      },750)
    },wheel.duration*1000)
  }
  const doVerdict=(v:'correct'|'wrong')=>{
    if(result===null || spinning)return
    setVerdict(v);setReveal(true);setShowPhase('reveal');setSeconds(null)
    soundEffect(v==='correct'?'win':'fail',Boolean(wheel?.sound),wheel?.volumes?.reveal??75)
  }
  const revealNow=()=>{
    if(result===null || spinning)return
    setReveal(true);setShowPhase('reveal');setSeconds(null)
    soundEffect('win',Boolean(wheel?.sound),wheel?.volumes?.reveal??75)
  }
  const nextChallenge=()=>{if(spinning)return;if(countdownRef.current!==null){clearTimeout(countdownRef.current);countdownRef.current=null}setShowOverlay(false);setShowPhase('idle');setResult(null);setReveal(false);setSeconds(null);setVerdict(null)}
  const advanceStage=()=>{
    if(!recording || spinning)return
    if(showPhase==='intro'||showPhase==='outro'){if(sceneRef.current!==null)clearTimeout(sceneRef.current);setShowPhase('idle');return}
    if(showPhase==='question'||showPhase==='countdown'){revealNow();return}
    if(showPhase==='reveal'){nextChallenge();if(available.length>0 && remaining!==0)spinRef.current();return}
    if(showPhase==='idle')spin()
  }
  spinRef.current=spin
  revealActionRef.current=revealNow
  nextRef.current=()=>{if(!spinning && available.length>0 && remaining!==0)spinRef.current()}
  useEffect(()=>{
    function keys(event:KeyboardEvent){
      const target=event.target
      if(target instanceof HTMLElement && (target.isContentEditable || ['INPUT','SELECT','TEXTAREA'].includes(target.tagName)))return
      if(event.code==='Space'){event.preventDefault();spinRef.current()}
      if(event.key.toLowerCase()==='r')revealActionRef.current()
      if(event.key.toLowerCase()==='n')nextRef.current()
    }
    window.addEventListener('keydown',keys)
    return ()=>window.removeEventListener('keydown',keys)
  },[])
  const startCapture=async()=>{
    if(capturing)return
    try{
      if(!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder==='undefined')throw Error('Screen recording is not supported in this browser.')
      const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true})
      captureStreamRef.current=stream
      const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(type=>MediaRecorder.isTypeSupported(type))
      const recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined)
      recorderRef.current=recorder;chunksRef.current=[]
      recorder.ondataavailable=e=>{if(e.data.size)chunksRef.current.push(e.data)}
      recorder.onstop=()=>{
        const blob=new Blob(chunksRef.current,{type:recorder.mimeType||'video/webm'})
        if(blob.size){const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download='vibeschool-spin-'+Date.now()+'.webm';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),3000)}
        stream.getTracks().forEach(t=>t.stop());captureStreamRef.current=null;recorderRef.current=null;setCapturing(false)
      }
      stream.getVideoTracks().forEach(t=>t.addEventListener('ended',()=>{if(recorder.state!=='inactive')recorder.stop()},{once:true}))
      recorder.start(500);setCapturing(true);setFeedback('Recording started. Select this tab when asked. To record audio, enable Share tab audio.')
    }catch(error){setCapturing(false);setFeedback(error instanceof Error?error.message:'Screen recording could not start.')}
  }
  const stopCapture=()=>{const recorder=recorderRef.current;if(recorder&&recorder.state!=='inactive')recorder.stop()}
  const imageForEntry=(id:string,file:File|undefined)=>{
    if(!file)return
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>140000){setFeedback('Please use a JPG, PNG or WebP photo smaller than 140 KB.');return}
    const reader=new FileReader()
    reader.onload=()=>{if(typeof reader.result==='string')editEntry(id,{image:reader.result})}
    reader.readAsDataURL(file)
  }
  const setShowFormat=(kind:ShowFormat)=>{
    if(!wheel)return
    const patch:Partial<Wheel>={showFormat:kind}
    if(kind==='lucky'){patch.countdown=0;patch.celebration='confetti';patch.cta='VibeSpin by VibeSchool • See published giveaway rules'}
    else if(kind==='trending'){patch.countdown=3;patch.cta='Random selection for entertainment • Not a poll or prediction'}
    else if(kind==='learn'){patch.countdown=5;patch.cta='How did you do? Learn more with VibeSchool'}
    else{patch.countdown=5;patch.cta='Comment your answer • Follow VibeSchool'}
    update(patch)
  }
  const launchShow=()=>{
    if(sceneRef.current!==null)clearTimeout(sceneRef.current)
    setRecording(true);setFeedback('');playMusic()
    if(wheel?.introEnabled!==false){
      setShowOverlay(false);setShowPhase('intro')
      sceneRef.current=window.setTimeout(()=>setShowPhase('idle'),Math.max(1,wheel?.introDuration??2)*1000)
    }
  }
  const showOutro=()=>{
    if(spinning)return
    if(countdownRef.current!==null)clearTimeout(countdownRef.current)
    if(sceneRef.current!==null)clearTimeout(sceneRef.current)
    setShowOverlay(false);setShowPhase('outro')
    sceneRef.current=window.setTimeout(()=>setShowPhase('idle'),Math.max(1,wheel?.outroDuration??3)*1000)
  }
  const updateProduction=(id:string,patch:Partial<ProductionItem>)=>setProduction(old=>old.map(item=>item.id===id?{...item,...patch}:item))
  const createProduction=()=>{
    if(!wheel)return
    const item={...initialProduction(),wheelId:wheel.id,title:wheel.name}
    setProduction(old=>[item,...old].slice(0,100));setSetupTab('production')
  }
  const suggestedCaption=()=>{
    if(!wheel)return ''
    const episode=String(wheel.episode??1).padStart(2,'0')
    const title=wheel.name.trim()||formatNames[wheel.showFormat??'challenge']
    const note=wheel.showFormat==='trending'?'This is a random entertainment spin, not a poll, endorsement or prediction.\n':wheel.showFormat==='lucky'?'Check the official giveaway rules and eligibility before participating.\n':''
    return `VibeSpin by VibeSchool | Episode ${episode}\n${title}\n${wheel.headline}\n${note}${wheel.cta}\n#VibeSpin #VibeSchool`
  }
  const copyCaption=async()=>{
    try{await navigator.clipboard.writeText(suggestedCaption());setCaptionCopied(true);setTimeout(()=>setCaptionCopied(false),2000)}
    catch{setFeedback('Copy is unavailable. Select the caption text and copy it manually.')}
  }
  const exportTracker=()=>{
    const quote=(value:string|number)=>'"'+String(value).replaceAll('"','""')+'"'
    const headers=['title','platform','status','plannedDate','url','views','likes','shares','comments','followers','notes']
    const rows=production.map(item=>headers.map(key=>quote(item[key as keyof ProductionItem] as string|number)).join(','))
    const blob=new Blob([[headers.join(','),...rows].join('\n')],{type:'text/csv;charset=utf-8'})
    const url=URL.createObjectURL(blob),a=document.createElement('a')
    a.href=url;a.download='vibespin-production-tracker.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  const loadTemplate=(index:number)=>{
    const t=templates[index];if(!t)return
    const fresh:Wheel={...starter(),id:uid(),name:t.name,entries:t.entries.map(([label,question,answer])=>({id:uid(),label,question,answer}))}
    setWheels(all=>[...all,fresh]);setSelectedId(fresh.id);setSetupTab('content')
  }
  const uploadBackground=(file:File|undefined,kind:'background'|'logo'='background')=>{
    if(!file)return
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>220000){setFeedback('Use a JPG, PNG or WebP under 220 KB to keep browser saving reliable.');return}
    const reader=new FileReader()
    reader.onload=()=>{if(typeof reader.result==='string')update(kind==='logo'?{logoImage:reader.result}:{backgroundImage:reader.result})}
    reader.readAsDataURL(file)
  }
  const addWheel=()=>{
    const w=starter();w.name='Untitled Wheel';w.headline='SPIN & TAKE THE CHALLENGE';w.entries=[]
    setWheels(all=>[...all,w]);setSelectedId(w.id);setFeedback('New wheel created.')
  }
  const duplicateWheel=()=>{
    if(!wheel)return
    const w={...wheel,id:uid(),name:wheel.name+' Copy',entries:wheel.entries.map(e=>({...e,id:uid()}))}
    setWheels(all=>[...all,w]);setSelectedId(w.id)
  }
  const removeWheel=()=>{
    if(!wheel || wheels.length===1)return
    const next=wheels.filter(w=>w.id!==wheel.id)
    setWheels(next);setSelectedId(next[0].id)
  }
  const importRows=()=>{
    const rows=paste.split(/\r?\n/).map(line=>line.split('|').map(v=>v.trim())).filter(row=>row[0])
    if(rows.length===0)return
    const next=rows.map(([label,question,answer])=>({id:uid(),label:label.slice(0,70),question:(question||'').slice(0,250),answer:(answer||'').slice(0,250)}))
    update({entries:[...entries,...next].slice(0,100)})
    setPaste('');setShowBulk(false);setFeedback('Entries added. Maximum 100 per wheel.')
  }
  const exportSession=()=>{
    const rows=['spin,label',...episodeLog.map((label,i)=>[i+1,'"'+label.replaceAll('"','""')+'"'].join(','))]
    const blob=new Blob([rows.join('\n')],{type:'text/csv;charset=utf-8'})
    const url=URL.createObjectURL(blob),anchor=document.createElement('a')
    anchor.href=url;anchor.download='spin-session-'+Date.now()+'.csv';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  const download=()=>{
    if(!wheel)return
    const blob=new Blob([JSON.stringify(wheel,null,2)],{type:'application/json'})
    const url=URL.createObjectURL(blob),anchor=document.createElement('a')
    anchor.href=url;anchor.download='vibeschool-'+wheel.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.json'
    anchor.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  const upload=async(file:File|undefined)=>{
    if(!file)return
    try{
      if(file.size>200000)throw Error('File too large.')
      const parsed:unknown=JSON.parse(await file.text())
      if(!validWheel(parsed))throw Error('Not a valid Spin Studio wheel.')
      const source=parsed as Wheel
      const fresh={...source,id:uid(),name:source.name.slice(0,90),entries:source.entries.map(e=>({...e,id:uid()}))}
      setWheels(all=>[...all,fresh]);setSelectedId(fresh.id);setFeedback('Wheel imported.')
    }catch(error){setFeedback(error instanceof Error?error.message:'Could not import wheel.')}
  }
  const toggleFull=async()=>{
    try{
      if(document.fullscreenElement)await document.exitFullscreen()
      else await stageRef.current?.requestFullscreen()
    }catch{setFeedback('Fullscreen is not supported here. Recording mode still works.')}
  }
  const selected=result===null?null:entries[result]
  const showFormat=wheel?.showFormat??'challenge'
  const selectedIsReward=showFormat==='lucky'||showFormat==='trending'
  const segmented=useMemo(()=>entries.map((entry,index)=>({entry,index,path:wedge(index,entries.length),degree:(index+.5)*360/entries.length})),[entries])
  if(!loaded || !wheel)return <main className={styles.page}><p>Loading Spin Studio…</p></main>
  return <main className={styles.page}>
    <div className={styles.shell}>
      {!recording && <header className={styles.header}>
        <div><span className={styles.eyebrow}>VIBESCHOOL ORIGINALS · CREATOR TOOLS</span><h1>VibeSpin Studio <span>✦</span></h1><p>Create the challenge. Capture the moment. Build curiosity.</p></div>
        <div className={styles.headActions}><span className={styles.localTag}>● Browser-saved · Unlisted</span><button className={styles.primary} onClick={launchShow}>Launch Show ↗</button></div>
      </header>}
      <div className={recording?styles.recordLayout:styles.layout}>
        {!recording && <aside className={styles.controls}>
          <div className={styles.historyControls}><button disabled={!undoCount} onClick={undoEdit}>↶ Undo</button><button disabled={!redoCount} onClick={redoEdit}>↷ Redo</button><span>Changes saved locally</span></div>
          <nav className={styles.setupTabs} aria-label="Spin Studio setup">
            {(['wheels','content','appearance','effects','settings','production'] as const).map(tab=><button key={tab} type="button" className={setupTab===tab?styles.activeTab:''} aria-current={setupTab===tab?'page':undefined} onClick={()=>setSetupTab(tab)}>{tab==='wheels'?'Wheels':tab==='content'?'Content':tab==='appearance'?'Appearance':tab==='effects'?'Effects':tab==='production'?'Production':'Settings'}</button>)}
          </nav>
          {setupTab==='wheels' && <div className={styles.panel}>
            <div className={styles.panelTitle}><h2>My wheels</h2><button onClick={addWheel} className={styles.smallButton}>+ New</button></div>
            <select aria-label="Select a saved wheel" value={selectedId} onChange={e=>setSelectedId(e.target.value)}>{wheels.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>
            <div className={styles.row}><button onClick={duplicateWheel}>Duplicate</button><button disabled={wheels.length<=1} onClick={removeWheel}>Delete wheel</button></div>
            <label>Show format<select value={showFormat} onChange={e=>setShowFormat(e.target.value as ShowFormat)}>
              <option value="challenge">VibeSpin Challenge · questions and guesses</option>
              <option value="lucky">VibeSpin Lucky Draw · prizes and entries</option>
              <option value="trending">VibeSpin Trending · entertainment topics</option>
              <option value="learn">VibeSpin Learn · curriculum challenges</option>
            </select></label>
            <p className={styles.hint}>{showFormat==='trending'?'A random result is not a forecast, poll, or endorsement. Keep candidate lists fact-checked and neutral.':showFormat==='lucky'?'Check eligibility, transparency and any applicable promotion rules before announcing prizes.':'One reusable wheel for different topics and episodes.'}</p>
            <label>Wheel name<input value={wheel.name} maxLength={90} onChange={e=>update({name:e.target.value})}/></label>
            <label>Video hook / headline<input value={wheel.headline} maxLength={100} onChange={e=>update({headline:e.target.value})}/></label>
            <label>Closing call to action<input value={wheel.cta} maxLength={120} onChange={e=>update({cta:e.target.value})}/></label>
            <label>Episode number<input type="number" min="1" max="9999" value={wheel.episode??1} onChange={e=>update({episode:Math.max(1,Math.min(9999,Number(e.target.value)||1))})}/></label>
            <p className={styles.hint}>Ready-made content templates</p>
            <div className={styles.templateGrid}>{templates.map((t,i)=><button key={t.name} onClick={()=>loadTemplate(i)}>{t.name}</button>)}</div>
          </div>}
          {setupTab==='content' && <div className={styles.panel}>
            <div className={styles.panelTitle}><h2>Wheel entries <span className={styles.muted}>{entries.length}/100</span></h2><button className={styles.smallButton} disabled={entries.length>=100} onClick={()=>update({entries:[...entries,{id:uid(),label:'New item',question:'',answer:''}]})}>+ Add</button></div>
            <p className={styles.hint}>Every segment can have its own question and answer. Both are optional.</p>
            <div className={styles.entries}>{entries.map((entry,i)=><div className={styles.entry} key={entry.id}>
              <div className={styles.entryHead}><span>SEGMENT {i+1}</span><button aria-label={'Remove '+entry.label} onClick={()=>update({entries:entries.filter(e=>e.id!==entry.id)})}>Remove</button></div>
              <input aria-label={'Label '+(i+1)} placeholder="Segment label" maxLength={70} value={entry.label} onChange={e=>editEntry(entry.id,{label:e.target.value})}/>
              <input aria-label={'Question '+(i+1)} placeholder="Question (optional)" maxLength={250} value={entry.question} onChange={e=>editEntry(entry.id,{question:e.target.value})}/>
              <input aria-label={'Answer '+(i+1)} placeholder="Answer (optional)" maxLength={250} value={entry.answer} onChange={e=>editEntry(entry.id,{answer:e.target.value})}/>
              <label className={styles.photoUpload}>Segment image (JPG, PNG or WebP, max 140 KB)
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{imageForEntry(entry.id,e.target.files?.[0]);e.target.value=''}}/>
              </label>
              {entry.image && <div className={styles.photoPreview}><img src={entry.image} alt={'Segment '+entry.label}/><button onClick={()=>editEntry(entry.id,{image:''})}>Remove photo</button></div>}
            </div>)}</div>
            <button onClick={()=>setShowBulk(v=>!v)}>{showBulk?'Close bulk editor':'+ Paste multiple entries'}</button>
            {showBulk && <div className={styles.bulk}><p className={styles.hint}>One line per segment: Label | Question | Answer</p><textarea rows={5} value={paste} onChange={e=>setPaste(e.target.value)} placeholder={'Brazil | What is its capital? | Brasília\nFractions | What is 1/2 + 1/4? | 3/4'}/><button onClick={importRows} disabled={!paste.trim()}>Add entries</button></div>}
          </div>}
          {setupTab==='appearance' && <div className={styles.panel}>
            <h2>Appearance & backgrounds</h2>
            <label>Wheel segment display<select value={wheel.segmentStyle??'both'} onChange={e=>update({segmentStyle:e.target.value as SegmentStyle})}>
              <option value="text">Text only</option><option value="photo">Photo / icon only when provided</option><option value="both">Photo and name</option>
            </select></label>
            <label>Stage theme<select value={wheel.stageBackground??'game'} onChange={e=>update({stageBackground:e.target.value,backgroundImage:''})}>
              <option value="game">Game Show Blue</option><option value="gold">Gold Challenge</option><option value="pop">Pop Challenge</option><option value="midnight">Neon Night</option><option value="clean">Clean Studio</option>
            </select></label>
            <div className={styles.themeGrid}>{Object.entries(stageThemes).map(([name,background])=><button key={name} aria-label={'Choose '+name+' background'} className={wheel.stageBackground===name?styles.activeTheme:''} style={{background}} onClick={()=>update({stageBackground:name,backgroundImage:''})}>{name}</button>)}</div>
            <label>Wheel palette<select value={wheel.theme} onChange={e=>update({theme:e.target.value as Wheel['theme']})}><option value="electric">Electric Vibe</option><option value="sunset">Sunset Pop</option><option value="neon">Neon Night</option></select></label>
            <label>Typography<select value={wheel.fontStyle??'modern'} onChange={e=>update({fontStyle:e.target.value as Wheel['fontStyle']})}><option value="modern">Modern Bold</option><option value="classic">Classic Serif</option><option value="playful">Playful Round</option></select></label>
            <label>Upload your background (JPG / PNG / WebP, max 220 KB)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{uploadBackground(e.target.files?.[0]);e.target.value=''}}/></label>
            {wheel.backgroundImage && <button onClick={()=>update({backgroundImage:''})}>Remove uploaded background</button>}
            <label>Custom logo (JPG / PNG / WebP, max 220 KB)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{uploadBackground(e.target.files?.[0],'logo');e.target.value=''}}/></label>
            {wheel.logoImage && <button onClick={()=>update({logoImage:''})}>Remove custom logo</button>}
            <p className={styles.hint}>Backgrounds are saved locally in this browser with your wheel. Large images are intentionally limited to protect storage.</p>
          </div>}
          {setupTab==='effects' && <div className={styles.panel}>
            <h2>Effects & show director</h2>
            <label className={styles.check}><input type="checkbox" checked={wheel.introEnabled??true} onChange={e=>update({introEnabled:e.target.checked})}/> Branded opening scene</label>
            <label>Opening duration: {wheel.introDuration??2} seconds<input type="range" min="1" max="5" value={wheel.introDuration??2} onChange={e=>update({introDuration:Number(e.target.value)})}/></label>
            <label className={styles.check}><input type="checkbox" checked={wheel.outroEnabled??true} onChange={e=>update({outroEnabled:e.target.checked})}/> Branded closing scene</label>
            <label>Closing duration: {wheel.outroDuration??3} seconds<input type="range" min="1" max="8" value={wheel.outroDuration??3} onChange={e=>update({outroDuration:Number(e.target.value)})}/></label>
            <label className={styles.check}><input type="checkbox" checked={wheel.musicEnabled??false} onChange={e=>{update({musicEnabled:e.target.checked});if(!e.target.checked)stopMusic()}}/> Background music (original synthesised soundtrack)</label>
            <label>Music style<select value={wheel.musicStyle??'ambient'} onChange={e=>{update({musicStyle:e.target.value as Wheel['musicStyle']});stopMusic()}}><option value="ambient">Soft ambient</option><option value="pulse">Energetic game-show pulse</option><option value="suspense">Dramatic suspense</option><option value="comedy">Playful comedy</option><option value="calm">Calm background</option></select></label>
            <label>Music volume: {wheel.musicVolume??18}%<input type="range" min="0" max="100" value={wheel.musicVolume??18} onChange={e=>{const volume=Number(e.target.value);update({musicVolume:volume});if(musicRef.current)musicRef.current.gain.gain.value=Math.min(0.12,volume/100*0.12)}}/></label>
            <div className={styles.row}><button onClick={()=>{if(musicPlaying)stopMusic();else playMusic()}}>{musicPlaying?'Stop background music':'Preview music'}</button></div>
            <label className={styles.check}><input type="checkbox" checked={wheel.automatic??true} onChange={e=>update({automatic:e.target.checked})}/> Automatic countdown and answer reveal</label>
            <label>Answer display: {wheel.revealHold??3} seconds<input type="range" min="1" max="10" value={wheel.revealHold??3} onChange={e=>update({revealHold:Number(e.target.value)})}/></label>
            <label>Celebration<select value={wheel.celebration??'confetti'} onChange={e=>update({celebration:e.target.value as Wheel['celebration']})}><option value="confetti">Confetti</option><option value="glow">Soft glow</option><option value="none">No celebration</option></select></label>
            <label className={styles.check}><input type="checkbox" checked={wheel.sound} onChange={e=>update({sound:e.target.checked})}/> Sound effects on</label>
            <label>Spin / ticking volume: {wheel.volumes?.spin??55}%<input type="range" min="0" max="100" value={wheel.volumes?.spin??55} onChange={e=>update({volumes:{spin:Number(e.target.value),reveal:wheel.volumes?.reveal??75}})}/></label>
            <label>Reveal / success volume: {wheel.volumes?.reveal??75}%<input type="range" min="0" max="100" value={wheel.volumes?.reveal??75} onChange={e=>update({volumes:{spin:wheel.volumes?.spin??55,reveal:Number(e.target.value)}})}/></label>
            <p className={styles.hint}>Audio is generated locally. To include sound in a recording, select the browser tab and enable Share tab audio.</p>
          </div>}
          {setupTab==='settings' && <div className={styles.panel}>
            <h2>Show controls</h2>
            <label className={styles.check}><input type="checkbox" checked={safeZone} onChange={e=>setSafeZone(e.target.checked)}/> Show portrait safe-area guide in editing preview</label>
            <label>Video shape<select value={format} onChange={e=>setFormat(e.target.value as Format)}><option value="portrait">9:16 · Shorts & TikTok</option><option value="landscape">16:9 · YouTube</option><option value="square">1:1 · Square</option></select></label>
            <label>Spin duration: {wheel.duration} seconds<input aria-label="Spin duration" type="range" min="3" max="10" value={wheel.duration} onChange={e=>update({duration:Number(e.target.value)})}/></label>
            <label>Answer countdown: {wheel.countdown} seconds<input aria-label="Answer countdown" type="range" min="0" max="15" value={wheel.countdown} onChange={e=>update({countdown:Number(e.target.value)})}/></label>
            <label>Maximum spins (0 = unlimited)<input type="number" min="0" max="9999" value={wheel.maxSpins} onChange={e=>update({maxSpins:Math.max(0,Math.min(9999,Number(e.target.value)||0))})}/></label>
            <label className={styles.check}><input type="checkbox" checked={wheel.noRepeat} onChange={e=>update({noRepeat:e.target.checked})}/> Do not repeat a segment in this session</label>
            <label className={styles.check}><input type="checkbox" checked={batchMode} onChange={e=>update({batchMode:e.target.checked})}/> Batch production: spin again after answer reveal</label>
            <p className={styles.hint}>Space = Spin · R = Reveal · N = Next spin. You can also use the visible buttons below the stage.</p>
            <div className={styles.row}><button onClick={download}>Export wheel</button><label className={styles.fileButton}>Import JSON<input type="file" accept=".json,application/json" onChange={e=>{void upload(e.target.files?.[0]);e.target.value=''}}/></label></div>
            <p className={styles.hint}>Session history: {episodeLog.length} spins</p><button onClick={exportSession} disabled={!episodeLog.length}>Export session log (CSV)</button>
          </div>}
          {setupTab==='production' && <div className={styles.panel}>
            <div className={styles.panelTitle}><h2>Video production</h2><button className={styles.smallButton} onClick={createProduction}>+ Track episode</button></div>
            <p className={styles.hint}>Plan and track videos here. Publishing still happens in your social-media apps; all records stay in this browser.</p>
            <label>Copy-ready title, caption and hashtags
              <textarea rows={7} readOnly value={suggestedCaption()}/>
            </label>
            <button onClick={()=>{void copyCaption()}}>{captionCopied?'Copied!':'Copy video caption'}</button>
            <div className={styles.row}><button onClick={exportTracker} disabled={production.length===0}>Export production CSV</button><button onClick={createProduction}>Save this episode to tracker</button></div>
            <p className={styles.hint}>{production.length} tracked videos · {production.filter(item=>item.status==='published'||item.status==='reviewed').length} published</p>
            <div className={styles.productionList}>{production.map(item=><div className={styles.productionItem} key={item.id}>
              <label>Video title<input maxLength={120} value={item.title} onChange={e=>updateProduction(item.id,{title:e.target.value})}/></label>
              <div className={styles.productionTwo}>
                <label>Platform<select value={item.platform} onChange={e=>updateProduction(item.id,{platform:e.target.value})}>{socialPlatforms.map(platform=><option key={platform} value={platform}>{platform}</option>)}</select></label>
                <label>Status<select value={item.status} onChange={e=>updateProduction(item.id,{status:e.target.value as ProductionStatus})}>
                  {(['idea','recorded','edited','scheduled','published','reviewed'] as const).map(status=><option key={status} value={status}>{status}</option>)}
                </select></label>
              </div>
              <label>Planned publishing date<input type="date" value={item.plannedDate} onChange={e=>updateProduction(item.id,{plannedDate:e.target.value})}/></label>
              <label>Published link<input placeholder="Paste the published video URL" maxLength={500} value={item.url} onChange={e=>updateProduction(item.id,{url:e.target.value})}/></label>
              <div className={styles.productionMetrics}>{(['views','likes','shares','comments','followers'] as const).map(metric=><label key={metric}>{metric}<input type="number" min="0" max="999999999" value={item[metric]} onChange={e=>updateProduction(item.id,{[metric]:Math.max(0,Number(e.target.value)||0)})}/></label>)}</div>
              <label>Notes<textarea rows={2} maxLength={500} value={item.notes} onChange={e=>updateProduction(item.id,{notes:e.target.value})}/></label>
              <button onClick={()=>setProduction(old=>old.filter(row=>row.id!==item.id))}>Delete this record</button>
            </div>)}</div>
          </div>}
        </aside>}
        <section className={styles.previewSection} aria-label="Wheel preview">
          {!recording && <div className={styles.previewTop}><span>LIVE PREVIEW</span><span>{format==='portrait'?'9:16':format==='landscape'?'16:9':'1:1'} · Ready to record</span></div>}
          <div ref={stageRef} role={recording?'button':undefined} tabIndex={recording?0:undefined} aria-label={recording?'Tap to advance the show':undefined} onClick={advanceStage} onKeyDown={event=>{if(recording && event.key==='Enter'){event.preventDefault();advanceStage()}}} className={[styles.stage,recording?styles.tapStage:'',styles[format],styles[wheel.theme],styles['font'+(wheel.fontStyle??'modern')]].join(' ')} style={{backgroundImage:wheel.backgroundImage?'linear-gradient(#06132c55,#06132cbb),url('+wheel.backgroundImage+')':stageThemes[wheel.stageBackground??'game'],backgroundSize:'cover',backgroundPosition:'center'}}>
            <div className={styles.stageGlow} aria-hidden="true"/>
            <div className={styles.stageContent}>
              <div className={styles.brand}>{wheel.logoImage?<img className={styles.logoImage} src={wheel.logoImage} alt="Creator logo"/>:<span className={styles.brandMark}>V</span>}<span><b>VIBESPIN</b> by VIBESCHOOL</span><span className={styles.episode}>EP. {String(wheel.episode??1).padStart(2,'0')}</span></div>
              <div className={styles.titleBlock}><div className={styles.livePill}>✦ {formatNames[showFormat].toUpperCase()} ✦</div><h2>{wheel.headline||'SPIN & TAKE THE CHALLENGE'}</h2><p>{wheel.name}</p></div>
              <div className={styles.wheelArea}>
                <div className={styles.wheelHalo}/>
                <svg role="img" aria-label="Wheel with editable segments" className={styles.wheelSvg} viewBox="0 0 400 400">
                  <circle cx="200" cy="200" r="198" fill="#08152c" stroke="rgba(255,255,255,.32)" strokeWidth="3"/>
                  {segmented.length>0 && <g style={{transform:'rotate('+rotation+'deg)',transformOrigin:'200px 200px',transition:spinning?'transform '+wheel.duration+'s cubic-bezier(.12,.78,.08,1)':'none'}}>
                    {segmented.map(({entry,index,path,degree})=><g key={entry.id}>
                      <path d={path} fill={colors[wheel.theme][index%8]} stroke="#121836" strokeWidth="1.8"/>
                      <text x="200" y="73" textAnchor="middle" transform={'rotate('+degree+' 200 200)'} fill="#10162b" fontSize={entries.length>16?8:entries.length>10?10:13} fontWeight="900">{entry.label.length>15?entry.label.slice(0,14)+'…':entry.label||'Item'}</text>
                    </g>)}
                  </g>}
                  <circle cx="200" cy="200" r="48" fill="#0d1831" stroke="#ffffff" strokeWidth="5"/>
                  <circle cx="200" cy="200" r="41" fill="#0e2442"/>
                  <text x="200" y="197" fill="white" textAnchor="middle" fontSize="27" fontWeight="900">VIBE</text>
                  <text x="200" y="217" fill="#40e4cd" textAnchor="middle" fontSize="17" fontWeight="900">SPIN</text>
                  <path d="M182 2 L218 2 L200 42 Z" fill="#fff" stroke="#0e1832" strokeWidth="4"/>
                  <circle cx="200" cy="200" r="195" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="5" strokeDasharray="2 13"/>
                </svg>
                {(verdict==='correct'||(reveal&&wheel.automatic)) && wheel.celebration==='confetti' && !reducedMotion && <div className={styles.confetti} aria-hidden="true">{Array.from({length:24},(_,i)=><i key={i} style={{left:(i*41)%100+'%',animationDelay:(i%6)*.09+'s',background:colors[wheel.theme][i%8]}}/>)}</div>}
              </div>
              {showOverlay&&selected && <div className={[styles.challengePopup,showPhase==='reveal'?styles.popupReveal:''].join(' ')} role="status" aria-live="polite">
                <div className={styles.popupEyebrow}>{showPhase==='reveal'?(selectedIsReward?'RANDOM RESULT':'ANSWER REVEALED'):showPhase==='question'?'THE WHEEL HAS CHOSEN':(selectedIsReward?'RANDOM SELECTION':'YOUR CHALLENGE')}</div>
                <strong className={styles.popupLabel}>{showPhase==='reveal'?(selected.answer||selected.label):selected.label}</strong>
                {showPhase!=='reveal'&&<p className={styles.popupQuestion}>{selected.question||'What do you know about this?'}</p>}
                {showPhase==='countdown'&&<div className={styles.popupTimer}>{seconds===0?'TIME!':seconds}</div>}
                {showPhase==='reveal'&&<p className={styles.popupFact}>{selectedIsReward?'A random selection for entertainment, not a forecast or endorsement.':selected.question}</p>}
                {showPhase==='reveal'&&wheel.celebration==='glow'&&<div className={styles.popupGlow} aria-hidden="true"/>}
              </div>}
              <div className={styles.questionArea} aria-live="polite">
                {selected ? <>
                  <span className={styles.resultKicker}>{spinning?'THE WHEEL IS SPINNING':'THE WHEEL CHOSE'}</span>
                  <strong className={styles.resultLabel}>{selected.label}</strong>
                  <p className={styles.question}>{selected.question||'Your challenge starts now!'}</p>
                  {!reveal && seconds!==null && <div className={styles.countdown}>{seconds===0?'TIME!':seconds}</div>}
                  {reveal && <div className={styles.answer}><span>{verdict==='correct'?'★ CORRECT ANSWER':verdict==='wrong'?'✦ THE ANSWER':'✦ ANSWER REVEAL'}</span><strong>{selected.answer||selected.label}</strong></div>}
                </> : <><span className={styles.resultKicker}>READY WHEN YOU ARE</span><p className={styles.readyText}>One spin. One question. Can you get it right?</p></>}
              </div>
              <p className={styles.cta}>{wheel.cta}</p>
            </div>
          </div>
          <div className={styles.playBar}>
            <div className={styles.playStatus}><span>{wheel.automatic??true?'AUTO SHOW':'MANUAL SHOW'} · {batchMode?'BATCH ON':'SINGLE'}</span><span>SPINS <b>{spinCount}{remaining!==null?' / '+wheel.maxSpins:''}</b></span><span>{wheel.noRepeat?'UNIQUE LEFT '+available.length:'RANDOM MODE'}</span></div>
            <div className={styles.playButtons}>
              <button className={styles.spinButton} disabled={locked} onClick={spin}>{spinning?'SPINNING…':available.length===0?'ALL SEGMENTS USED':remaining===0?'SPIN LIMIT REACHED':'✦ SPIN NOW'}</button>
              <button disabled={spinning || result===null} onClick={()=>{if(reveal){setReveal(false);setShowPhase('question');setSeconds(null)}else revealNow();setVerdict(null)}}>{reveal?'Hide answer':'Reveal answer'}</button>
              <button disabled={spinning || result===null} onClick={()=>doVerdict('correct')}>✓ Correct</button>
              <button disabled={spinning || result===null} onClick={()=>doVerdict('wrong')}>✕ Wrong</button>
              <button onClick={nextChallenge} disabled={spinning || result===null}>Next</button><button onClick={resetRun} disabled={spinning}>Reset</button>
            </div>
          </div>
          {recording && <div className={styles.recordBar}><span>Recording view · Tap stage: spin → reveal → next · Space / R / N</span><div>
              <button onClick={()=>{void toggleFull()}}>{fullScreen?'Exit fullscreen':'Fullscreen stage'}</button>
              <button onClick={()=>{if(capturing)stopCapture();else void startCapture()}}>{capturing?'■ Stop & download recording':'● Record video'}</button>
              <button onClick={()=>{setRecording(false);stopMusic()}}>← Back to editor</button>
            </div></div>}
          {!recording && <p className={styles.note}>Your wheels are saved in this browser only. Use Launch Show, then Record video and select the current tab in the browser prompt. Fullscreen mode uses keyboard controls. Direct URL access is not private.</p>}
          {feedback && <p role="status" className={styles.feedback}>{feedback}</p>}
        </section>
      </div>
    </div>
  </main>
}
